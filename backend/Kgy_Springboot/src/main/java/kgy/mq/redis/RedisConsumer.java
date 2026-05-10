package kgy.mq.redis;

public interface RedisConsumer
{
    void handleMessage(String message);
}
