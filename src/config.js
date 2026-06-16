const CONFIG = {
  // 원소 → 공격 타입
  ATK_TYPE: {
    electric: 'aoe', fire: 'aoe',
    metal: 'single', wind: 'single',
    ice: 'slow', water: 'slow',
    wood: 'buff', earth: 'buff',
  },
  HIGH_BAND: ['electric', 'metal'], // tier1 밴드 15~20
  FAST: ['electric', 'wind'],       // 공속 1.5

  // 타워 능력치
  TIER1_BAND: { high: [15, 20], normal: [10, 15] },
  RANGE_BY_TIER: { 1: 2.0, 2: 2.2, 3: 2.5, 4: 2.8, 5: 3.2 },
  BASE_ATK_SPEED: 1.0,
  FAST_ATK_SPEED: 1.5,
  SLOW_FACTOR: 0.6,    // 이동속도 ×0.6 (= -40%)
  SLOW_DURATION: 2.0,  // 초
  BUFF_DMG_MULT: 1.25,
  BUFF_ATK_SPEED: 1.75, // 1.5~2.0 사이 채택
  BUFF_RADIUS: 2.5,

  // 적 HP / 캡
  ROLE_HP_MULT: { swarm: 0.3, fast: 0.5, special: 1.2, tank: 2.5 },
  BOSS_HP_MULT: 3,        // 구간 끝 base × 3
  BOSS_CAP_WEIGHT: 8,
  SPAWN_PER_ROUND: 20,
  GAME_OVER_CAP: 100,
  MAX_WAVE: 40,

  // 경제
  START_ELEMENTS: 5,
  WAVE_CLEAR_ELEMENTS: 2,
  BOSS_TOKEN_BASE: 1,     // 보스마다 ×3 (1,3,9,27)
  UPGRADE_PER_LEVEL: 0.01, // 레벨당 +1%
  UPGRADE_MAX_LEVEL: 1000,
  UPGRADE_COST: (tier, level) => Math.ceil(tier * 20 * Math.pow(1.01, level)),
  GAMBLE_BETS: [100, 500, 1000],
  GACHA: {
    1: { cost: 1000, rate: 0.5 },
    2: { cost: 5000, rate: 0.4 },
    3: { cost: 10000, rate: 0.3 },
  },

  // 골드 획득 (역할별 기본값; 튜닝값)
  GOLD_PER_KILL: { swarm: 5, fast: 8, special: 15, tank: 20, boss: 200 },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
if (typeof window !== 'undefined') window.CONFIG = CONFIG;
