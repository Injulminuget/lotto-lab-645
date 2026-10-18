# LOTTO LAB · 로또 6/45 기록 연구소

갤럭시 모바일 화면에 최적화한 개인용 과거 로또 통계 분석 PWA입니다.

## 웹앱 주소
GitHub Pages가 활성화되면 다음 주소에서 접속할 수 있습니다.

https://injulminuget.github.io/lotto-lab-645/

## GitHub Pages 설정 (최초 한 번)
저장소의 **Settings → Pages → Build and deployment**에서 다음과 같이 설정합니다.

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/(root)**
- **Save**를 누릅니다.

몇 분 뒤 위 주소가 열리면 갤럭시 Chrome 또는 삼성 인터넷의 메뉴에서 홈 화면에 추가하면 됩니다.

## 기능
- 최근 30 / 100 / 300회 및 전체 기록 비교
- 출현 빈도, 번호별 미출현 간격, 홀짝·합계·연속번호·구간 통계
- 회차 검색, CSV/JSON 가져오기, CSV 내보내기
- 오프라인 앱 화면 및 브라우저 저장소 지원

## 데이터 안내
처음에는 최근 5개 회차(1242~1246회)가 포함됩니다. 전체 당첨 기록은 앱의 **데이터** 탭에서 **인터넷에서 전체 기록 갱신**을 누르면 공개 자료 제공처를 통해 받아옵니다. 원격 제공처의 CORS 정책 등에 따라 자동 가져오기가 실패할 수 있으므로 CSV/JSON 파일 가져오기 기능도 제공합니다.

- 과거 출현 빈도는 미래 당첨 확률을 높이지 않습니다.
- 공식 당첨 결과는 반드시 [동행복권](https://www.dhlottery.co.kr/)에서 확인하세요.
- 본 앱은 동행복권과 무관한 개인 비공식 도구입니다.
- 데이터는 별도 계정/서버가 아니라 기기 브라우저의 localStorage에 저장됩니다. 필요 시 CSV로 백업하세요.

## 파일
- `index.html` — UI
- `styles.css` — 모바일 최적화 스타일
- `app.js` — 분석·데이터 검증
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA 설치 및 오프라인 캐시
