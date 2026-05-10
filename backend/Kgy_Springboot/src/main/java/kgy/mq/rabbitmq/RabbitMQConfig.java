package kgy.mq.rabbitmq;

import org.springframework.amqp.core.Queue;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@RefreshScope
public class RabbitMQConfig
{
    @Value("${mq.queue-name}")
    private String queueName;

    @Bean
    public Queue myDynamicQueue() {
        return new Queue(queueName, false);
    }
}
