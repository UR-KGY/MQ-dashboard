package kgy.mq.redis;

import kgy.mq.MqCounterMetrics;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;



@RequiredArgsConstructor
public class RedisListProducer implements RedisProducer {
    private final RedisTemplate<String, Object> redisTemplate;
    private final String redisDestination;
    private final MqCounterMetrics counterMetrics;

    @Override
    public void send(String message) {
        try
        {
            redisTemplate.opsForList().leftPush(redisDestination, message);
            counterMetrics.incrementCounter("redis","list");
        }
        catch (Exception e)
        {
            throw new RuntimeException(e);
        }
    }
}