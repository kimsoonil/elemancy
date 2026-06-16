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

const combat = { dist, selectTargets };
if (typeof module !== 'undefined' && module.exports) module.exports = combat;
