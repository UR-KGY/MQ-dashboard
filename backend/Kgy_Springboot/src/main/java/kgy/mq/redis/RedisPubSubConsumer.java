package kgy.mq.redis;



public class RedisPubSubConsumer implements RedisConsumer {

    @Override
    public void handleMessage(String message) {
        System.out.println("[PUB/SUB 수신 완료]: " + message);
        // 여기서 파일 쓰기 로직 실행
    }
}