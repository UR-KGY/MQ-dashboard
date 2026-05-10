package kgy.mq.nats;

import io.nats.client.Connection;
import io.nats.client.Nats;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;


@RefreshScope
public class NatsConfig {
    //application 파일 안의 정보 가져옴
    @Value("${spring.nats.server}")
    private String serverUrl;

    //빈 객체(싱글톤) 으로 등록하여 실행중 참조
    @Bean
    public Connection natsConnection() throws Exception {
        return Nats.connect(serverUrl);
    }
}