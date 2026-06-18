const TILE = 64; // 1 격자 단위 = 64px

// 공격 타입별 네온 색
const TYPE_COLOR = { aoe: '#ff6a3d', single: '#7b8cff', slow: '#3fd7ff', buff: '#5cf08a', stun: '#ffcf4d' };
const TYPE_ICON = { aoe: '💥', single: '🎯', slow: '❄️', buff: '✨', stun: '💫' };

// 적 역할별 스타일 (색·크기·표식)
const ROLE_STYLE = {
  swarm:   { r: 6,  c: '#ff6b6b', dark: '#7a0f2a', mark: '' },   // 물량: 작고 많음
  fast:    { r: 7,  c: '#ffe14d', dark: '#7a5a0f', mark: '»' },  // 고속: 노랑
  tank:    { r: 13, c: '#d2603a', dark: '#5a1d10', mark: '▣' },  // 탱커: 크고 단단(이중 테두리)
  special: { r: 9,  c: '#b06bff', dark: '#3a1080', mark: '✦' },  // 특수: 보라 오라
  boss:    { r: 16, c: '#d24bff', dark: '#5a1080', mark: '☠' },  // 보스
  quest:   { r: 11, c: '#5cf08a', dark: '#0f5a2a', mark: '?' },  // 퀘스트 몬스터
};

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

  // 선택된 타워의 사거리(+버프 타워는 버프 범위) 표시
  const selTower = game.towers.find((t) => t.uid === game.selectedUid);
  if (selTower) {
    const cx = selTower.x * TILE, cy = selTower.y * TILE;
    const col = TYPE_COLOR[selTower.atkType] || '#fff';
    ctx.save();
    if (selTower.atkType === 'buff' && CONFIG.BUFF_RADIUS) {
      // 버프 범위(초록)
      ctx.fillStyle = 'rgba(92,240,138,0.10)'; ctx.strokeStyle = 'rgba(92,240,138,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, CONFIG.BUFF_RADIUS * TILE, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      // 공격 사거리
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(cx, cy, selTower.range * TILE, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // 타워
  for (const t of game.towers) {
    const cx = t.x * TILE, cy = t.y * TILE;
    const col = TYPE_COLOR[t.atkType] || '#fff';
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
    // 선택 표시
    if (t.uid === game.selectedUid) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, 21, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // 아이콘 + 티어
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '13px sans-serif';
    ctx.fillText(TYPE_ICON[t.atkType] || '◆', cx, cy - 1);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif';
    ctx.fillText('T' + t.tier, cx, cy + 11);
  }

  // 적 — 역할별 색·크기·표식으로 구분
  const pulse = 0.5 + 0.5 * Math.sin((game.now || 0) * 4);
  for (const e of game.enemies) {
    const cx = e.x * TILE, cy = e.y * TILE;
    const st = ROLE_STYLE[e.role] || ROLE_STYLE.swarm;
    const big = e.role === 'boss' || e.role === 'special';
    const r = st.r + (big ? pulse * 2 : 0);
    ctx.save();
    ctx.shadowColor = st.c; ctx.shadowBlur = e.role === 'boss' ? 22 : 10;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, st.c); g.addColorStop(1, st.dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // tank: 장갑 이중 테두리 / special·quest: 점선 오라
    if (e.role === 'tank') {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.stroke();
    } else if (e.role === 'special' || e.role === 'quest') {
      ctx.strokeStyle = st.c; ctx.globalAlpha = 0.6; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(cx, cy, r + 4 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    // 역할 표식
    if (st.mark) {
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${e.role === 'boss' ? 14 : 10}px sans-serif`;
      ctx.fillText(st.mark, cx, cy + 0.5);
    }
    // 체력바
    const ratio = Math.max(0, e.hp / e.maxHp);
    const bw = Math.max(18, r * 2.2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx - bw / 2, cy - r - 7, bw, 3);
    ctx.fillStyle = ratio > 0.5 ? '#54e08a' : ratio > 0.25 ? '#ffd23c' : '#ff4d4d';
    ctx.fillRect(cx - bw / 2, cy - r - 7, bw * ratio, 3);
  }

  // 공격 모션: 타워→적 빔 + 착탄 플래시 (짧게 떴다 사라짐)
  const FX_DUR = 0.18;
  for (const fx of (game.effects || [])) {
    const age = (game.now || 0) - fx.born;
    if (age < 0 || age > FX_DUR) continue;
    const k = age / FX_DUR;            // 0 → 1
    const col = TYPE_COLOR[fx.type] || '#fff';
    const x0 = fx.x0 * TILE, y0 = fx.y0 * TILE, x1 = fx.x1 * TILE, y1 = fx.y1 * TILE;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.lineWidth = fx.type === 'single' ? 4 : fx.type === 'aoe' ? 2.5 : 2;
    // 발사체: 타워→적으로 빠르게 이동(앞부분)하며 빔 잔상
    const head = Math.min(1, k * 2.2);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * head, y0 + (y1 - y0) * head); ctx.stroke();
    // 착탄 플래시(헤드가 도달한 뒤)
    if (head >= 1) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x1, y1, (fx.type === 'aoe' ? 11 : 6) * (0.6 + k), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// 1번 카드: 현재 웨이브 + 다음 웨이브까지 카운트다운
function renderWaveInfo(game) {
  let label;
  if (game.victory) label = '🌌 클리어';
  else if (game.wave >= CONFIG.MAX_WAVE) label = '⚔️ 최종 웨이브';
  else label = `⏱ ${Math.max(0, Math.ceil(game.roundTimer))}초 후 다음`;
  return `<span class="wave-badge">웨이브 ${game.wave}<span class="slash">/${CONFIG.MAX_WAVE}</span></span><span class="phase">${label}</span>`;
}

// 4번 카드: 골드 + 원소 선택권
function renderResources(game) {
  return `<div class="hud-row gold">🪙 <b>${Math.floor(game.gold)}</b><span class="muted">골드</span></div>` +
    `<div class="hud-row">🎟️ <b>${game.bossTokens}</b><span class="muted">원소 선택권</span></div>`;
}

// #hud: 공허 침식 + 벤치 카드 (+ 승패 배너)
function renderHud(game) {
  const w = game.boardWeight();
  const pct = Math.min(100, Math.round((w / CONFIG.GAME_OVER_CAP) * 100));
  const barColor = w > CONFIG.DANGER_THRESHOLD ? '#ff4d4d' : w > CONFIG.GAME_OVER_CAP * 0.5 ? '#ffd23c' : '#54e08a';

  // 배치된 유닛(타워)을 종류별로 집계
  const placed = new Map();
  for (const t of game.towers) {
    if (!placed.has(t.unitId)) placed.set(t.unitId, { count: 0, atkType: t.atkType });
    placed.get(t.unitId).count++;
  }
  // 슬롯이 꽉 차 벤치로 밀린 미배치 유닛도 합산
  for (const [id, n] of Object.entries(game.bench)) {
    if (!placed.has(id)) placed.set(id, { count: 0, atkType: null });
    placed.get(id).count += n;
  }
  const chips = [...placed.entries()].map(([id, info]) => {
    const e = ELEM[id];
    const col = e ? e.c : (TYPE_COLOR[info.atkType] || '#8a93b8');
    const icon = e ? e.i : (TYPE_ICON[info.atkType] || '◆');
    return `<span class="chip" style="--c:${col}">${icon} ${game.alchemy.name(id)}<b>×${info.count}</b></span>`;
  }).join('') || '<span class="muted">배치된 유닛 없음</span>';

  return `
    <div class="sec">
      <h4>🌀 공허 침식</h4>
      <div class="cap-top"><span class="muted">보드 위 몬스터</span><b>${w} / ${CONFIG.GAME_OVER_CAP}</b></div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
    </div>
    <div class="sec">
      <h4>🎒 배치된 유닛</h4>
      <div class="chips">${chips}</div>
    </div>
    ${game.gameOver ? '<div class="banner over">💀 게임 오버</div>' : ''}
    ${game.victory ? '<div class="banner win">🌌 승리! 40웨이브 클리어</div>' : ''}
  `;
}

if (typeof window !== 'undefined') {
  window.drawGame = drawGame; window.renderHud = renderHud;
  window.renderWaveInfo = renderWaveInfo; window.renderResources = renderResources;
  window.TILE = TILE;
}
