const TILE = 64; // 1 격자 단위 = 64px
const COLORS = { aoe: '#ff6b3d', single: '#9aa7ff', slow: '#5fd3ff', buff: '#7CFC9A' };

function drawGame(ctx, game) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  // 경로
  ctx.strokeStyle = '#3a3f6b'; ctx.lineWidth = 28;
  ctx.beginPath();
  game.path.forEach((p, i) => {
    const x = p.x * TILE, y = p.y * TILE;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath(); ctx.stroke();
  // 타워
  for (const t of game.towers) {
    ctx.fillStyle = COLORS[t.atkType] || '#fff';
    ctx.beginPath();
    ctx.arc(t.x * TILE, t.y * TILE, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('T' + t.tier, t.x * TILE, t.y * TILE + 3);
  }
  // 적
  for (const e of game.enemies) {
    const r = e.role === 'boss' ? 16 : 8;
    ctx.fillStyle = e.role === 'boss' ? '#ff3df0' : '#c66';
    ctx.beginPath();
    ctx.arc(e.x * TILE, e.y * TILE, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderHud(game) {
  const danger = game.boardWeight() > CONFIG.DANGER_THRESHOLD ? 'danger' : '';
  return `
    <div>웨이브: <b>${game.wave}</b> / ${CONFIG.MAX_WAVE} (${game.phase})</div>
    <div>골드: <b>${Math.floor(game.gold)}</b></div>
    <div class="${danger}">몬스터: <b>${game.boardWeight()}</b> / ${CONFIG.GAME_OVER_CAP}</div>
    <div>보스 토큰: <b>${game.bossTokens}</b></div>
    <div>벤치: ${Object.entries(game.bench).map(([id, n]) => `${game.alchemy.name(id)}×${n}`).join(', ') || '비어있음'}</div>
    ${game.gameOver ? '<div class="danger"><b>게임 오버</b></div>' : ''}
    ${game.victory ? '<div><b>승리! 40웨이브 클리어</b></div>' : ''}
  `;
}

if (typeof window !== 'undefined') { window.drawGame = drawGame; window.renderHud = renderHud; }
