# Elemancy 프로토타입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원소 연금술 조합 디펜스(원랜디 스타일)의 재미 검증용 싱글플레이 웹 프로토타입을 만든다.

**Architecture:** 데이터(`recipes.json`, `enemies.json`)와 합성/웨이브 로직(`alchemy.js`, `wavesystem.js`)을 코어로 재사용하고, 그 위에 순수 로직 모듈(`config`, `balance`, `stats`, `combat`, `game`)과 브라우저 렌더 레이어(`render`, `main`, `index.html`)를 얹는다. 로직 모듈은 모두 Node에서 단위 테스트가 가능하도록 CommonJS export + 브라우저 전역 양쪽 호환으로 작성한다.

**Tech Stack:** 순수 HTML5 Canvas + 바닐라 JS, 의존성 0. 테스트는 Node 내장 러너(`node --test`) + `node:assert/strict`.

---

## 파일 구조

| 파일 | 책임 | 테스트 |
|---|---|---|
| `data/recipes.json` | 원소·합성 트리 (기존) | — |
| `data/enemies.json` | 적·웨이브 데이터 (기존) | — |
| `src/alchemy.js` | 합성 조회/검증/원가 (기존, 변경 없음) | 기존 동작 의존 |
| `src/wavesystem.js` | 웨이브별 적 구성 (보스 분기 **수정**) | `tests/wavesystem.test.js` |
| `src/config.js` | 모든 튜닝 상수 (신규) | `tests/config.test.js` |
| `src/balance.js` | HP·데미지밴드·업그레이드·도박 공식 (신규) | `tests/balance.test.js` |
| `src/stats.js` | 유닛→계열/공격타입/밴드/공속/사거리 (신규) | `tests/stats.test.js` |
| `src/combat.js` | 타겟팅·타격·슬로우·버프·이동·틱 (신규) | `tests/combat.test.js` |
| `src/game.js` | 상태·인벤토리·조합·경제·스폰·게임오버 (신규) | `tests/game.test.js` |
| `src/render.js` | Canvas 그리기 (신규, 수동 검증) | 수동 |
| `src/main.js` | 데이터 로드 + rAF 루프 (신규, 수동 검증) | 수동 |
| `index.html` | 진입 페이지 (신규, 수동 검증) | 수동 |

**모듈 경계 원칙:** `config`/`balance`/`stats`는 순수 함수·상수. `combat`은 좌표·엔티티를 받아 한 틱을 계산(렌더/입력 모름). `game`은 상태의 단일 소스. `render`/`main`은 `game`을 읽어 그리기만.

