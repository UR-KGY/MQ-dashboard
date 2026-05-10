package kgy.mq;

public interface MqProducer
{
    void send(String message);
    // 필요하다면 공통으로 사용할 메서드를 더 추가할 수 있습니다.
    // void sendTo(String destination, String message);
}