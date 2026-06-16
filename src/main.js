async function boot() {
  const [recipes, enemies] = await Promise.all([
    fetch('data/recipes.json').then((r) => r.json()),
    fetch('data/enemies.json').then((r) => r.json()),
  ]);
  const alchemy = new Alchemy(recipes);
  const waveSystem = new WaveSystem(enemies);
  const game = new Game({ alchemy, waveSystem });

  // 정사각 순환 경로 (격자 단위)
  game.path = [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }];

  // 디버그/플레이테스트용
  window.game = game;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const waveInfo = document.getElementById('waveInfo');
  const resourceInfo = document.getElementById('resourceInfo');
  const combinePanel = document.getElementById('combinePanel');
  const upgradePanel = document.getElementById('upgradePanel');
  const gamblePanel = document.getElementById('gamblePanel');
  const gachaPanel = document.getElementById('gachaPanel');
  const tokenPanel = document.getElementById('tokenPanel');
  const logEl = document.getElementById('log');

  function flash(msg, kind) {
    logEl.textContent = msg;
    logEl.className = 'log' + (kind ? ' ' + kind : '');
  }

  document.getElementById('nextWave').onclick = () => game.startWave();

  // 보드 클릭 → 벤치 첫 원소 배치
  canvas.onclick = (ev) => {
    const rect = canvas.getBoundingClientRect();
    // 캔버스가 CSS로 스케일되므로 내부 해상도 기준으로 환산
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const gx = Math.round((ev.clientX - rect.left) * sx / TILE);
    const gy = Math.round((ev.clientY - rect.top) * sy / TILE);
    if (gx <= 1 || gx >= 9 || gy <= 1 || gy >= 9) return; // 안쪽만
    const benchId = Object.keys(game.bench)[0];
    if (benchId) game.place(benchId, { x: gx, y: gy });
  };

  // ── 골드 사용 컨트롤 (한 번만 생성, 라벨/활성은 매 프레임 갱신) ──
  const tier1 = alchemy.byTier(1).map((u) => u.id);

  // 공격력 업그레이드 (T1~T5)
  const upBtns = [];
  for (let tier = 1; tier <= 5; tier++) {
    const b = document.createElement('button');
    b.className = 'mini';
    b.onclick = () => {
      const ok = game.upgrade(tier);
      flash(ok ? `T${tier} 공격력 +1% (Lv ${game.upgrades[tier]})` : '골드 부족', ok ? 'good' : 'bad');
    };
    upgradePanel.appendChild(b);
    upBtns.push(b);
  }

  // 도박
  const gambleBtns = [];
  for (const bet of CONFIG.GAMBLE_BETS) {
    const b = document.createElement('button');
    b.className = 'mini';
    b.onclick = () => {
      const net = game.gamble(bet);
      if (net === false) { flash('골드 부족', 'bad'); return; }
      flash(`도박 ${net >= 0 ? '+' : ''}${net} 골드`, net >= 0 ? 'good' : 'bad');
    };
    b.textContent = `🎲 ${bet}`;
    gamblePanel.appendChild(b);
    gambleBtns.push({ b, bet });
  }

  // 가챠 (1·2·3티어)
  const gachaBtns = [];
  for (const tier of [1, 2, 3]) {
    const b = document.createElement('button');
    b.className = 'mini';
    b.onclick = () => {
      const res = game.gacha(tier);
      if (res.reason === 'gold') { flash('골드 부족', 'bad'); return; }
      flash(res.success ? `획득: ${alchemy.name(res.id)}` : `${tier}티어 가챠 꽝...`, res.success ? 'good' : 'bad');
    };
    gachaPanel.appendChild(b);
    gachaBtns.push({ b, tier });
  }

  function updateEconomy() {
    // 업그레이드
    for (let i = 0; i < 5; i++) {
      const tier = i + 1, lvl = game.upgrades[tier];
      const cost = CONFIG.UPGRADE_COST(tier, lvl);
      const maxed = lvl >= CONFIG.UPGRADE_MAX_LEVEL;
      upBtns[i].innerHTML = `<span>T${tier} 공격력 · Lv ${lvl}</span><span class="cost">${maxed ? 'MAX' : cost + 'G'}</span>`;
      upBtns[i].disabled = maxed || game.gold < cost;
    }
    // 도박
    for (const { b, bet } of gambleBtns) b.disabled = game.gold < bet;
    // 가챠
    for (const { b, tier } of gachaBtns) {
      const g = CONFIG.GACHA[tier];
      b.innerHTML = `<span>${tier}티어 뽑기 · ${Math.round(g.rate * 100)}%</span><span class="cost">${g.cost}G</span>`;
      b.disabled = game.gold < g.cost;
    }
  }

  // ── 매 프레임 새로 그리는 동적 패널 ──
  function renderTokens() {
    tokenPanel.innerHTML = '';
    if (game.bossTokens <= 0) {
      tokenPanel.innerHTML = '<span class="muted">보스를 잡으면 원하는 원소를 받을 수 있어요</span>';
      return;
    }
    const row = document.createElement('div');
    row.className = 'btn-row';
    for (const id of tier1) {
      const b = document.createElement('button');
      b.className = 'mini';
      b.textContent = alchemy.name(id);
      b.onclick = () => { if (game.redeemToken(id)) flash(`원소 선택권 사용 → ${alchemy.name(id)}`, 'good'); };
      row.appendChild(b);
    }
    tokenPanel.appendChild(row);
  }

  function renderCombine() {
    combinePanel.innerHTML = '';
    const craftable = game.alchemy.craftable(game.ownedCounts());
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
    waveInfo.innerHTML = renderWaveInfo(game);
    resourceInfo.innerHTML = renderResources(game);
    hud.innerHTML = renderHud(game);
    updateEconomy();
    renderTokens();
    renderCombine();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
boot();
