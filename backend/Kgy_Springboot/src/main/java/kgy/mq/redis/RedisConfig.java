package kgy.mq.redis;

import kgy.mq.MqCounterMetrics;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@RequiredArgsConstructor
@RefreshScope
public class RedisConfig
{
    private final Environment environment; //application.yml의 설정을 가져오기 위한 변수


    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // Key는 String으로 시리얼라이즈
        template.setKeySerializer(new StringRedisSerializer());
        // Value는 JSON 형태로 시리얼라이즈 (Object를 담기 위해)
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());

        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());

        return template;
    }

    @Bean
    @RefreshScope
    public RedisProducer currentRedisProducer(
            RedisListProducer listProducer,
            RedisPubSubProducer pubSubProducer) {

        // 이 값은 @RefreshScope 덕분에 실시간으로 갱신됨
        String mode = environment.getProperty("mq.redis-mode", "list");

        if ("list".equalsIgnoreCase(mode)) {
            return listProducer;
        } else {
            return pubSubProducer;
        }
    }

    @Bean
    @RefreshScope // 설정값이 바뀌면 이 빈만 새로 생성됩니다.
    public RedisListConsumer redisListConsumer(RedisTemplate<String, Object> redisTemplate) {
        // @RequiredArgsConstructor가 만든 생성자를 여기서 사용하여 수동으로 등록합니다.
        return new RedisListConsumer(redisTemplate, environment.getProperty("mq.queue-name", "default-queue"));
    }

    @Bean
    @RefreshScope // 설정값이 바뀌면 이 빈만 새로 생성됩니다.
    public RedisListProducer redisListProducer(RedisTemplate<String, Object> redisTemplate ,MqCounterMetrics counterMetrics ) {
        // @RequiredArgsConstructor가 만든 생성자를 여기서 사용하여 수동으로 등록합니다.
        return new RedisListProducer(redisTemplate, environment.getProperty("mq.queue-name", "default-queue"),counterMetrics);
    }

    @Bean
    @RefreshScope // 설정값이 바뀌면 이 빈만 새로 생성됩니다.
    public RedisPubSubConsumer redisPubSubConsumer(RedisTemplate<String, Object> redisTemplate) {
        // @RequiredArgsConstructor가 만든 생성자를 여기서 사용하여 수동으로 등록합니다.
        return new RedisPubSubConsumer();
    }

    @Bean
    @RefreshScope // 설정값이 바뀌면 이 빈만 새로 생성됩니다.
    public RedisPubSubProducer redisPubSubProducer(RedisTemplate<String, Object> redisTemplate,MqCounterMetrics counterMetrics) {
        // @RequiredArgsConstructor가 만든 생성자를 여기서 사용하여 수동으로 등록합니다.
        return new RedisPubSubProducer(redisTemplate,commonTopic(),counterMetrics);
    }


    // 1. 공통으로 사용할 목적지 이름 (String)
    @Bean
    public String redisDestination() {
        // 필드 대신 environment에서 직접 꺼내서 반환합니다.
        return environment.getProperty("mq.queue-name", "default-queue");
    }

    // 2. Pub/Sub에서 사용할 Topic 객체 (String 기반으로 생성)
    @Bean
    public ChannelTopic commonTopic()
    {
        return new ChannelTopic(environment.getProperty("mq.queue-name", "default-queue"));
    }

    // ... 나머지 Serializer 및 Container 설정

    @Bean
    @RefreshScope
    public RedisMessageListenerContainer redisContainer(RedisConnectionFactory factory, MessageListenerAdapter adapter, ChannelTopic topic)
    {
        String mode = environment.getProperty("mq.redis-mode", "list");
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);

        // pubsub 모드일 때만 리스너를 추가합니다.
        if ("pubsub".equalsIgnoreCase(mode))
        {
            container.addMessageListener(adapter, topic);
        }

        return container;
    }

    @Bean
    @RefreshScope
    public MessageListenerAdapter listenerAdapter(RedisPubSubConsumer consumer) {
        // PubSubConsumer의 handleMessage 메서드와 연결
        return new MessageListenerAdapter(consumer, "handleMessage");
    }


}