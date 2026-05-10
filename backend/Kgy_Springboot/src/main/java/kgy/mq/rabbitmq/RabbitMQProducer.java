package kgy.mq.rabbitmq;

import kgy.mq.MqCounterMetrics;
import kgy.mq.MqProducer;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@RefreshScope
public class RabbitMQProducer implements MqProducer
{
    private final Queue myDynamicQueue;
    private final RabbitTemplate rabbitTemplate;
    private final MqCounterMetrics counterMetrics;

    public void send(String message)
    {
        try
        {
            rabbitTemplate.convertAndSend(myDynamicQueue.getName(),message);
            counterMetrics.incrementCounter("rabbitmq","none");
        }
        catch (Exception e)
        {
            throw new RuntimeException(e);
        }
    }
}