**브라우저/Node 양쪽 호환 패턴** (모든 로직 모듈 끝에 추가):

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { /* 이 파일이 노출하는 심볼들 */ };
}
```

브라우저에서는 `<script>` 로드 순서(config → balance → stats → combat → game → render → main)로 전역 접근.

---

## Task 0: 테스트 인프라 + 기존 자산 sanity 확인

**Files:**
- Create: `package.json`
- Test: `tests/sanity.test.js`

- [ ] **Step 1: `package.json` 작성**

```json
{
  "name": "elemancy",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: sanity 테스트 작성** — 기존 코어가 로드되고 데이터 무결성이 통과하는지 확인

`tests/sanity.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const Alchemy = require('../src/alchemy.js');
const WaveSystem = require('../src/wavesystem.js');
const recipes = require('../data/recipes.json');
const enemies = require('../data/enemies.json');

test('Alchemy 로드 + recipes 무결성 통과', () => {
  const a = new Alchemy(recipes);
  assert.deepEqual(a.validate(), []);
  assert.equal(a.name('steam'), '증기');
});

test('WaveSystem 로드 + 40웨이브 캠페인 생성', () => {
  const w = new WaveSystem(enemies);
  const camp = w.campaign(40);
  assert.equal(camp.length, 40);
  assert.ok(w.isBossWave(10));
});
```

- [ ] **Step 3: 테스트 실행 → 통과 확인**

Run: `node --test`
Expected: PASS (2 tests). 만약 `recipes 무결성` 이 실패하면 `data/recipes.json` 의 tier 규칙 위반을 먼저 점검.

- [ ] **Step 4: Commit**

```bash
git add package.json tests/sanity.test.js
git commit -m "🧪 테스트 인프라 + 코어 자산 sanity 테스트"
```

---

## Task 1: `config.js` — 튜닝 상수 단일 소스

**Files:**
- Create: `src/config.js`
- Test: `tests/config.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`tests/config.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');

test('원소→공격타입 매핑이 스펙과 일치', () => {
  assert.equal(CONFIG.ATK_TYPE.fire, 'aoe');
  assert.equal(CONFIG.ATK_TYPE.electric, 'aoe');
  assert.equal(CONFIG.ATK_TYPE.metal, 'single');
  assert.equal(CONFIG.ATK_TYPE.wind, 'single');
  assert.equal(CONFIG.ATK_TYPE.ice, 'slow');
  assert.equal(CONFIG.ATK_TYPE.water, 'slow');
  assert.equal(CONFIG.ATK_TYPE.wood, 'buff');
  assert.equal(CONFIG.ATK_TYPE.earth, 'buff');
});

test('고밴드/고속 원소 집합', () => {
  assert.deepEqual([...CONFIG.HIGH_BAND].sort(), ['electric', 'metal']);
  assert.deepEqual([...CONFIG.FAST].sort(), ['electric', 'wind']);
});

test('게임오버 캡 / 보스 가중치 / 스폰 수', () => {
  assert.equal(CONFIG.GAME_OVER_CAP, 100);
  assert.equal(CONFIG.BOSS_CAP_WEIGHT, 8);
  assert.equal(CONFIG.SPAWN_PER_ROUND, 20);
});

test('업그레이드 비용은 초기 저렴하고 레벨에 따라 증가', () => {
  assert.equal(CONFIG.UPGRADE_COST(1, 0), 20);            // tier1 첫 레벨 = 20
  assert.ok(CONFIG.UPGRADE_COST(1, 10) > CONFIG.UPGRADE_COST(1, 0));
  assert.ok(CONFIG.UPGRADE_COST(5, 0) > CONFIG.UPGRADE_COST(1, 0)); // 상위 티어 비쌈
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/config.test.js`
Expected: FAIL ("Cannot find module '../src/config.js'")

- [ ] **Step 3: `src/config.js` 구현**

```javascript
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

  // 골드 획득 (역할별 기본값 × tier; 튜닝값)
  GOLD_PER_KILL: { swarm: 5, fast: 8, special: 15, tank: 20, boss: 200 },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/config.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "✨ config.js — 튜닝 상수 단일 소스"
```

---

## Task 2: `balance.js` — HP·데미지·경제 공식

**Files:**
- Create: `src/balance.js`
- Test: `tests/balance.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`tests/balance.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/balance.js');

test('baseHP — 구간 경계값이 스펙과 정확히 일치', () => {
  assert.equal(B.baseHP(1), 100);
  assert.equal(B.baseHP(10), 1000);
  assert.equal(B.baseHP(11), 2000);
  assert.equal(B.baseHP(20), 11000);
  assert.equal(B.baseHP(21), 21000);
  assert.equal(B.baseHP(30), 111000);
  assert.equal(B.baseHP(31), 211000);
  assert.equal(B.baseHP(40), 1110000);
});

test('enemyHP — 역할 배수 적용', () => {
  assert.equal(B.enemyHP('swarm', 10), 300);   // 1000 × 0.3
  assert.equal(B.enemyHP('tank', 10), 2500);   // 1000 × 2.5
  assert.equal(B.enemyHP('special', 20), 13200); // 11000 × 1.2
});

test('enemyHP — 보스는 구간 끝 base × 3', () => {
  assert.equal(B.enemyHP('boss', 10), 3000);
  assert.equal(B.enemyHP('boss', 20), 33000);
  assert.equal(B.enemyHP('boss', 30), 333000);
  assert.equal(B.enemyHP('boss', 40), 3330000);
});

test('damageBand — 티어마다 ×10, 고밴드 원소만 상위', () => {
  assert.deepEqual(B.damageBand('water', 1), [10, 15]);
  assert.deepEqual(B.damageBand('metal', 1), [15, 20]);
  assert.deepEqual(B.damageBand('water', 2), [100, 150]);
  assert.deepEqual(B.damageBand('electric', 3), [1500, 2000]);
});

test('gambleResult — 결과가 항상 [-bet, +bet] 범위', () => {
  for (const r of [0, 0.5, 0.999]) {
    const v = B.gambleResult(1000, r);
    assert.ok(v >= -1000 && v <= 1000, `r=${r} → ${v}`);
  }
  assert.equal(B.gambleResult(100, 0), -100);   // 최저
  assert.equal(B.gambleResult(100, 0.999), 100); // 최고(근사)
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/balance.test.js`
Expected: FAIL ("Cannot find module '../src/balance.js'")

- [ ] **Step 3: `src/balance.js` 구현**

```javascript
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
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/balance.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/balance.js tests/balance.test.js
git commit -m "✨ balance.js — 적 HP·데미지밴드·도박 공식"
```

---

## Task 3: `stats.js` — 유닛 능력치 산출

**Files:**
- Create: `src/stats.js`
- Test: `tests/stats.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`tests/stats.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const Alchemy = require('../src/alchemy.js');
const recipes = require('../data/recipes.json');
const Stats = require('../src/stats.js');

const a = new Alchemy(recipes);

test('dominantElement — 단일 지배 원소', () => {
  assert.equal(Stats.dominantElement(a, 'fire'), 'fire');     // tier1 = 자기 자신
  // lava(fire+earth) → fire:1, earth:1 동률 → inputs[0]=fire
  assert.equal(Stats.dominantElement(a, 'lava'), 'fire');
});

test('dominantElement — 동률은 inputs[0] 따라감 (증기=물)', () => {
  // steam(water,fire) → 동률 → inputs[0]=water
  assert.equal(Stats.dominantElement(a, 'steam'), 'water');
});

test('deriveStats — tier1 물은 둔화/기본공속', () => {
  const s = Stats.deriveStats(a, 'water');
  assert.equal(s.atkType, 'slow');
  assert.deepEqual(s.damageBand, [10, 15]);
  assert.equal(s.atkSpeed, 1.0);
  assert.equal(s.range, 2.0);
});

test('deriveStats — 전기는 광역/고밴드/고속', () => {
  const s = Stats.deriveStats(a, 'electric');
  assert.equal(s.atkType, 'aoe');
  assert.deepEqual(s.damageBand, [15, 20]);
  assert.equal(s.atkSpeed, 1.5);
});

test('deriveStats — 버프 원소는 공격 안함(공속 0)', () => {
  const s = Stats.deriveStats(a, 'wood');
  assert.equal(s.atkType, 'buff');
  assert.equal(s.atkSpeed, 0);
});

test('deriveStats — 상위 유닛은 지배 원소 계열 + 티어 밴드', () => {
  // 증기 tier2, 지배=water(둔화), 밴드 ×10
  const s = Stats.deriveStats(a, 'steam');
  assert.equal(s.atkType, 'slow');
  assert.deepEqual(s.damageBand, [100, 150]);
  assert.equal(s.range, 2.2);
});

test('rollDamage — 밴드 내 정수 반환', () => {
  assert.equal(Stats.rollDamage([10, 15], 0), 10);
  assert.equal(Stats.rollDamage([10, 15], 1), 15);
  const mid = Stats.rollDamage([10, 20], 0.5);
  assert.ok(mid >= 10 && mid <= 20);
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/stats.test.js`
Expected: FAIL ("Cannot find module '../src/stats.js'")

- [ ] **Step 3: `src/stats.js` 구현**

```javascript
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
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/stats.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stats.js tests/stats.test.js
git commit -m "✨ stats.js — 유닛 계열/공격타입/밴드/공속 산출"
```

---

## Task 4: `wavesystem.js` 수정 — 보스 웨이브에 일반 적 동반

**Files:**
- Modify: `src/wavesystem.js:37-65` (`composeWave`)
- Test: `tests/wavesystem.test.js`

- [ ] **Step 1: 실패 테스트 작성** — 보스 웨이브가 일반 적 + 보스를 함께 반환해야 함

`tests/wavesystem.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const WaveSystem = require('../src/wavesystem.js');
const enemies = require('../data/enemies.json');

const w = new WaveSystem(enemies);

test('일반 웨이브는 비보스 적만 포함', () => {
  const c = w.composeWave(5);
  assert.equal(c.type, 'normal');
  assert.ok(c.spawns.every((s) => s.role !== 'boss'));
});

test('보스 웨이브는 일반 적 + 보스 동반 (보스 단독 아님)', () => {
  const c = w.composeWave(10);
  assert.equal(c.type, 'boss');
  const roles = c.spawns.map((s) => s.role);
  assert.ok(roles.includes('boss'), '보스 포함');
  assert.ok(roles.some((r) => r !== 'boss'), '일반 적도 포함');
  const boss = c.spawns.find((s) => s.role === 'boss');
  assert.equal(boss.count, 1);
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/wavesystem.test.js`
Expected: FAIL — 현재 `composeWave`는 보스 웨이브에서 보스 단독 배열만 반환하므로 "일반 적도 포함" assert 실패.

- [ ] **Step 3: `composeWave` 수정** — 보스 분기를 "일반 구성 + 보스"로 변경

`src/wavesystem.js` 의 `composeWave(wave)` 전체를 아래로 교체:

```javascript
  composeWave(wave) {
    const seg = this.segmentOf(wave);
    const pool = this.bySegment.get(seg.id) || [];

    // 일반 적 구성 (보스 웨이브에서도 동일하게 깔고, 보스를 얹는다)
    const normals = pool.filter((e) => e.role !== "boss");
    const picked = this._pickMixed(normals, wave);
    const progress = ((wave - 1) % 10) / 9; // 0 ~ 1
    const spawns = picked.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      count: Math.max(1, Math.round(e.count * (0.7 + 0.6 * progress))),
    }));

    if (this.isBossWave(wave)) {
      const boss = pool.find((e) => e.role === "boss");
      if (boss) {
        spawns.push({ id: boss.id, name: boss.name, role: boss.role, count: 1 });
      }
      return { wave, segment: seg.name, type: "boss", reqTier: seg.reqTier, spawns };
    }

    return { wave, segment: seg.name, type: "normal", reqTier: seg.reqTier, spawns };
  }
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/wavesystem.test.js`
Expected: PASS (2 tests). 이어서 `node --test`로 sanity 포함 전체 회귀 통과 확인.

- [ ] **Step 5: Commit**

```bash
git add src/wavesystem.js tests/wavesystem.test.js
git commit -m "🔨 wavesystem: 보스 웨이브에 일반 적 동반 출현"
```

---

## Task 5: `combat.js` (1/3) — 거리 + 타겟 선택

**Files:**
- Create: `src/combat.js`
- Test: `tests/combat.test.js`

엔티티 형태(이 plan 전체에서 고정):
- **Tower**: `{ uid, unitId, tier, atkType, damage, atkSpeed, range, x, y, cooldown }`
- **Enemy**: `{ uid, role, hp, maxHp, baseSpeed, x, y, pathPos, slowUntil }`

- [ ] **Step 1: 실패 테스트 작성**

`tests/combat.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const Combat = require('../src/combat.js');

const tower = (o) => ({ uid: 't', atkType: 'single', damage: 50, atkSpeed: 1, range: 2, x: 0, y: 0, cooldown: 0, tier: 1, ...o });
const enemy = (o) => ({ uid: 'e', role: 'swarm', hp: 100, maxHp: 100, baseSpeed: 1, x: 0, y: 0, pathPos: 0, slowUntil: 0, ...o });

test('dist — 유클리드 거리', () => {
  assert.equal(Combat.dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('selectTargets — 단일은 사거리 내 가장 가까운 1마리', () => {
  const t = tower({ atkType: 'single', range: 5 });
  const near = enemy({ uid: 'near', x: 1, y: 0 });
  const far = enemy({ uid: 'far', x: 4, y: 0 });
  const out = enemy({ uid: 'out', x: 9, y: 0 });
  const got = Combat.selectTargets(t, [far, near, out]);
  assert.equal(got.length, 1);
  assert.equal(got[0].uid, 'near');
});

test('selectTargets — 광역은 사거리 내 전체', () => {
  const t = tower({ atkType: 'aoe', range: 5 });
  const got = Combat.selectTargets(t, [enemy({ x: 1, y: 0 }), enemy({ x: 4, y: 0 }), enemy({ x: 9, y: 0 })]);
  assert.equal(got.length, 2);
});

test('selectTargets — 버프 타워는 타겟 없음', () => {
  assert.deepEqual(Combat.selectTargets(tower({ atkType: 'buff' }), [enemy()]), []);
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/combat.test.js`
Expected: FAIL ("Cannot find module '../src/combat.js'")

- [ ] **Step 3: `src/combat.js` 1차 구현 (거리 + 타겟)**

```javascript
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
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/combat.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/combat.js tests/combat.test.js
git commit -m "✨ combat.js: 거리 계산 + 타겟 선택(단일/광역/버프)"
```

---

## Task 6: `combat.js` (2/3) — 버프 + 타격 해소(데미지/슬로우)

**Files:**
- Modify: `src/combat.js`
- Test: `tests/combat.test.js` (테스트 추가)

- [ ] **Step 1: 실패 테스트 추가** — 파일 끝에 append

```javascript
test('buffMultipliers — 버프 타워 반경 내면 공격력↑·공속 오버라이드', () => {
  const Combat = require('../src/combat.js');
  const buffT = { uid: 'b', atkType: 'buff', x: 0, y: 0, range: 0 };
  const ally = { uid: 'a', atkType: 'single', x: 1, y: 0, damage: 100, atkSpeed: 1 };
  const m = Combat.buffMultipliers(ally, [buffT]);
  assert.equal(m.dmgMult, 1.25);
  assert.equal(m.atkSpeed, 1.75);
});

test('buffMultipliers — 버프 없으면 기본', () => {
  const Combat = require('../src/combat.js');
  const ally = { uid: 'a', atkType: 'single', x: 100, y: 0, atkSpeed: 1 };
  const m = Combat.buffMultipliers(ally, []);
  assert.equal(m.dmgMult, 1);
  assert.equal(m.atkSpeed, 1); // 자기 공속 유지
});

test('resolveHit — 단일은 데미지만, 슬로우는 둔화까지', () => {
  const Combat = require('../src/combat.js');
  const e1 = { hp: 100, slowUntil: 0 };
  Combat.resolveHit({ atkType: 'single', damage: 30 }, e1, 0);
  assert.equal(e1.hp, 70);
  assert.equal(e1.slowUntil, 0);

  const e2 = { hp: 100, slowUntil: 0 };
  Combat.resolveHit({ atkType: 'slow', damage: 30 }, e2, 5);
  assert.equal(e2.hp, 70);
  assert.equal(e2.slowUntil, 7); // now(5) + SLOW_DURATION(2)
});

test('effectiveSpeed — 슬로우 적용 중이면 ×SLOW_FACTOR', () => {
  const Combat = require('../src/combat.js');
  const e = { baseSpeed: 1, slowUntil: 10 };
  assert.equal(Combat.effectiveSpeed(e, 5), 0.6);  // 슬로우 중
  assert.equal(Combat.effectiveSpeed(e, 11), 1.0); // 만료
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/combat.test.js`
Expected: FAIL (`buffMultipliers is not a function` 등)

- [ ] **Step 3: `combat.js`에 함수 추가** — `dist`/`selectTargets` 아래, export 위에 삽입

```javascript
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
```

그리고 export 객체에 추가:

```javascript
const combat = { dist, selectTargets, buffMultipliers, resolveHit, effectiveSpeed };
```

> 주의: `resolveHit`은 `tower.damage`를 그대로 쓴다. 버프 배수는 발사 시점에 `tower.damage × dmgMult`로 적용된 값을 넘기도록 Task 7의 `tick`에서 처리한다.

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/combat.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/combat.js tests/combat.test.js
git commit -m "✨ combat.js: 버프 배수 + 타격 해소(데미지/슬로우) + 감속"
```

---

## Task 7: `combat.js` (3/3) — 이동 + 틱 오케스트레이션

**Files:**
- Modify: `src/combat.js`
- Test: `tests/combat.test.js` (테스트 추가)

순환 경로 모델: `path` = 닫힌 폴리라인 `[{x,y}, ...]`. `pathLength`로 정규화. `pathPointAt(path, pos)`는 `pos`(0~총길이) 위치의 `{x,y}` 반환, 끝을 넘으면 wrap.

- [ ] **Step 1: 실패 테스트 추가**

```javascript
test('pathPointAt — 정사각 루프를 따라 위치 계산 + wrap', () => {
  const Combat = require('../src/combat.js');
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]; // 둘레 40
  assert.deepEqual(Combat.pathPointAt(path, 0), { x: 0, y: 0 });
  assert.deepEqual(Combat.pathPointAt(path, 5), { x: 5, y: 0 });
  assert.deepEqual(Combat.pathPointAt(path, 40), { x: 0, y: 0 }); // 한 바퀴 = 시작점
  assert.deepEqual(Combat.pathPointAt(path, 45), { x: 5, y: 0 }); // wrap
});

test('tick — 적 이동 + 타워 발사 + 사망 처리(골드 콜백)', () => {
  const Combat = require('../src/combat.js');
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const enemies = [{ uid: 'e', role: 'swarm', hp: 40, maxHp: 40, baseSpeed: 1, pathPos: 1, x: 1, y: 0, slowUntil: 0 }];
  const towers = [{ uid: 't', atkType: 'single', damage: 50, atkSpeed: 1, range: 3, x: 1, y: 0, cooldown: 0, tier: 1 }];
  const dead = [];
  Combat.tick({ towers, enemies, path }, 1, 0, (e) => dead.push(e.uid));
  assert.equal(enemies[0].hp <= 0, true); // 50 데미지로 사망
  // tick 내부에서 사망 적은 enemies에서 제거되고 콜백 호출
  assert.deepEqual(dead, ['e']);
  assert.equal(enemies.length, 0);
});

test('tick — 적은 죽지 않으면 경로를 계속 돈다(누수/제거 없음)', () => {
  const Combat = require('../src/combat.js');
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const enemies = [{ uid: 'e', role: 'tank', hp: 9999, maxHp: 9999, baseSpeed: 2, pathPos: 39, x: 0, y: 10, slowUntil: 0 }];
  Combat.tick({ towers: [], enemies, path }, 1, 0, () => {});
  assert.equal(enemies.length, 1);          // 제거 안 됨
  assert.ok(enemies[0].pathPos < 40);        // wrap 되어 계속 순환
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/combat.test.js`
Expected: FAIL (`pathPointAt is not a function`)

- [ ] **Step 3: `combat.js`에 이동/틱 추가**

```javascript
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
 * @param state {towers, enemies, path}
 * @param dt 초
 * @param now 누적 시각(초) — 슬로우 만료 판정
 * @param onKill (enemy) => void  사망 콜백(골드 지급은 game이 담당)
 */
function tick(state, dt, now, onKill) {
  const total = pathLength(state.path);
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
    const targets = selectTargets(t, state.enemies);
    for (const e of targets) {
      resolveHit({ atkType: t.atkType, damage: t.damage * buff.dmgMult }, e, now);
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
```

export 객체 갱신:

```javascript
const combat = { dist, selectTargets, buffMultipliers, resolveHit, effectiveSpeed, pathLength, pathPointAt, tick };
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/combat.test.js`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/combat.js tests/combat.test.js
git commit -m "✨ combat.js: 순환 경로 이동 + 틱 오케스트레이션"
```

---

## Task 8: `game.js` (1/4) — 상태 + 소유 카운트 + 지급

**Files:**
- Create: `src/game.js`
- Test: `tests/game.test.js`

Game은 결정성을 위해 `rng` 함수(기본 `Math.random`)를 주입받는다. 테스트는 고정 시퀀스 rng를 넘긴다.

- [ ] **Step 1: 실패 테스트 작성**

`tests/game.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const Alchemy = require('../src/alchemy.js');
const WaveSystem = require('../src/wavesystem.js');
const recipes = require('../data/recipes.json');
const enemies = require('../data/enemies.json');
const Game = require('../src/game.js');

const seqRng = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
function newGame(rng = seqRng([0])) {
  return new Game({ alchemy: new Alchemy(recipes), waveSystem: new WaveSystem(enemies), rng });
}

test('시작 시 tier1 원소 5개 지급, 골드 0, 웨이브 0', () => {
  const g = newGame();
  const total = Object.values(g.ownedCounts()).reduce((s, n) => s + n, 0);
  assert.equal(total, 5);
  assert.equal(g.gold, 0);
  assert.equal(g.wave, 0);
  // 지급된 건 전부 tier1
  for (const id of Object.keys(g.ownedCounts())) {
    assert.equal(g.alchemy.get(id).tier, 1);
  }
});

test('grantRandomElements — rng로 tier1 결정적 선택', () => {
  // rng=0 → 원소 목록 첫 번째(water)
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; // 초기 지급분 비우고 테스트
  g.grantRandomElements(2);
  assert.equal(g.ownedCounts().water, 2);
});

test('ownedCounts — 벤치 + 배치 타워 합산', () => {
  const g = newGame(seqRng([0]));
  g.bench = { fire: 1 };
  g.towers = [{ unitId: 'fire' }];
  assert.equal(g.ownedCounts().fire, 2);
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/game.test.js`
Expected: FAIL ("Cannot find module '../src/game.js'")

- [ ] **Step 3: `src/game.js` 1차 구현**

```javascript
const CONFIG = (typeof require !== 'undefined') ? require('./config.js') : globalThis.CONFIG;
const Stats = (typeof require !== 'undefined') ? require('./stats.js') : globalThis.stats;

class Game {
  constructor({ alchemy, waveSystem, rng = Math.random }) {
    this.alchemy = alchemy;
    this.waveSystem = waveSystem;
    this.rng = rng;
    this.gold = 0;
    this.wave = 0;
    this.phase = 'prep';        // 'prep' | 'combat'
    this.bench = {};            // {unitId: count} 미배치 소유분
    this.towers = [];           // 배치된 타워 인스턴스
    this.enemies = [];
    this.upgrades = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.bossTokens = 0;        // 원소 선택권
    this.gameOver = false;
    this.victory = false;
    this._uid = 0;
    this._tier1 = alchemy.byTier(1).map((u) => u.id);
    this.grantRandomElements(CONFIG.START_ELEMENTS);
  }

  /** 벤치 + 배치 타워를 합산한 소유 개수 {unitId: count} */
  ownedCounts() {
    const out = { ...this.bench };
    for (const t of this.towers) out[t.unitId] = (out[t.unitId] || 0) + 1;
    return out;
  }

  /** rng로 tier1 원소를 n개 벤치에 추가 */
  grantRandomElements(n) {
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.rng() * this._tier1.length);
      const id = this._tier1[idx];
      this.bench[id] = (this.bench[id] || 0) + 1;
    }
  }

  nextUid() { return `u${this._uid++}`; }
}

if (typeof module !== 'undefined' && module.exports) module.exports = Game;
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/game.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/game.js tests/game.test.js
git commit -m "✨ game.js: 상태 초기화 + 소유 카운트 + 원소 지급"
```

---

## Task 9: `game.js` (2/4) — 배치/회수 + 조합

**Files:**
- Modify: `src/game.js`
- Test: `tests/game.test.js` (테스트 추가)

- [ ] **Step 1: 실패 테스트 추가**

```javascript
test('place — 벤치 원소를 보드 슬롯에 배치(타워 생성, 능력치 부여)', () => {
  const g = newGame(seqRng([0]));
  g.bench = { water: 1 }; g.towers = [];
  const t = g.place('water', { x: 3, y: 4 });
  assert.equal(g.bench.water, undefined);   // 벤치에서 빠짐
  assert.equal(g.towers.length, 1);
  assert.equal(t.unitId, 'water');
  assert.equal(t.atkType, 'slow');
  assert.ok(t.damage >= 10 && t.damage <= 15);
  assert.equal(t.x, 3);
});

test('place — 보유하지 않은 유닛은 배치 불가(null)', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = [];
  assert.equal(g.place('fire', { x: 0, y: 0 }), null);
});

test('combine — 재료를 소유하면 합성 성공, 결과는 벤치로', () => {
  const g = newGame(seqRng([0]));
  g.bench = { water: 1, fire: 1 }; g.towers = [];
  const ok = g.combine('steam');
  assert.equal(ok, true);
  const owned = g.ownedCounts();
  assert.equal(owned.water, undefined);
  assert.equal(owned.fire, undefined);
  assert.equal(owned.steam, 1);
});

test('combine — 재료가 보드에 배치돼 있어도 소유 기준으로 합성', () => {
  const g = newGame(seqRng([0]));
  g.bench = { water: 1 };
  g.towers = [{ uid: 'x', unitId: 'fire', atkType: 'aoe' }];
  const ok = g.combine('steam');
  assert.equal(ok, true);
  assert.equal(g.towers.find((t) => t.unitId === 'fire'), undefined); // 보드 fire 소모됨
  assert.equal(g.ownedCounts().steam, 1);
});

test('combine — 재료 부족이면 실패(false)', () => {
  const g = newGame(seqRng([0]));
  g.bench = { water: 1 }; g.towers = [];
  assert.equal(g.combine('steam'), false);
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/game.test.js`
Expected: FAIL (`g.place is not a function`)

- [ ] **Step 3: `game.js`에 메서드 추가** — `nextUid()` 아래에 삽입

```javascript
  /** 벤치의 unitId 1개를 보드 위치 pos에 타워로 배치. 없으면 null. */
  place(unitId, pos) {
    if (!this.bench[unitId]) return null;
    this.bench[unitId] -= 1;
    if (this.bench[unitId] <= 0) delete this.bench[unitId];
    const s = Stats.deriveStats(this.alchemy, unitId);
    const tower = {
      uid: this.nextUid(),
      unitId,
      tier: s.tier,
      atkType: s.atkType,
      damage: Stats.rollDamage(s.damageBand, this.rng()),
      atkSpeed: s.atkSpeed,
      range: s.range,
      x: pos.x, y: pos.y,
      cooldown: 0,
    };
    this.towers.push(tower);
    return tower;
  }

  /** 배치 타워를 회수해 벤치로 되돌림. */
  recall(uid) {
    const idx = this.towers.findIndex((t) => t.uid === uid);
    if (idx < 0) return false;
    const t = this.towers[idx];
    this.towers.splice(idx, 1);
    this.bench[t.unitId] = (this.bench[t.unitId] || 0) + 1;
    return true;
  }

  /** resultId 합성: 소유(벤치+보드)에서 재료 소모, 결과는 벤치로. */
  combine(resultId) {
    const unit = this.alchemy.get(resultId);
    if (!unit || !unit.inputs) return false;
    const need = {};
    for (const id of unit.inputs) need[id] = (need[id] || 0) + 1;
    const owned = this.ownedCounts();
    for (const [id, cnt] of Object.entries(need)) {
      if ((owned[id] || 0) < cnt) return false;
    }
    // 소모: 벤치 우선, 부족분은 보드 타워에서 제거
    for (const [id, cnt] of Object.entries(need)) {
      let remaining = cnt;
      const fromBench = Math.min(remaining, this.bench[id] || 0);
      if (fromBench > 0) {
        this.bench[id] -= fromBench;
        if (this.bench[id] <= 0) delete this.bench[id];
        remaining -= fromBench;
      }
      while (remaining > 0) {
        const idx = this.towers.findIndex((t) => t.unitId === id);
        this.towers.splice(idx, 1);
        remaining -= 1;
      }
    }
    this.bench[resultId] = (this.bench[resultId] || 0) + 1;
    return true;
  }
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/game.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/game.js tests/game.test.js
git commit -m "✨ game.js: 배치/회수 + 조합(소유 기준 재료 소모)"
```

---

## Task 10: `game.js` (3/4) — 경제(업그레이드/도박/가챠/보스토큰)

**Files:**
- Modify: `src/game.js`
- Test: `tests/game.test.js` (테스트 추가)

- [ ] **Step 1: 실패 테스트 추가**

```javascript
test('upgrade — 골드 충분하면 레벨+1, 골드 차감', () => {
  const g = newGame(seqRng([0]));
  g.gold = 100;
  const ok = g.upgrade(1); // tier1 첫 레벨 = 20
  assert.equal(ok, true);
  assert.equal(g.upgrades[1], 1);
  assert.equal(g.gold, 80);
});

test('upgrade — 골드 부족이면 실패', () => {
  const g = newGame(seqRng([0]));
  g.gold = 5;
  assert.equal(g.upgrade(1), false);
  assert.equal(g.upgrades[1], 0);
});

test('damageMultiplier — 티어 레벨당 +1%', () => {
  const g = newGame(seqRng([0]));
  g.upgrades[2] = 50;
  assert.ok(Math.abs(g.damageMultiplier(2) - 1.5) < 1e-9);
});

test('gamble — rng로 순손익 결정, 골드 반영', () => {
  // gambleResult(1000, 0.5) = floor(0.5×2001) − 1000 = 0 (순손익 0)
  const g = newGame(seqRng([0.5]));
  g.gold = 1000;
  const net = g.gamble(1000);
  assert.equal(net, 0);
  assert.equal(g.gold, 1000);
});

test('gamble — 베팅액보다 골드 적으면 실패', () => {
  const g = newGame(seqRng([0]));
  g.gold = 50;
  assert.equal(g.gamble(100), false);
});

test('gacha — 성공 시 해당 티어 유닛 획득 + 골드 차감', () => {
  // rng[0]=0.0(<0.5 성공), rng[1]=0(첫 tier1 유닛)
  const g = newGame(seqRng([0, 0]));
  g.bench = {}; g.towers = [];
  g.gold = 1000;
  const res = g.gacha(1);
  assert.equal(res.success, true);
  assert.equal(g.gold, 0);
  assert.equal(Object.values(g.ownedCounts()).reduce((s, n) => s + n, 0), 1);
});

test('gacha — 실패 시 골드만 소모', () => {
  const g = newGame(seqRng([0.99])); // >0.5 실패
  g.bench = {}; g.towers = [];
  g.gold = 1000;
  const res = g.gacha(1);
  assert.equal(res.success, false);
  assert.equal(g.gold, 0);
  assert.equal(Object.values(g.ownedCounts()).reduce((s, n) => s + n, 0), 0);
});

test('redeemToken — 보스 토큰으로 원하는 tier1 원소 획득', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; g.bossTokens = 2;
  assert.equal(g.redeemToken('fire'), true);
  assert.equal(g.bossTokens, 1);
  assert.equal(g.ownedCounts().fire, 1);
  // 토큰 0이면 실패
  g.bossTokens = 0;
  assert.equal(g.redeemToken('fire'), false);
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/game.test.js`
Expected: FAIL (`g.upgrade is not a function`)

- [ ] **Step 3: `game.js`에 경제 메서드 추가** — `combine()` 아래에 삽입. 파일 상단 require에 balance 추가:

상단(기존 require 줄 아래)에:

```javascript
const balance = (typeof require !== 'undefined') ? require('./balance.js') : globalThis.balance;
```

메서드:

```javascript
  /** 티어 공격력 업그레이드(레벨+1). 골드 부족/최대레벨이면 false. */
  upgrade(tier) {
    if (this.upgrades[tier] >= CONFIG.UPGRADE_MAX_LEVEL) return false;
    const cost = CONFIG.UPGRADE_COST(tier, this.upgrades[tier]);
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.upgrades[tier] += 1;
    return true;
  }

  /** 티어의 현재 데미지 배수 (1 + 레벨×0.01). */
  damageMultiplier(tier) {
    return 1 + this.upgrades[tier] * CONFIG.UPGRADE_PER_LEVEL;
  }

  /** 도박: 베팅액만큼 보유해야 함. 순손익 −bet~+bet. */
  gamble(bet) {
    if (!CONFIG.GAMBLE_BETS.includes(bet) || this.gold < bet) return false;
    const net = balance.gambleResult(bet, this.rng());
    this.gold += net;
    return net;
  }

  /** 가챠: 티어별 비용·확률. 성공 시 해당 티어 유닛 랜덤 1개 벤치로. */
  gacha(tier) {
    const g = CONFIG.GACHA[tier];
    if (!g || this.gold < g.cost) return { success: false, reason: 'gold' };
    this.gold -= g.cost;
    if (this.rng() >= g.rate) return { success: false };
    const pool = this.alchemy.byTier(tier).map((u) => u.id);
    const id = pool[Math.floor(this.rng() * pool.length)];
    this.bench[id] = (this.bench[id] || 0) + 1;
    return { success: true, id };
  }

  /** 보스 토큰 사용: 원하는 tier1 원소를 직접 획득. */
  redeemToken(elementId) {
    if (this.bossTokens <= 0) return false;
    const u = this.alchemy.get(elementId);
    if (!u || u.tier !== 1) return false;
    this.bossTokens -= 1;
    this.bench[elementId] = (this.bench[elementId] || 0) + 1;
    return true;
  }
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test tests/game.test.js`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add src/game.js tests/game.test.js
git commit -m "✨ game.js: 경제(업그레이드/도박/가챠/보스 토큰)"
```

---

## Task 11: `game.js` (4/4) — 스폰 + 웨이브 흐름 + 게임오버 + 전투 통합

**Files:**
- Modify: `src/game.js`
- Test: `tests/game.test.js` (테스트 추가)

스폰: 웨이브 시작 시 `composeWave`로 적 구성을 만들고, 총 마릿수를 `SPAWN_PER_ROUND`(보스 제외)로 정규화해 스폰 큐에 적재. HP는 `balance.enemyHP(role, wave)`. 보스 캡 가중치 8.

- [ ] **Step 1: 실패 테스트 추가**

```javascript
test('startWave — 웨이브+1, 전투 전환, 스폰 큐 적재(HP 공식 적용)', () => {
  const g = newGame(seqRng([0]));
  g.path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  g.startWave();
  assert.equal(g.wave, 1);
  assert.equal(g.phase, 'combat');
  // startWave는 스폰 큐만 채운다(실제 투입은 _spawnTick). 큐 HP는 balance 공식.
  assert.ok(g.spawnQueue.length > 0);
  for (const s of g.spawnQueue) assert.ok(s.hp > 0);
  // update 1틱 후 첫 적이 경로에 투입됨
  g.update(0.5);
  assert.ok(g.enemies.length >= 1);
  assert.equal(g.enemies[0].maxHp, g.enemies[0].hp);
});

test('boardWeight — 일반 1, 보스 8 카운트', () => {
  const g = newGame(seqRng([0]));
  g.enemies = [
    { role: 'swarm' }, { role: 'tank' }, { role: 'boss' },
  ];
  assert.equal(g.boardWeight(), 1 + 1 + 8);
});

test('게임오버 — 보드 가중치 > 100', () => {
  const g = newGame(seqRng([0]));
  g.enemies = Array.from({ length: 101 }, () => ({ role: 'swarm' }));
  g.checkGameOver();
  assert.equal(g.gameOver, true);
});

test('웨이브 클리어 — 적 전멸 시 prep 복귀 + tier1 원소 2개 지급', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = [];
  g.phase = 'combat'; g.wave = 3; g.enemies = [];
  g.update(0.1); // 전투 중 적 0 → 클리어 처리
  assert.equal(g.phase, 'prep');
  assert.equal(Object.values(g.ownedCounts()).reduce((s, n) => s + n, 0), 2);
});

test('보스 웨이브 클리어 시 보스 토큰 ×3 지급', () => {
  const g = newGame(seqRng([0]));
  g.phase = 'combat'; g.enemies = [];
  g.wave = 10; g._wasBoss = true;
  g.update(0.1);
  assert.equal(g.bossTokens, 1); // w10 = 1개
  g.wave = 20; g._wasBoss = true; g.phase = 'combat'; g.enemies = [];
  g.update(0.1);
  assert.equal(g.bossTokens, 1 + 3); // w20 = +3
});

test('40웨이브 클리어 시 승리', () => {
  const g = newGame(seqRng([0]));
  g.phase = 'combat'; g.enemies = []; g.wave = 40; g._wasBoss = true;
  g.update(0.1);
  assert.equal(g.victory, true);
});
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `node --test tests/game.test.js`
Expected: FAIL (`g.startWave is not a function`)

- [ ] **Step 3: `game.js`에 흐름/스폰/전투 통합 추가**

상단 require에 Combat 추가:

```javascript
const Combat = (typeof require !== 'undefined') ? require('./combat.js') : globalThis.combat;
```

생성자 끝부분(`grantRandomElements` 호출 위)에 필드 추가:

```javascript
    this.path = [];        // main에서 주입
    this.now = 0;          // 누적 시각(초)
    this.spawnQueue = [];  // [{id, role, hp}] 남은 스폰
    this.spawnTimer = 0;
    this._wasBoss = false;
```

메서드 추가(`redeemToken` 아래):

```javascript
  /** 보드 위 적의 가중치 합(보스 8). */
  boardWeight() {
    return this.enemies.reduce(
      (s, e) => s + (e.role === 'boss' ? CONFIG.BOSS_CAP_WEIGHT : 1), 0
    );
  }

  checkGameOver() {
    if (this.boardWeight() > CONFIG.GAME_OVER_CAP) this.gameOver = true;
  }

  /** 다음 웨이브 시작: 적 구성 → 스폰 큐 적재, 전투 단계로. */
  startWave() {
    if (this.phase !== 'prep' || this.gameOver || this.victory) return;
    this.wave += 1;
    this.phase = 'combat';
    const comp = this.waveSystem.composeWave(this.wave);
    this._wasBoss = comp.type === 'boss';
    // 일반 적 총량을 SPAWN_PER_ROUND로 정규화 (보스는 별도 1)
    const normals = comp.spawns.filter((s) => s.role !== 'boss');
    const rawTotal = normals.reduce((s, x) => s + x.count, 0) || 1;
    const scale = CONFIG.SPAWN_PER_ROUND / rawTotal;
    const queue = [];
    for (const s of normals) {
      const n = Math.max(1, Math.round(s.count * scale));
      for (let i = 0; i < n; i++) {
        queue.push({ id: s.id, role: s.role, hp: balance.enemyHP(s.role, this.wave) });
      }
    }
    for (const s of comp.spawns.filter((x) => x.role === 'boss')) {
      queue.push({ id: s.id, role: s.role, hp: balance.enemyHP('boss', this.wave) });
    }
    this.spawnQueue = queue;
    this.spawnTimer = 0;
  }

  /** 스폰 큐에서 0.4초 간격으로 1마리씩 경로 시작점에 투입. */
  _spawnTick(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 0.4;
    const s = this.spawnQueue.shift();
    const start = this.path.length ? this.path[0] : { x: 0, y: 0 };
    this.enemies.push({
      uid: this.nextUid(),
      id: s.id, role: s.role,
      hp: s.hp, maxHp: s.hp,
      baseSpeed: 1.0,
      x: start.x, y: start.y, pathPos: 0, slowUntil: 0,
    });
  }

  /** 전투 중 적 사망 시 골드 지급 콜백. */
  _onKill(enemy) {
    this.gold += CONFIG.GOLD_PER_KILL[enemy.role] || 5;
  }

  /** 웨이브 클리어 처리: 보상 지급 + prep 복귀(또는 승리). */
  _clearWave() {
    this.phase = 'prep';
    if (this._wasBoss) {
      // 보스 토큰: w10=1, w20=3, w30=9, w40=27 = BASE × 3^(보스인덱스-1)
      const bossIndex = this.wave / 10;
      this.bossTokens += CONFIG.BOSS_TOKEN_BASE * Math.pow(3, bossIndex - 1);
      this._wasBoss = false;
    }
    if (this.wave >= CONFIG.MAX_WAVE) { this.victory = true; return; }
    this.grantRandomElements(CONFIG.WAVE_CLEAR_ELEMENTS);
  }

  /** 메인 루프 1틱. prep에서는 아무 것도 진행하지 않음. */
  update(dt) {
    if (this.phase !== 'combat' || this.gameOver || this.victory) return;
    this.now += dt;
    this._spawnTick(dt);
    Combat.tick({ towers: this.towers, enemies: this.enemies, path: this.path }, dt, this.now, (e) => this._onKill(e));
    this.checkGameOver();
    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this._clearWave();
    }
  }
```

> 데미지 업그레이드 반영: `Combat.tick`은 `tower.damage`를 직접 쓰므로, 업그레이드 배수를 타워에 반영하려면 `_onKill`이 아니라 발사 데미지에 곱해야 한다. 간단히, `update`에서 tick 호출 전 각 타워의 유효 데미지를 `damage × damageMultiplier(tier)`로 임시 필드에 넣는 대신, **Task 11에서는 combat이 `tower.damage`를 쓰도록 두고, place 시 곱하지 않은 원본 damage를 저장**한다. 업그레이드 실시간 반영은 아래 Step 4 후 보강 커밋에서 `Combat.tick`에 `dmgScale(tier)` 콜백을 넘기는 방식으로 처리한다(렌더 통합 시 함께). 프로토타입 테스트 단계에서는 배수 함수(`damageMultiplier`)의 정확성만 검증한다.

- [ ] **Step 4: 실행 → 통과 확인**

Run: `node --test`
Expected: PASS (전체 회귀 포함)

- [ ] **Step 5: 업그레이드 배수를 전투에 실제 반영** — `Combat.tick` 시그니처에 선택적 `dmgScale(tower)` 추가

`src/combat.js`의 `tick`에서 발사 부분을 수정:

```javascript
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
```

`game.js`의 `update`에서 tick 호출에 `dmgScale` 주입:

```javascript
    Combat.tick(
      { towers: this.towers, enemies: this.enemies, path: this.path, dmgScale: (t) => this.damageMultiplier(t.tier) },
      dt, this.now, (e) => this._onKill(e)
    );
```

테스트 추가(`tests/combat.test.js` 끝):

```javascript
test('tick — dmgScale로 업그레이드 배수 반영', () => {
  const Combat = require('../src/combat.js');
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const enemies = [{ uid: 'e', role: 'swarm', hp: 100, maxHp: 100, baseSpeed: 0, pathPos: 0, x: 0, y: 0, slowUntil: 0 }];
  const towers = [{ uid: 't', atkType: 'single', damage: 10, atkSpeed: 1, range: 3, x: 0, y: 0, cooldown: 0, tier: 1 }];
  Combat.tick({ towers, enemies, path, dmgScale: () => 2 }, 1, 0, () => {});
  assert.equal(enemies[0].hp, 80); // 10 × 2배 = 20 데미지
});
```

Run: `node --test`
Expected: PASS (전체)

- [ ] **Step 6: Commit**

```bash
git add src/game.js src/combat.js tests/game.test.js tests/combat.test.js
git commit -m "✨ game.js: 스폰·웨이브 흐름·게임오버·전투 통합 + 업그레이드 배수 반영"
```

---

## Task 12: 렌더 레이어 — `index.html` + `render.js` + `main.js` (수동 검증)

**Files:**
- Create: `index.html`
- Create: `src/render.js`
- Create: `src/main.js`

이 레이어는 브라우저 전용이라 단위 테스트 대신 **수동 검증**한다.

- [ ] **Step 1: `index.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>Elemancy — 원소 연금술 조합 디펜스 (프로토타입)</title>
  <style>
    body { margin: 0; background: #0b0d17; color: #e6e8f0; font-family: system-ui, sans-serif; display: flex; }
    #game { display: block; background: #11142a; }
    #panel { width: 280px; padding: 12px; }
    .hud { font-size: 14px; line-height: 1.8; }
    button { margin: 2px; padding: 6px 10px; background: #2a3170; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
    button:disabled { opacity: .4; cursor: default; }
    .danger { color: #ff7a7a; }
  </style>
</head>
<body>
  <canvas id="game" width="640" height="640"></canvas>
  <div id="panel">
    <div class="hud" id="hud"></div>
    <hr />
    <div id="actions">
      <button id="nextWave">다음 웨이브 ▶</button>
    </div>
    <div id="combinePanel"></div>
  </div>
  <script src="src/config.js"></script>
  <script src="src/balance.js"></script>
  <script src="src/alchemy.js"></script>
  <script src="src/wavesystem.js"></script>
  <script src="src/stats.js"></script>
  <script src="src/combat.js"></script>
  <script src="src/game.js"></script>
  <script src="src/render.js"></script>
  <script src="src/main.js"></script>
</body>
</html>
```

> 브라우저 전역 호환: `alchemy.js`/`wavesystem.js`는 `class X` 선언이라 전역 접근 가능. `config`/`balance`/`stats`/`combat`은 `const NAME = {...}`로 전역. `game.js`는 `class Game`. 단, 브라우저에서 `require`가 없으므로 각 모듈의 `(typeof require !== ...) ? require(...) : globalThis.NAME` 폴백이 동작하려면 전역 이름이 일치해야 한다 → 각 파일 끝에 `if (typeof window !== 'undefined') window.NAME = NAME;`를 추가(아래 Step 2).

- [ ] **Step 2: 각 로직 모듈에 브라우저 전역 노출 추가**

`config.js` 끝:
```javascript
if (typeof window !== 'undefined') window.CONFIG = CONFIG;
```
`balance.js` 끝:
```javascript
if (typeof window !== 'undefined') window.balance = balance;
```
`stats.js` 끝:
```javascript
if (typeof window !== 'undefined') window.stats = stats;
```
`combat.js` 끝:
```javascript
if (typeof window !== 'undefined') window.combat = combat;
```

> `game.js`의 require 폴백은 `globalThis.stats`/`globalThis.balance`/`globalThis.combat`/`globalThis.CONFIG`를 읽으므로 위 전역 노출로 충족된다. 데이터(`recipes.json`/`enemies.json`)는 `main.js`에서 `fetch`로 로드한다.

- [ ] **Step 3: `src/render.js` 작성** — `game` 상태를 캔버스에 그림

```javascript
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
  // 적 (HP 비율 색)
  for (const e of game.enemies) {
    const r = e.role === 'boss' ? 16 : 8;
    ctx.fillStyle = e.role === 'boss' ? '#ff3df0' : '#c66';
    ctx.beginPath();
    ctx.arc(e.x * TILE, e.y * TILE, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderHud(game) {
  const danger = game.boardWeight() > 80 ? 'danger' : '';
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
```

- [ ] **Step 4: `src/main.js` 작성** — 데이터 로드 + 입력 + rAF 루프

```javascript
async function boot() {
  const [recipes, enemies] = await Promise.all([
    fetch('data/recipes.json').then((r) => r.json()),
    fetch('data/enemies.json').then((r) => r.json()),
  ]);
  const alchemy = new Alchemy(recipes);
  const waveSystem = new WaveSystem(enemies);
  const game = new Game({ alchemy, waveSystem });

  // 정사각 순환 경로 (격자 단위). 캔버스 640px = 10칸.
  game.path = [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }];

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const combinePanel = document.getElementById('combinePanel');

  document.getElementById('nextWave').onclick = () => game.startWave();

  // 빈 슬롯(경로 안쪽 격자)에 벤치 첫 원소 배치 — 프로토타입 단순 입력
  canvas.onclick = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const gx = Math.round((ev.clientX - rect.left) / 64);
    const gy = Math.round((ev.clientY - rect.top) / 64);
    if (gx <= 1 || gx >= 9 || gy <= 1 || gy >= 9) return; // 안쪽만
    const benchId = Object.keys(game.bench)[0];
    if (benchId) game.place(benchId, { x: gx, y: gy });
  };

  // 조합 패널: 소유 유닛 클릭 → 만들 수 있는 상위 유닛 + [조합] 버튼
  function renderCombine() {
    const owned = game.ownedCounts();
    const ids = Object.keys(owned);
    combinePanel.innerHTML = '<hr/><div>조합 가능:</div>';
    const craftable = game.alchemy.craftable(owned);
    for (const id of craftable) {
      const btn = document.createElement('button');
      btn.textContent = `${game.alchemy.name(id)} 조합`;
      btn.onclick = () => game.combine(id);
      combinePanel.appendChild(btn);
    }
  }

  let last = performance.now();
  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    game.update(dt);
    drawGame(ctx, game);
    hud.innerHTML = renderHud(game);
    renderCombine();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
boot();
```

- [ ] **Step 5: 수동 검증** — 로컬 정적 서버로 실행

Run:
```bash
cd /Users/kimsunil/Documents/GitHub/Elemancy
python3 -m http.server 8000
```
브라우저에서 `http://localhost:8000/` 열고 확인:
- [ ] HUD에 웨이브 0, 골드 0, 벤치에 원소 5개 표시
- [ ] 캔버스에 정사각 경로가 그려짐
- [ ] 경로 안쪽 클릭 → 타워(원) 생성, 색이 공격타입별로 다름
- [ ] "조합 가능" 목록에 물+불 등 보유 조합이 뜨고 [조합] 클릭 시 벤치가 바뀜
- [ ] "다음 웨이브" → 적이 경로를 돌고, 타워가 자동 공격해 적 HP 소진·소멸, 골드 증가
- [ ] 적을 못 잡고 쌓이면 몬스터 카운트가 100 넘을 때 "게임 오버" 표시
- [ ] 콘솔(`mcp__Claude_Preview__preview_console_logs` 또는 브라우저 devtools)에 에러 없음

- [ ] **Step 6: Commit**

```bash
git add index.html src/render.js src/main.js src/config.js src/balance.js src/stats.js src/combat.js
git commit -m "✨ 렌더 레이어 — index.html + render.js + main.js (플레이 가능 프로토타입)"
```

---

## Task 13: 밸런스 플레이테스트 체크리스트 (수동, 검증용)

**Files:**
- Create: `docs/superpowers/playtest-checklist.md`

- [ ] **Step 1: 체크리스트 문서 작성** — 재미·밸런스 검증 항목

`docs/superpowers/playtest-checklist.md`:

```markdown
# Elemancy 프로토타입 플레이테스트 체크리스트

## 핵심 질문: "조합 디펜스가 손이 가고 재밌는가?"

### 루프 검증
- [ ] 랜덤 원소로 무엇을 만들지 고민하는 재미가 있는가
- [ ] 조합 → 타워 강화의 인과가 체감되는가
- [ ] 역할(swarm/tank/fast) 섞인 웨이브에 공격타입 다양화가 강제되는가

### 밸런스 감각 (수치 조정은 config.js만 수정)
- [ ] seg1(1~10): tier1~2로 무난히 넘어가는가 (너무 쉽/어렵지 않은가)
- [ ] 보스(10/20/30/40)가 해당 tier 없이는 확실히 버거운가
- [ ] 몬스터 100 캡이 적절한 압박인가 (너무 빨리/느리게 차는가)
- [ ] 골드 수급 대비 업그레이드/가챠/도박 선택이 의미있는가
- [ ] 보스 토큰(1·3·9·27)이 후반 빈칸 메우기에 유효한가

### 관찰 기록 (친구/커뮤니티 반응)
- 가장 재밌던 순간:
- 가장 지루/답답한 순간:
- 즉시 그만두게 만든 요소:
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/playtest-checklist.md
git commit -m "📑 플레이테스트 체크리스트 — 재미·밸런스 검증 항목"
```

---

## 완료 기준

- `node --test` 전체 그린 (config/balance/stats/wavesystem/combat/game)
- 브라우저에서 플레이 가능: 원소 지급 → 조합 → 배치 → 웨이브 → 전투 → 골드/보상 → 게임오버/승리 루프 한 바퀴 동작
- `config.js` 한 곳에서 모든 밸런스 수치 조정 가능
- 플레이테스트 체크리스트로 친구·커뮤니티 반응 수집 준비 완료
