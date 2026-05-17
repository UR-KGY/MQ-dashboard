# [블로그 기록] 실시간 MQ 스위칭 시스템 구축 시도와 시행착오 (Spring Boot & React)

## 1. 프로젝트 배경
사용자가 대시보드(React)에서 버튼 하나만 누르면 백엔드(Spring Boot)에서 사용하는 메시지 큐(Redis, RabbitMQ, NATS)를 실시간으로 교체하는 시스템을 구축하고자 함.

## 2. 1차 시도: `application.yml` 직접 수정 방식
### 접근 방식
- 백엔드가 API 요청을 받으면 물리적인 `src/main/resources/application.yml` 파일 내용을 정규표현식으로 찾아 `mq.type` 값을 변경.
- `@RefreshScope`와 `ContextRefresher`를 이용해 애플리케이션 재시작 없이 변경된 설정을 주입.

### 🛑 마주한 문제들 (Troubleshooting)

#### 문제 1: 404 API Not Found
- **원인**: 프론트엔드(`Vite`) 개발 서버의 Proxy 설정 누락. 새로 만든 `/api/config` 엔드포인트를 백엔드로 전달하지 못함.
- **해결**: `vite.config.js`에 프록시 경로 추가.

#### 문제 2: 경로 중복 및 파일 접근 에러
- **원인**: `System.getProperty("user.dir")`를 사용해 파일 경로를 계산했으나, 서버 실행 위치(프로젝트 루트 vs 백엔드 폴더)에 따라 실제 경로가 꼬임.
- **해결**: `ClassPathResource`를 사용하여 실행 시점의 `target/classes` 경로를 찾도록 수정.

#### 문제 3: YAML 파싱 에러 (Found duplicate key / mapping values not allowed)
- **원인**: 자바 코드로 파일을 쓰고 읽는 과정에서 개행 문자(`\n`) 처리가 미흡하여 YAML의 들여쓰기 구조가 파괴됨.
- **결과**: 설정 파일이 깨지면서 서버 기동 자체가 불가능해지는 치명적 장애 발생.

## 3. 회고 및 새로운 전략 수립
### 왜 실패했는가?
1. **텍스트 조작의 취약성**: 설정 파일은 계층 구조이므로 단순 텍스트 매칭으로 수정하는 것은 매우 위험함.
2. **배포 환경 고려 부족**: `.jar` 파일로 패키징된 후에는 내부의 `application.yml`을 수정할 수 없으므로 확장이 불가능한 방식임.

### 새로운 해결책: 객체 지향 다형성 활용 (Refactoring)
물리적인 파일을 수정하는 대신, **메모리 상에서 실행 중인 서비스 객체를 동적으로 교체**하는 방식으로 전환.

- **Interface (`MqService`)**: 공통 전송 메서드 정의.
- **Implementation**: Redis, Rabbit, Nats 각각의 서비스 구현.
- **Manager (`MqManager`)**: 현재 사용할 서비스 인스턴스를 관리하고 실시간으로 스위칭해주는 역할 수행.


vite slide v 마크다운 - > 슬라이더 ppt 
e000.bond   클로드 ai  캡처 업로드 netilify(무료 도메인)

landing 페이지를 이미지 처럼 만들어주고 샘플하나 
