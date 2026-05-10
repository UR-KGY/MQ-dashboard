package kgy.helper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cloud.context.refresh.ContextRefresher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.*;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class ConfigWatcher {

    private final ContextRefresher contextRefresher;

    // 애플리케이션이 완전히 구동된 후 감시 시작
    @EventListener(ApplicationReadyEvent.class)
    public void startWatching() {
        // 별도 스레드에서 실행하여 메인 로직 방해 금지
        Thread watchThread = new Thread(() -> {
            try {
                URL resourceUrl = Thread.currentThread().getContextClassLoader().getResource("application.yml");

                if (resourceUrl != null) {
                    log.info(">>> [디버그] 클래스로더가 찾은 파일 URL: {}", resourceUrl);

                    // 실제 파일 시스템 경로로 변환된 모습 확인
                    Path path = Paths.get(resourceUrl.toURI());
                    log.info(">>> [디버그] 실제 감시 대상 절대 경로: {}", path.toAbsolutePath());
                    log.info(">>> [디버그] 감시할 부모 디렉토리: {}", path.getParent().toAbsolutePath());
                } else {
                    log.error(">>> [디버그] 클래스패스에서 application.yml을 찾지 못했습니다!");

                    // 클래스로더가 뒤지고 있는 전체 경로(Classpath) 목록 확인
                    URL[] urls = ((URLClassLoader) Thread.currentThread().getContextClassLoader()).getURLs();
                    for (URL url : urls) {
                        log.info(">>> [디버그] 현재 탐색 중인 Classpath: {}", url);
                    }
                }

                // 2. URL을 URI로 변환 후, 실제 파일 시스템의 Path 객체로 변환합니다.
                // 폴더를 감시해야 하므로 .getParent()를 통해 상위 디렉토리를 가져옵니다.
                Path configFilePath = Paths.get(resourceUrl.toURI());
                Path watchPath = configFilePath.getParent();

                WatchService watchService = FileSystems.getDefault().newWatchService();

//                Thread.currentThread().getContextClassLoader().getResource()    이것으로 변경 todo



                // 수정(ENTRY_MODIFY) 이벤트 등록
                watchPath.register(watchService, StandardWatchEventKinds.ENTRY_MODIFY);

                log.info(">>> 파일 감시 시작: {}", watchPath.toAbsolutePath());

                while (true) {
                    WatchKey key = watchService.take(); // 이벤트가 올 때까지 스레드 대기 (Blocking)
                    for (WatchEvent<?> event : key.pollEvents()) {
                        Path changed = (Path) event.context();

                        // application.yml 파일이 바뀌었는지 확인
                        if (changed.toString().contains("application.yml")) {
                            log.info(">>> 설정 파일 변경 감지! 리프레시를 시작합니다.");

                            // ContextRefresher 호출
                            Set<String> refreshedKeys = contextRefresher.refresh();
                            log.info(">>> 리프레시 완료된 키: {}", refreshedKeys);
                        }
                    }
                    if (!key.reset()) break;
                }
            } catch (Exception e) {
                log.error("파일 감시 중 오류 발생", e);
            }
        });
        watchThread.setDaemon(true); // 애플리케이션 종료 시 함께 종료
        watchThread.start();
    }
}