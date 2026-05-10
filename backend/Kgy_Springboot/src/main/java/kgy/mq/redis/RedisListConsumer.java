package kgy.mq.redis;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;



@RequiredArgsConstructor
public class RedisListConsumer implements RedisConsumer {
    private final RedisTemplate<String, Object> redisTemplate;
    private final String redisDestination; // Config에서 등록한 공통 목적지 빈

    @Scheduled(fixedDelay = 100) // 0.1초마다 체크
    public void poll() {
        Object message = redisTemplate.opsForList().rightPop(redisDestination);
        if (message != null) {
            handleMessage(message.toString());
        }
    }

    @Override
    public void handleMessage(String message) {
        System.out.println("[LIST 수신 완료]: " + message);
        // 여기서 파일 쓰기 로직 실행
    }
}