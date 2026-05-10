package kgy.mq;

import com.github.benmanes.caffeine.cache.Cache;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/mq")
@RequiredArgsConstructor
@RefreshScope // mq.type이 바뀔 때 이 컨트롤러도 새로 생성되어 주입된 Bean을 갱신함
public class MqController {
    private final MasterConfig masterConfig;

    // 모든 MQ 구현체가 공유하는 인터페이스(예: MqProducer)를 주입받습니다.
    // MasterConfig에서 정의한 @Primary 빈이 주입됩니다.
    private final MqProducer mqProducer;

    private final Cache<Long, String> messageBuffer; // MasterConfig에서 만든 Bean 주입

    @Value("${mq.type}")
    private String mqType;

    @GetMapping("/send")
    public String sendMessage(@RequestParam String msg) {
        long timestamp = System.currentTimeMillis();

        // 1. 카페인 캐시에 먼저 담기 (무중단 원칙: 메모리 우선 확보)
        messageBuffer.put(timestamp, msg);

        // 2. 현재 상태에 따른 처리
        if (MasterConfig.isSystemHealthy) {
            processOne(timestamp, msg);
            return "SUCCESS: 전송 및 기록 완료";
        } else
        {
            return "WAIT: 장애 상황이며 버퍼에 저장되었습니다.";
        }
    }

    private synchronized void processOne(Long key, String msg)
    {
        //synchronized 키워드를 사용하여 이 메서드의 진행이 끝날 때까지 다른 메서드를 대기 시킴
        String currentTask = MasterConfig.getCurrentTaskName();
        try {
            // 1. MQ 전송 시도
            if (msg.contains("BOOM")) {
                throw new RuntimeException("고의 장애 발생!");
            }

            mqProducer.send(msg);

            // 2. 전송 성공 시에만 캐시에서 제거 및 파일 저장
            messageBuffer.invalidate(key);
            masterConfig.saveToTaskFolder(currentTask, "SENT", msg);

        } catch (Exception e) {
            // [보완] 이미 장애 상태라면 인덱스를 또 올리지 않음
            if (MasterConfig.isSystemHealthy) {
                // 장애 상태가 아닌 경우였을 때만 폴더 이름 변경
                masterConfig.saveToTaskFolder(MasterConfig.getCurrentTaskName(), "CRITICAL_ERROR", msg);
                MasterConfig.taskIndex++;
                MasterConfig.isSystemHealthy = false;
            }
        }
    }

    @PostConstruct
    public void init() {
        log.info("### 리프레시 완료: 복구 프로세스 시작 (현재 폴더: {}) ###", MasterConfig.getCurrentTaskName());

        MasterConfig.isSystemHealthy = false;

        // 복구 중의 장애 발생 여부를 체크하기 위한 로컬 변수
        boolean hasErrorDuringRecovery = false;

        if (messageBuffer != null && messageBuffer.estimatedSize() > 0) {
            // 1. 시간 순서대로 정렬하여 복구 파이프라인 생성
            messageBuffer.asMap().entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> {
                        try {
                            // 2. 전송 시도
                            mqProducer.send(entry.getValue());
                            masterConfig.saveToTaskFolder(MasterConfig.getCurrentTaskName(), "Sent", entry.getValue());
                            messageBuffer.invalidate(entry.getKey());

                        } catch (Exception e) {
                            log.error("복구 실패 버퍼에 남겨둠");
                        }
                    });
        }

        // 5. 최종 상태 결정: 모든 버퍼가 비워져야만 정상화
        if (messageBuffer.estimatedSize() == 0) {
            MasterConfig.isSystemHealthy = true;
            log.info("### 모든 복구 완료. 시스템이 정상 상태(true)로 전환되었습니다. ###");
        } else {
            log.warn("### 미처리 데이터 잔존: 시스템이 여전히 장애 상태(false)입니다. ###");
        }
    }
}