package kgy.mq.rabbitmq;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Component;

@Component
@RefreshScope
public class RabbitMQConsumer
{
    @RabbitListener(queues = "#{@myDynamicQueue.name}") //해결요망
    public void receiveMessage(String message) {
        System.out.println("Received from RabbitMQ: " + message);
    }
}
