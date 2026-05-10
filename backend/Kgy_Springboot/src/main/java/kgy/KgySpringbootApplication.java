package kgy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;


@EnableScheduling // 메세징 큐의 Consumer가 자동으로 메세지를 가져오기 위함.
@SpringBootApplication
public class KgySpringbootApplication
{
    public static void main(String[] args) {
        SpringApplication.run(KgySpringbootApplication.class, args);
    }
}

//todo: rabbitmq, nats, redis 등 메세징 큐를 구현하였던 것들을 스프링부트와 연동