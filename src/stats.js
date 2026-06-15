const CONFIG = (typeof require !== 'undefined') ? require('./config.js') : globalThis.CONFIG;
const balance = (typeof require !== 'undefined') ? require('./balance.js') : globalThis.balance;

/** 유닛의 지배 1단계 원소. 최다 구성 원소, 동률이면 inputs[0]을 재귀 추적. */
function dominantElement(alchemy, id) {
  const unit = alchemy.get(id);
  if (!unit.inputs) return id;                 // tier1
  const cost = alchemy.baseCost(id);           // {원소: 개수}
  const max = Math.max(...Object.values(cost));
  const top = Object.keys(cost).filter((e) => cost[e] === max);
  if (top.length === 1) return top[0];
  return dominantElement(alchemy, unit.inputs[0]); // 동률 → 첫 재료 추적
}

/** 유닛 → {element, atkType, damageBand, atkSpeed, range, tier} */
function deriveStats(alchemy, id) {
  const unit = alchemy.get(id);
  const tier = unit.tier;
  const el = dominantElement(alchemy, id);
  const atkType = unit.atkType || CONFIG.ATK_TYPE[el]; // 레시피 오버라이드 우선
  const isBuff = atkType === 'buff';
  const atkSpeed = isBuff
    ? 0
    : (CONFIG.FAST.includes(el) ? CONFIG.FAST_ATK_SPEED : CONFIG.BASE_ATK_SPEED);
  return {
    element: el,
    atkType,
    damageBand: balance.damageBand(el, tier),
    atkSpeed,
    range: CONFIG.RANGE_BY_TIER[tier],
    tier,
  };
}

/** 밴드 [min,max]에서 rand∈[0,1)로 데미지 1개 결정(개체차). */
function rollDamage(band, rand) {
  return Math.round(band[0] + rand * (band[1] - band[0]));
}

const stats = { dominantElement, deriveStats, rollDamage };
if (typeof module !== 'undefined' && module.exports) module.exports = stats;
