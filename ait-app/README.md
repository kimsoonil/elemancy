# Elemancy — 앱인토스(App-in-Toss) 래퍼

무의존성 바닐라 Canvas 게임(레포 루트 `index.html` + `src/` + `data/`)을 **그대로** 앱인토스 미니앱으로 패키징하는 래퍼입니다. 게임 로직은 수정하지 않고, 전체화면 `<iframe>`으로 띄웁니다.

- 스택: Vite + React 18 + `@apps-in-toss/web-framework` (granite / ait CLI)
- 표시명 **엘레맨시**, appName `elemancy`
- 게임 본체는 `public/game/`(gitignore) — `scripts/sync-game.mjs`가 레포 루트의 `index.html`·`src`·`data`를 복사해 생성. 단일 소스 = 레포 루트.

## 명령어

```bash
cd ait-app
npm install

npm run dev      # sync 후 granite dev (localhost:5173)
npm run sync     # 게임 자산을 public/game 으로 재복사(게임 수정 후)
npm run build    # sync 후 ait build → elemancy.ait + dist/ 생성
npm run deploy   # ait deploy (콘솔 로그인 필요)
```

`predev`/`prebuild`가 자동으로 `sync`를 실행하므로, 게임을 수정했으면 `npm run dev`/`npm run build`만 다시 돌리면 반영됩니다.

## 출시 전 남은 작업

- [ ] **모바일 세로/터치 적응** — 현재 게임 UI는 가로 데스크톱용. 세로 WebView(~380px)에선 토스바/패널이 뭉개짐. 반응형 portrait 레이아웃 + 터치 입력 필요.
- [ ] **앱 아이콘** — `granite.config.ts`의 `brand.icon` 비어있음(출시 필수).
- [ ] **앱인토스 콘솔 등록** — `apps-in-toss.toss.im`에서 앱 등록 → `.ait` 업로드 → QR 기기 테스트 → 검토(최대 3영업일). 사업자 등록(또는 무사업자 출시 옵션) 확인.
- [ ] 토스 네이티브 네비게이션 바 설정.
