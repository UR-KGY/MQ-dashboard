package kgy.mq.nats;

import io.nats.client.Connection;
import kgy.mq.MqCounterMetrics;
import kgy.mq.MqProducer;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
@RefreshScope
public class NatsProducer implements MqProducer
{
    private final Connection natsConnection;
    private final MqCounterMetrics counterMetrics;

    @Value("${mq.queue-name}")
    private String subject;

    public void send(String message)
    {
        try
        {
            natsConnection.publish(subject, message.getBytes(StandardCharsets.UTF_8));
            counterMetrics.incrementCounter("nats","none");
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}