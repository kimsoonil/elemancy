const TILE = 52; // 1 격자 단위 = 52px (보드+패널이 한 화면에 들어오도록)

// 공격 타입별 네온 색
const TYPE_COLOR = { aoe: '#ff6a3d', single: '#7b8cff', slow: '#3fd7ff', buff: '#5cf08a' };
const TYPE_ICON = { aoe: '💥', single: '🎯', slow: '❄️', buff: '✨' };

// 원소별 색·아이콘 (tier1 / 벤치 칩 표시용)
const ELEM = {
  water:    { c: '#3aa0ff', i: '💧' },
  fire:     { c: '#ff5a3c', i: '🔥' },
  wind:     { c: '#9bf5dd', i: '🌪️' },
  earth:    { c: '#d2a24a', i: '🪨' },
  electric: { c: '#ffd23c', i: '⚡' },
  wood:     { c: '#5fd06a', i: '🌳' },
  ice:      { c: '#8fe9ff', i: '❄️' },
  metal:    { c: '#c3c9dc', i: '⚙️' },
};

let _stars = null;
function starfield(w, h) {
  if (_stars) return _stars;
  // 결정적 배치(시드 LCG) — 매 프레임 동일
  let s = 1234567;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  _stars = Array.from({ length: 90 }, () => ({ x: rnd() * w, y: rnd() * h, r: rnd() * 1.4 + 0.2, a: rnd() * 0.5 + 0.2 }));
  return _stars;
}

function drawGame(ctx, game) {
  const W = ctx.canvas.width, H = ctx.canvas.height;

  // 배경: 우주 그라데이션 + 별
  const bg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, '#161b3d');
  bg.addColorStop(1, '#07060f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const st of starfield(W, H)) {
    ctx.globalAlpha = st.a;
    ctx.fillStyle = '#cdd6ff';
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 경로: 발광 네온 트랙 (바깥 글로우 → 어두운 본체 → 밝은 중앙선)
  const drawPath = (width, color, blur) => {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.shadowColor = color; ctx.shadowBlur = blur;
    ctx.beginPath();
    game.path.forEach((p, i) => {
      const x = p.x * TILE, y = p.y * TILE;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  };
  drawPath(34, 'rgba(94,120,255,0.25)', 24);
  drawPath(26, '#1b2350', 0);
  drawPath(3, 'rgba(150,180,255,0.55)', 8);

  // 스폰 지점 표식
  if (game.path[0]) {
    const sp = game.path[0];
    ctx.fillStyle = '#9fe7ff'; ctx.shadowColor = '#9fe7ff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(sp.x * TILE, sp.y * TILE, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // 타워
  for (const t of game.towers) {
    const cx = t.x * TILE, cy = t.y * TILE;
    const col = TYPE_COLOR[t.atkType] || '#fff';
    // 사거리 링 (은은하게)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(cx, cy, t.range * TILE, 0, Math.PI * 2); ctx.stroke();
    // 본체 글로우
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 16;
    const g = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 16);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 티어 테두리 (티어 높을수록 밝은 금빛)
    ctx.strokeStyle = t.tier >= 4 ? '#ffe680' : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = t.tier >= 4 ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke();
    // 아이콘 + 티어
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '13px sans-serif';
    ctx.fillText(TYPE_ICON[t.atkType] || '◆', cx, cy - 1);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif';
    ctx.fillText('T' + t.tier, cx, cy + 11);
  }

  // 적 (공허/엔트로피 — 보라/마젠타 글로우 + 체력바)
  const pulse = 0.5 + 0.5 * Math.sin((game.now || 0) * 4);
  for (const e of game.enemies) {
    const cx = e.x * TILE, cy = e.y * TILE;
    const isBoss = e.role === 'boss';
    const r = isBoss ? 15 + pulse * 3 : 8;
    const col = isBoss ? '#d24bff' : '#ff4d6d';
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = isBoss ? 22 : 10;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, col); g.addColorStop(1, isBoss ? '#5a1080' : '#7a0f2a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 체력바
    const ratio = Math.max(0, e.hp / e.maxHp);
    const bw = isBoss ? 34 : 18;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx - bw / 2, cy - r - 7, bw, 3);
    ctx.fillStyle = ratio > 0.5 ? '#54e08a' : ratio > 0.25 ? '#ffd23c' : '#ff4d4d';
    ctx.fillRect(cx - bw / 2, cy - r - 7, bw * ratio, 3);
  }
}

function renderHud(game) {
  const w = game.boardWeight();
  const pct = Math.min(100, Math.round((w / CONFIG.GAME_OVER_CAP) * 100));
  const barColor = w > CONFIG.DANGER_THRESHOLD ? '#ff4d4d' : w > CONFIG.GAME_OVER_CAP * 0.5 ? '#ffd23c' : '#54e08a';
  const phaseLabel = game.phase === 'combat' ? '⚔️ 전투' : '🛠️ 준비';

  const chips = Object.entries(game.bench).map(([id, n]) => {
    const e = ELEM[id];
    const col = e ? e.c : '#8a93b8';
    const icon = e ? e.i : '◆';
    return `<span class="chip" style="--c:${col}">${icon} ${game.alchemy.name(id)}<b>×${n}</b></span>`;
  }).join('') || '<span class="muted">비어있음</span>';

  return `
    <div class="sec">
      <div class="hud-row">
        <span class="wave-badge">웨이브 ${game.wave}<span class="slash">/${CONFIG.MAX_WAVE}</span></span>
        <span class="phase">${phaseLabel}</span>
      </div>
      <div class="hud-row gold">🪙 <b>${Math.floor(game.gold)}</b><span class="muted">골드</span></div>
      <div class="hud-row">🎟️ <b>${game.bossTokens}</b><span class="muted">원소 선택권</span></div>
    </div>
    <div class="sec">
      <h4>🌀 공허 침식</h4>
      <div class="cap-top"><span class="muted">보드 위 몬스터</span><b>${w} / ${CONFIG.GAME_OVER_CAP}</b></div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
    </div>
    <div class="sec">
      <h4>🎒 벤치</h4>
      <div class="chips">${chips}</div>
    </div>
    ${game.gameOver ? '<div class="banner over">💀 게임 오버</div>' : ''}
    ${game.victory ? '<div class="banner win">🌌 승리! 40웨이브 클리어</div>' : ''}
  `;
}

if (typeof window !== 'undefined') { window.drawGame = drawGame; window.renderHud = renderHud; window.TILE = TILE; }
