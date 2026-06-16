async function boot() {
  const [recipes, enemies] = await Promise.all([
    fetch('data/recipes.json').then((r) => r.json()),
    fetch('data/enemies.json').then((r) => r.json()),
  ]);
  const alchemy = new Alchemy(recipes);
  const waveSystem = new WaveSystem(enemies);

  // 빌드 가능한 안쪽 칸(자동 배치 슬롯): 경로 안쪽 7×7
  const slots = [];
  for (let x = 2; x <= 8; x++) for (let y = 2; y <= 8; y++) slots.push({ x, y });
  const game = new Game({ alchemy, waveSystem, slots });

  // 정사각 순환 경로 (격자 단위)
  game.path = [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }];

  // 디버그/플레이테스트용
  window.game = game;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const waveInfo = document.getElementById('waveInfo');
  const resourceInfo = document.getElementById('resourceInfo');
  const selectedPanel = document.getElementById('selectedPanel');
  const upgradePanel = document.getElementById('upgradePanel');
  const gamblePanel = document.getElementById('gamblePanel');
  const gachaPanel = document.getElementById('gachaPanel');
  const tokenPanel = document.getElementById('tokenPanel');
  const logEl = document.getElementById('log');
  const topRound = document.getElementById('topRound');
  const topTimer = document.getElementById('topTimer');

  function flash(msg, kind) {
    logEl.textContent = msg;
    logEl.className = 'log' + (kind ? ' ' + kind : '');
  }

  // 캔버스를 뷰포트(가로 스테이지 폭 / 세로 높이)에 맞춰 정사각으로 스케일 → 스크롤 방지
  function fitCanvas() {
    const stage = canvas.parentElement;
    const size = Math.max(220, Math.min(stage.clientWidth - 16, window.innerHeight - 120));
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
  }
  window.addEventListener('resize', fitCanvas);

  // 📜 조합식 팝업
  const recipeModal = document.getElementById('recipeModal');
  let recipesBuilt = false;
  function buildRecipes() {
    if (recipesBuilt) return; recipesBuilt = true;
    const byTier = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const e of recipes.elements) byTier[1].push(e);
    for (const r of recipes.recipes) byTier[r.tier].push(r);
    const tierName = { 1: '1단계 · 기본 원소', 2: '2단계', 3: '3단계', 4: '4단계', 5: '5단계 · 천체' };
    let html = '';
    for (let t = 1; t <= 5; t++) {
      html += `<div class="tier-block"><h3>${tierName[t]}</h3><div class="recipe-grid">`;
      for (const u of byTier[t]) {
        const ing = u.inputs ? u.inputs.map((id) => alchemy.name(id)).join(' + ') : '기본 원소';
        html += `<div class="recipe"><div class="res">${alchemy.name(u.id)}</div><div class="ing">${ing}</div></div>`;
      }
      html += '</div></div>';
    }
    document.getElementById('recipeBody').innerHTML = html;
  }
  document.getElementById('recipeBtn').onclick = () => { buildRecipes(); recipeModal.classList.remove('hidden'); };
  document.getElementById('recipeClose').onclick = () => recipeModal.classList.add('hidden');
  recipeModal.onclick = (e) => { if (e.target === recipeModal) recipeModal.classList.add('hidden'); };

  document.getElementById('nextWave').onclick = () => game.startWave();

  // 랜덤 유닛 뽑기
  const drawBtn = document.getElementById('drawBtn');
  drawBtn.onclick = () => {
    const id = game.drawRandomUnit();
    flash(id ? `랜덤 획득: ${alchemy.name(id)}` : '골드 부족', id ? 'good' : 'bad');
  };

  // 보드 클릭 → 유닛 선택 / (이동 모드면) 이동
  canvas.onclick = (ev) => {
    const rect = canvas.getBoundingClientRect();
    // 캔버스가 CSS로 스케일되므로 내부 해상도 기준으로 환산
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const gx = Math.round((ev.clientX - rect.left) * sx / TILE);
    const gy = Math.round((ev.clientY - rect.top) * sy / TILE);
    const hit = game.towers.find((t) => Math.round(t.x) === gx && Math.round(t.y) === gy);
    if (game.moveMode && game.selectedUid) {
      const inside = gx > 1 && gx < 9 && gy > 1 && gy < 9;
      if (inside && !hit) { game.moveTower(game.selectedUid, { x: gx, y: gy }); game.moveMode = false; }
      return;
    }
    game.selectedUid = hit ? hit.uid : null;
    game.moveMode = false;
  };

  const ATK_LABEL = { aoe: '광역', single: '단일', slow: '둔화', buff: '버프' };

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
    // 랜덤 뽑기
    drawBtn.innerHTML = `<span>랜덤 원소 1개</span><span class="cost">${CONFIG.RANDOM_DRAW_COST}G</span>`;
    drawBtn.disabled = game.gold < CONFIG.RANDOM_DRAW_COST;
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

  // ── 동적 패널: 상태가 바뀔 때만 다시 그린다(매 프레임 재생성 시 클릭이 씹힘) ──
  let tokSig = null;
  function renderTokens() {
    const sig = String(game.bossTokens);
    if (sig === tokSig) return;
    tokSig = sig;
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

  let selSig = null;
  function renderSelected() {
    const sel = game.towers.find((t) => t.uid === game.selectedUid);
    // 이 유닛이 재료로 들어가는, 지금 만들 수 있는 조합
    const craftable = sel ? new Set(game.alchemy.craftable(game.ownedCounts())) : null;
    const uses = sel ? game.alchemy.usages(sel.unitId).filter((id) => craftable.has(id)) : [];
    // 변경이 없으면 다시 그리지 않음(매 프레임 재생성 시 버튼 클릭이 씹힘)
    const sig = `${sel ? sel.uid : ''}|${sel ? sel.unitId : ''}|${game.moveMode}|${uses.join(',')}`;
    if (sig === selSig) return;
    selSig = sig;

    selectedPanel.innerHTML = '';
    if (!sel) {
      selectedPanel.innerHTML = '<span class="muted">보드의 유닛을 클릭하면 이동·조합할 수 있어요</span>';
      return;
    }
    const info = document.createElement('div');
    info.className = 'hud-row';
    info.innerHTML = `<b>${alchemy.name(sel.unitId)}</b><span class="muted">T${sel.tier} · ${ATK_LABEL[sel.atkType] || ''}</span>`;
    selectedPanel.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'btn-row';
    const moveBtn = document.createElement('button');
    moveBtn.className = 'mini';
    moveBtn.textContent = game.moveMode ? '🔀 이동할 칸 클릭…' : '🔀 이동';
    moveBtn.onclick = () => { game.moveMode = !game.moveMode; };
    actions.appendChild(moveBtn);
    selectedPanel.appendChild(actions);

    if (uses.length) {
      const row = document.createElement('div');
      row.className = 'btn-row';
      for (const id of uses) {
        const b = document.createElement('button');
        b.className = 'mini';
        b.textContent = `${alchemy.name(id)} 조합`;
        b.onclick = () => { if (game.combine(id)) flash(`조합 완성: ${alchemy.name(id)}`, 'good'); };
        row.appendChild(b);
      }
      selectedPanel.appendChild(row);
    } else {
      const m = document.createElement('div');
      m.className = 'muted'; m.style.marginTop = '6px';
      m.textContent = '이 유닛으로 지금 만들 수 있는 조합이 없어요';
      selectedPanel.appendChild(m);
    }
  }

  let last = performance.now();
  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    game.update(dt);
    fitCanvas();
    drawGame(ctx, game);
    topRound.textContent = game.wave;
    topTimer.textContent = game.wave >= CONFIG.MAX_WAVE ? '—' : Math.max(0, Math.ceil(game.roundTimer));
    waveInfo.innerHTML = renderWaveInfo(game);
    resourceInfo.innerHTML = renderResources(game);
    hud.innerHTML = renderHud(game);
    updateEconomy();
    renderTokens();
    renderSelected();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
boot();
