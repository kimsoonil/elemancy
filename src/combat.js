var CONFIG = (typeof require !== 'undefined') ? require('./config.js') : globalThis.CONFIG;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 이 타워가 이번 발사로 때릴 적 목록. */
function selectTargets(tower, enemies) {
  if (tower.atkType === 'buff') return [];
  const inRange = enemies.filter((e) => e.hp > 0 && dist(tower, e) <= tower.range);
  if (tower.atkType === 'aoe') return inRange;
  // single / slow: 가장 가까운 1마리
  if (inRange.length === 0) return [];
  inRange.sort((a, b) => dist(tower, a) - dist(tower, b));
  return [inRange[0]];
}

/** 아군 타워가 받는 버프 배수. 버프 타워 반경 내면 dmg×1.25, 공속=1.75. */
function buffMultipliers(tower, towers) {
  const buffed = towers.some(
    (b) => b.atkType === 'buff' && b.uid !== tower.uid && dist(b, tower) <= CONFIG.BUFF_RADIUS
  );
  return buffed
    ? { dmgMult: CONFIG.BUFF_DMG_MULT, atkSpeed: CONFIG.BUFF_ATK_SPEED }
    : { dmgMult: 1, atkSpeed: tower.atkSpeed };
}

/** 타격 해소: 데미지 적용 + 슬로우면 둔화 부여. */
function resolveHit(tower, enemy, now) {
  enemy.hp -= tower.damage;
  if (tower.atkType === 'slow') {
    enemy.slowUntil = now + CONFIG.SLOW_DURATION;
  }
}

/** 슬로우 적용 중이면 감속된 이동속도. */
function effectiveSpeed(enemy, now) {
  return now < enemy.slowUntil ? enemy.baseSpeed * CONFIG.SLOW_FACTOR : enemy.baseSpeed;
}

function pathLength(path) {
  let len = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** 닫힌 경로에서 거리 pos(0~)의 좌표. 총 길이를 넘으면 wrap. */
function pathPointAt(path, pos) {
  const total = pathLength(path);
  let p = ((pos % total) + total) % total;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (p <= segLen) {
      const t = segLen === 0 ? 0 : p / segLen;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    p -= segLen;
  }
  return { x: path[0].x, y: path[0].y };
}

/**
 * 한 틱 진행: 적 이동 → 타워 발사 → 사망 처리.
 * @param state {towers, enemies, path, dmgScale?}
 * @param dt 초
 * @param now 누적 시각(초) — 슬로우 만료 판정
 * @param onKill (enemy) => void  사망 콜백(골드 지급은 game이 담당)
 */
function tick(state, dt, now, onKill) {
  const total = pathLength(state.path);
  if (total === 0) return; // 경로 미주입 시 NaN 방지
  // 1) 이동 (무한 순환)
  for (const e of state.enemies) {
    e.pathPos = (e.pathPos + effectiveSpeed(e, now) * dt) % total;
    const pt = pathPointAt(state.path, e.pathPos);
    e.x = pt.x; e.y = pt.y;
  }
  // 2) 타워 발사
  for (const t of state.towers) {
    if (t.atkType === 'buff') continue;
    const buff = buffMultipliers(t, state.towers);
    const interval = 1 / buff.atkSpeed;
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;
    t.cooldown = interval;
    const scale = state.dmgScale ? state.dmgScale(t) : 1;
    const targets = selectTargets(t, state.enemies);
    for (const e of targets) {
      resolveHit({ atkType: t.atkType, damage: t.damage * buff.dmgMult * scale }, e, now);
    }
  }
  // 3) 사망 처리
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    if (state.enemies[i].hp <= 0) {
      onKill(state.enemies[i]);
      state.enemies.splice(i, 1);
    }
  }
}

const combat = { dist, selectTargets, buffMultipliers, resolveHit, effectiveSpeed, pathLength, pathPointAt, tick };
if (typeof module !== 'undefined' && module.exports) module.exports = combat;
if (typeof window !== 'undefined') window.combat = combat;
