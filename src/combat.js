const CONFIG = (typeof require !== 'undefined') ? require('./config.js') : globalThis.CONFIG;

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

const combat = { dist, selectTargets, buffMultipliers, resolveHit, effectiveSpeed };
if (typeof module !== 'undefined' && module.exports) module.exports = combat;
