package kgy.mq;


import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import org.springframework.stereotype.Component;

@Component
public class MqCounterMetrics {
    private final MeterRegistry registry;

    public MqCounterMetrics(MeterRegistry registry) {
        this.registry = registry; // Counter 변수들을 지우고 registry만 저장합니다.
    }

    public void incrementCounter(String type, String mode) {
        Metrics.counter("mq_transaction_total",
                "application", "my-mq-project",
                "type", type,
                "mode", mode // 모든 호출에서 'mode' 키를 고정적으로 사용하세요!
        ).increment();
    }
}