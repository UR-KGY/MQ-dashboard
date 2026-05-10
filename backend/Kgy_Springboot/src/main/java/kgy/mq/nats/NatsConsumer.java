package kgy.mq.nats;

import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@RefreshScope
public class NatsConsumer {

    public NatsConsumer(Connection natsConnection) throws Exception {
        // 'my-subject'라는 주제(Topic)를 구독
        Dispatcher dispatcher = natsConnection.createDispatcher((msg) -> {
            String response = new String(msg.getData(), StandardCharsets.UTF_8);
            System.out.println("Received from NATS: " + response);
        });

        dispatcher.subscribe("my-subject");
    }
}