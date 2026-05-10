package kgy.mq.redis;

import kgy.mq.MqCounterMetrics;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;



@RequiredArgsConstructor
public class RedisPubSubProducer implements RedisProducer {
    private final RedisTemplate<String, Object> redisTemplate;
    private final ChannelTopic commonTopic; // Config에서 생성한 Topic 빈
    private final MqCounterMetrics counterMetrics;

    @Override
    public void send(String message)
    {
        try
        {
            redisTemplate.convertAndSend(commonTopic.getTopic(), message);
            counterMetrics.incrementCounter("redis","pubsub");
        }
        catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
