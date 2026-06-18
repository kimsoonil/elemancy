var CONFIG = {
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
  RANGE_BY_TIER: { 1: 2.0, 2: 2.2, 3: 2.5, 4: 2.8, 5: 3.2, 6: 3.6, 7: 4.0 },
  BASE_ATK_SPEED: 1.0,
  FAST_ATK_SPEED: 1.5,
  SLOW_FACTOR: 0.5,    // 이동속도 ×0.5 (= -50%)
  SLOW_DURATION: 2.0,  // 초
  STUN_DURATION: 1.0,  // 스턴: 완전 정지 시간(초) — 슬로우보다 강한 CC
  BUFF_DMG_MULT: 1.3,  // 버프: 주변 공격력 +30%
  BUFF_ATK_SPEED: 1.8, // 버프: 주변 공속 1.8
  BUFF_RADIUS: 2.5,

  // 적 HP / 캡
  ROLE_HP_MULT: { swarm: 0.3, fast: 0.5, special: 1.2, tank: 2.5 },
  BOSS_HP_MULT: 3,        // 구간 끝 base × 3
  BOSS_CAP_WEIGHT: 8,
  SPAWN_PER_ROUND: 30,   // 라운드당 스폰 수 (0.5초 간격 → 15초간 출현)
  SPAWN_INTERVAL: 0.5,   // 유닛 스폰 간격(초)
  GAME_OVER_CAP: 100,
  DANGER_THRESHOLD: 80, // 위기 게이지 경고 표시 기준
  MAX_WAVE: 50,
  ROUND_TIME: 30,       // 한 라운드(웨이브 간격) 초 — 지나면 자동으로 다음 웨이브
  NEXT_WAVE_LOCK: 15,   // 라운드 시작 후 이 시간 동안 '다음 웨이브' 버튼 비활성(스폰 구간)
  GOLD_PER_ROUND: 200,  // 라운드 시작 시 정액 지급
  GOLD_PER_BOSS: 1000,  // 보스 처치 골드 = 보스인덱스 × 1000 (1000~5000)
  QUEST_INTERVAL: 8,    // 퀘스트 진행 간격(라운드) — 1회 후 다음까지 잠금
  GOLD_SELL_BASE: 50,   // 타워 판매 환급 = 티어 × 50

  // 경제
  START_GOLD: 600,       // 시작 골드 (랜덤 뽑기 100G로 시작 유닛 구성)
  START_ELEMENTS: 0,     // 시작 무료 유닛 (골드로 뽑아 시작)
  WAVE_CLEAR_ELEMENTS: 2,
  BOSS_TOKEN_STEP: 3,     // 보스 인덱스 × 3 → 3,6,9,12,15
  UPGRADE_PER_LEVEL: 0.01, // 레벨당 +1%
  UPGRADE_MAX_LEVEL: 1000,
  UPGRADE_COST: (tier, level) => Math.ceil(tier * 20 * Math.pow(1.01, level)),
  RANDOM_DRAW_COST: 100, // 랜덤 유닛(tier1 원소) 1개 확정 뽑기 비용
  GAMBLE_BETS: [100, 500, 1000],
  GACHA: {
    1: { cost: 1000, rate: 0.5 },
    2: { cost: 5000, rate: 0.4 },
    3: { cost: 10000, rate: 0.3 },
  },

  // 적 처치 골드(역할별; 보스는 GOLD_PER_BOSS로 별도 처리)
  GOLD_PER_KILL: { swarm: 5, fast: 8, special: 15, tank: 20 },

  // 난이도: 시작 골드 + 적 방어도(체력 배수)
  DIFFICULTY: {
    easy:   { name: '쉬움',   gold: 800, armor: 0.5, armorLabel: '없음' },
    normal: { name: '보통',   gold: 600, armor: 1,   armorLabel: '1배' },
    hard:   { name: '어려움', gold: 400, armor: 2,   armorLabel: '2배' },
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
if (typeof window !== 'undefined') window.CONFIG = CONFIG;
