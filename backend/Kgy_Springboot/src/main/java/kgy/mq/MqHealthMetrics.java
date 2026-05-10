package kgy.mq;

import com.github.benmanes.caffeine.cache.Cache;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class MqHealthMetrics {

    // 생성자 주입을 통해 MeterRegistry(지표 등록기)와 기존 캐시 빈을 가져옵니다.
    public MqHealthMetrics(MeterRegistry registry, Cache<Long, String> messageBuffer) {

        // 1. 버퍼 상태 지표 등록
        // "mq_buffer_size"라는 이름으로 캐시의 현재 크기를 실시간 추적합니다.
        Gauge.builder("mq_buffer_size", messageBuffer, Cache::estimatedSize)
                .description("Number of messages waiting in memory buffer")
                .register(registry);

        // 2. 시스템 건강 상태 지표 등록
        // "mq_system_status"라는 이름으로 현재 상태(1 또는 0)를 추적합니다.
        Gauge.builder("mq_system_status", () -> MasterConfig.isSystemHealthy ? 1 : 0)
                .description("Current system health (1: Healthy, 0: Error)")
                .register(registry);

        // 3. 현재 폴더 인덱스 (옵션)
        Gauge.builder("mq_task_index", () -> MasterConfig.taskIndex)
                .register(registry);
    }
}