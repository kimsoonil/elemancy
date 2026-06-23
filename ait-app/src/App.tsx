/**
 * 앱인토스 래퍼 — 무의존성 바닐라 Canvas 게임(public/game/index.html)을 iframe으로 띄운다.
 * 데스크톱에서는 폰 크기(≈390px) 프레임 안에 넣어 실제 앱인토스 모바일 WebView 화면을 그대로 보여주고,
 * 실제 모바일(좁은 화면)에서는 프레임 없이 전체화면으로 채운다. 게임 코드는 변경하지 않는다.
 */
function App() {
  return (
    <div className="ait-stage">
      <div className="ait-phone">
        <iframe title="Elemancy" src="/game/index.html" />
      </div>
    </div>
  );
}

export default App;
