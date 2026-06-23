/**
 * 앱인토스 래퍼 — 무의존성 바닐라 Canvas 게임(public/game/index.html)을
 * 전체화면 iframe으로 그대로 띄운다. 게임 코드는 변경 없이 실행된다.
 * (모바일 세로/터치 적응은 후속 작업)
 */
function App() {
  return (
    <iframe
      title="Elemancy"
      src="/game/index.html"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}

export default App;
