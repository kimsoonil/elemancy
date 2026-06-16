const CONFIG = (typeof require !== 'undefined') ? require('./config.js') : globalThis.CONFIG;

/** 웨이브의 기본 HP. w1=100, 라운드마다 100×10^(구간-1) 누적. */
function baseHP(wave) {
  const seg = Math.ceil(wave / 10);          // 1..4
  const wInSeg = wave - (seg - 1) * 10;       // 1..10
  let prevEnd = 0;
  for (let k = 1; k < seg; k++) prevEnd += 100 * Math.pow(10, k - 1) * 10;
  const inc = 100 * Math.pow(10, seg - 1);
  return prevEnd + inc * wInSeg;
}

/** 적 1마리의 HP. 보스는 구간 끝 base × 3, 그 외는 역할 배수. */
function enemyHP(role, wave) {
  if (role === 'boss') return baseHP(wave) * CONFIG.BOSS_HP_MULT;
  return Math.round(baseHP(wave) * (CONFIG.ROLE_HP_MULT[role] || 1));
}

/** 타워 데미지 밴드 [min,max]. 지배 원소 + 티어. */
function damageBand(element, tier) {
  const base = CONFIG.HIGH_BAND.includes(element)
    ? CONFIG.TIER1_BAND.high
    : CONFIG.TIER1_BAND.normal;
  const m = Math.pow(10, tier - 1);
  return [base[0] * m, base[1] * m];
}

/** 도박 순손익: rand∈[0,1) → 정수 [-bet, +bet] 균등. */
function gambleResult(bet, rand) {
  return Math.floor(rand * (2 * bet + 1)) - bet;
}

const balance = { baseHP, enemyHP, damageBand, gambleResult };
if (typeof module !== 'undefined' && module.exports) module.exports = balance;
if (typeof window !== 'undefined') window.balance = balance;
