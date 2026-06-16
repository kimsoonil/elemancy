async function boot() {
  const [recipes, enemies] = await Promise.all([
    fetch('data/recipes.json').then((r) => r.json()),
    fetch('data/enemies.json').then((r) => r.json()),
  ]);
  const alchemy = new Alchemy(recipes);
  const waveSystem = new WaveSystem(enemies);
  const game = new Game({ alchemy, waveSystem });

  // 정사각 순환 경로 (격자 단위). 캔버스 640px = 10칸.
  game.path = [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }];

  // 디버그/플레이테스트용: 콘솔에서 game 상태 점검 가능
  window.game = game;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const combinePanel = document.getElementById('combinePanel');

  document.getElementById('nextWave').onclick = () => game.startWave();

  canvas.onclick = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const gx = Math.round((ev.clientX - rect.left) / 64);
    const gy = Math.round((ev.clientY - rect.top) / 64);
    if (gx <= 1 || gx >= 9 || gy <= 1 || gy >= 9) return; // 안쪽만
    const benchId = Object.keys(game.bench)[0];
    if (benchId) game.place(benchId, { x: gx, y: gy });
  };

  function renderCombine() {
    const owned = game.ownedCounts();
    combinePanel.innerHTML = '';
    const craftable = game.alchemy.craftable(owned);
    if (craftable.length === 0) {
      combinePanel.innerHTML = '<span class="muted">조합할 재료가 부족합니다</span>';
      return;
    }
    for (const id of craftable) {
      const btn = document.createElement('button');
      btn.textContent = `${game.alchemy.name(id)} 조합`;
      btn.onclick = () => game.combine(id);
      combinePanel.appendChild(btn);
    }
  }

  let last = performance.now();
  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    game.update(dt);
    drawGame(ctx, game);
    hud.innerHTML = renderHud(game);
    renderCombine();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
boot();
