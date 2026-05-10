package kgy.mq;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import kgy.mq.nats.NatsConfig;
import kgy.mq.nats.NatsProducer;
import kgy.mq.rabbitmq.RabbitMQConfig;
import kgy.mq.rabbitmq.RabbitMQProducer;
import kgy.mq.redis.RedisConfig;
import kgy.mq.redis.RedisProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;



@Slf4j
@Configuration
@RefreshScope
@Import({RedisConfig.class, RabbitMQConfig.class, NatsConfig.class}) //해당 클래스들의 권한 부여
@RequiredArgsConstructor
public class MasterConfig
{
    @Value("${mq.type}")
    private String mqType;

    @Value("${mq.redis-mode:none}")
    private String redisMode;

    private final Environment environment;

    public static volatile boolean isSystemHealthy = true;
    public static volatile int taskIndex = 1; // 현재 활성화된 task 폴더 번호

    // 1. Redis 관련 빈들 (RedisConfig에서 가져오거나 여기서 직접 등록)
    // 2. RabbitMQ 관련 빈들 ...
    // 3. Nats 관련 빈들 ...

    /**
     * 컨트롤러에서 주입받을 '진짜' 주인공 빈입니다.
     * @Primary를 붙여서 MqProducer 타입 주입 요청 시 최우선으로 선택되게 합니다.
     */
    @Bean
    @Primary
    @RefreshScope
    public MqProducer currentMqProducer(
            @Qualifier("currentRedisProducer")RedisProducer redisProducer, // RedisConfig 등에서 등록된 빈
            RabbitMQProducer rabbitProducer,
            NatsProducer natsProducer) {

        String mqType = environment.getProperty("mq.type", "redis");

        return switch (mqType.toLowerCase()) {
            case "redis" -> redisProducer;
            case "rabbitmq" -> rabbitProducer;
            case "nats" -> natsProducer;
            default -> redisProducer; // 기본값
        };
    }

    //카페인 버퍼 생성
    @Bean
    public Cache<Long, String> messageBuffer() {
        return Caffeine.newBuilder()
                // 1. 만료 시간: 저장 후 10분이 지나면 자동으로 삭제 (메모리 누수 방지)
                .expireAfterWrite(10, TimeUnit.MINUTES)
                // 2. 최대 용량: 최대 10,000개까지만 보관 (서버 메모리 보호)
                .maximumSize(10000)
                // 3. 통계 기록: 나중에 캐시 적중률 등을 확인하고 싶을 때 사용
                .recordStats()
                .build();
    }

    @PostConstruct
    public void showCurrentMqInfo()
    {
        log.info("================================================");
        log.info(">> 현재 MQ 타입: {}", mqType.toUpperCase());
        if ("redis".equalsIgnoreCase(mqType)) {
            log.info(">> Redis 모드: {}", redisMode.toUpperCase());
        }
        log.info("================================================");
    }

    @PreDestroy
    public void testBeanDestroy()
    {
        log.info("================================================");
        log.info("PreDestroy메서드 실행");
        log.info("================================================");
    }

    public static String getCurrentTaskName() {
        return "task" + taskIndex;
    }

    public void saveToTaskFolder(String taskName, String status, String msg) {
        // 1. 프로젝트 루트 경로 내에 'logs/task1' 또는 'logs/task2' 경로 설정
        String projectPath = System.getProperty("user.dir");
        Path directoryPath = Paths.get(projectPath, "logs", taskName);
        Path filePath = directoryPath.resolve("messages.log");

        try {
            // 2. 폴더가 없으면 자동으로 생성 (부모 폴더까지 포함)
            if (Files.notExists(directoryPath)) {
                Files.createDirectories(directoryPath);
            }

            // 3. 기록할 내용 구성 (시간 - 상태 - 메시지)
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            String content = String.format("[%s] [%s] %s%n", timestamp, status, msg);

            // 4. 파일 쓰기 (없으면 생성, 있으면 이어붙이기)
            Files.write(filePath,
                    content.getBytes(),
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND);

        } catch (IOException e) {
            // 여기서는 log.error를 사용해 콘솔에 남깁니다.
            System.err.println("파일 저장 실패: " + e.getMessage());
        }
    }


}
