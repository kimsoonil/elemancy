const test = require('node:test');
const assert = require('node:assert/strict');
const Alchemy = require('../src/alchemy.js');
const WaveSystem = require('../src/wavesystem.js');
const recipes = require('../data/recipes.json');
const enemies = require('../data/enemies.json');
const Game = require('../src/game.js');
const CONFIG = require('../src/config.js');

const seqRng = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
function newGame(rng = seqRng([0])) {
  return new Game({ alchemy: new Alchemy(recipes), waveSystem: new WaveSystem(enemies), rng });
}

test('시작 시 무료 유닛 0, 시작 골드 600, 웨이브 0', () => {
  const g = newGame();
  const total = Object.values(g.ownedCounts()).reduce((s, n) => s + n, 0);
  assert.equal(total, CONFIG.START_ELEMENTS); // 0
  assert.equal(g.gold, CONFIG.START_GOLD);    // 600
  assert.equal(g.wave, 0);
});

test('grantRandomElements — rng로 tier1 결정적 선택', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = [];
  g.grantRandomElements(2);
  assert.equal(g.ownedCounts().water, 2);
});

test('ownedCounts — 벤치 + 배치 타워 합산', () => {
  const g = newGame(seqRng([0]));
  g.bench = { fire: 1 };
  g.towers = [{ unitId: 'fire' }];
  assert.equal(g.ownedCounts().fire, 2);
});

test('place — 벤치 원소를 보드 슬롯에 배치(타워 생성, 능력치 부여)', () => {
  const g = newGame(seqRng([0]));
  g.bench = { water: 1 }; g.towers = [];
  const t = g.place('water', { x: 3, y: 4 });
  assert.equal(g.bench.water, undefined);
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
  g.bench = { water: 1, fire: 1 }; g.towers = []; g.bossTokens = 1;
  const ok = g.combine('steam');
  assert.equal(ok, true);
  const owned = g.ownedCounts();
  assert.equal(owned.water, undefined);
  assert.equal(owned.fire, undefined);
  assert.equal(owned.steam, 1);
});

test('combine — 재료가 보드에 배치돼 있어도 소유 기준으로 합성', () => {
  const g = newGame(seqRng([0]));
  g.bench = { water: 1 }; g.bossTokens = 1;
  g.towers = [{ uid: 'x', unitId: 'fire', atkType: 'aoe' }];
  const ok = g.combine('steam');
  assert.equal(ok, true);
  assert.equal(g.towers.find((t) => t.unitId === 'fire'), undefined);
  assert.equal(g.ownedCounts().steam, 1);
});

test('combine — 재료 부족 + 선택권 없으면 실패', () => {
  const g = newGame(seqRng([0]));
  g.bench = { water: 1 }; g.towers = []; g.bossTokens = 0; // 불 없음, 토큰 0
  assert.equal(g.combine('steam'), false);
});

test('combineCost — 부족한 재료 수만큼 선택권 비용', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = [];
  g.bench = { electric: 1 };               // 자석=전기+금속, 금속 없음
  assert.equal(g.combineCost('magnet'), 1); // 금속 1 부족
  g.bench = { electric: 1, metal: 1 };
  assert.equal(g.combineCost('magnet'), 0); // 다 있으면 0(무료)
});

test('combine — 부족분을 선택권으로 메워 조합', () => {
  const g = newGame(seqRng([0]));
  g.bench = { electric: 1 }; g.towers = []; g.slots = []; g.bossTokens = 0;
  assert.equal(g.combine('magnet'), false);  // 금속 부족 + 토큰 0 → 실패
  g.bossTokens = 1;
  assert.equal(g.combine('magnet'), true);   // 선택권 1로 금속 대체 → 성공
  assert.equal(g.bossTokens, 0);             // 부족분 1 소모
  assert.equal(g.ownedCounts().electric, undefined); // 보유 전기는 소모됨
  assert.equal(g.ownedCounts().magnet, 1);
});

test('combine — 재료가 다 있으면 선택권 0(무료)', () => {
  const g = newGame(seqRng([0]));
  g.bench = { water: 1, fire: 1 }; g.towers = []; g.slots = []; g.bossTokens = 0;
  assert.equal(g.combineCost('steam'), 0);
  assert.equal(g.combine('steam'), true);    // 토큰 0이어도 성공
  assert.equal(g.bossTokens, 0);
});

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
  // gambleResult(1000, 0.5) = floor(0.5×2001) − 1000 = 0
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
  const g = newGame(seqRng([0, 0]));
  g.bench = {}; g.towers = [];
  g.gold = 1000;
  const res = g.gacha(1);
  assert.equal(res.success, true);
  assert.equal(g.gold, 0);
  assert.equal(Object.values(g.ownedCounts()).reduce((s, n) => s + n, 0), 1);
});

test('gacha — 실패 시 골드만 소모', () => {
  const g = newGame(seqRng([0.99]));
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
  g.bossTokens = 0;
  assert.equal(g.redeemToken('fire'), false);
});

test('startWave — 웨이브+1, 전투 전환, 스폰 큐 적재(HP 공식 적용)', () => {
  const g = newGame(seqRng([0]));
  g.path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  g.startWave();
  assert.equal(g.wave, 1);
  assert.equal(g.phase, 'combat');
  assert.ok(g.spawnQueue.length > 0);
  for (const s of g.spawnQueue) assert.ok(s.hp > 0);
  g.update(0.5);
  assert.ok(g.enemies.length >= 1);
  assert.equal(g.enemies[0].maxHp, g.enemies[0].hp);
});

test('boardWeight — 일반 1, 보스 8 카운트', () => {
  const g = newGame(seqRng([0]));
  g.enemies = [{ role: 'swarm' }, { role: 'tank' }, { role: 'boss' }];
  assert.equal(g.boardWeight(), 1 + 1 + 8);
});

test('게임오버 — 보드 가중치 > 100', () => {
  const g = newGame(seqRng([0]));
  g.enemies = Array.from({ length: 101 }, () => ({ role: 'swarm' }));
  g.checkGameOver();
  assert.equal(g.gameOver, true);
});

test('라운드 타이머 0 → 자동으로 다음 웨이브 시작 + 타이머 리셋', () => {
  const g = newGame(seqRng([0]));
  g.path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(g.wave, 0);
  g.update(CONFIG.ROUND_TIME + 0.01); // 30초 경과
  assert.equal(g.wave, 1);            // 자동 시작
  assert.ok(g.spawnQueue.length > 0);
  assert.ok(g.roundTimer > CONFIG.ROUND_TIME - 1); // 리셋됨
});

test('startWave 수동 호출 시 타이머 리셋', () => {
  const g = newGame(seqRng([0]));
  g.roundTimer = 3;
  g.startWave();
  assert.equal(g.wave, 1);
  assert.equal(g.roundTimer, CONFIG.ROUND_TIME);
});

test('startWave는 정액 200골드만 지급하고 무료 유닛은 없음', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; g.slots = []; g.gold = 0;
  g.startWave();
  assert.equal(g.gold, CONFIG.GOLD_PER_ROUND); // 200
  assert.equal(Object.values(g.ownedCounts()).reduce((s, n) => s + n, 0), 0); // 유닛 미지급
});

test('보스 처치 보상 — 골드 인덱스×1000 + 선택권 인덱스×3 + 3·4구간 전체핵', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; g.slots = [];
  g.gold = 0; g.bossTokens = 0;
  g._onKill({ role: 'boss', bossIndex: 1 }); // 골드 1000, 토큰 3
  assert.equal(g.gold, 1000); assert.equal(g.bossTokens, 3);
  g._onKill({ role: 'boss', bossIndex: 5 }); // 골드 +5000, 토큰 +15
  assert.equal(g.gold, 6000); assert.equal(g.bossTokens, 18);
  // 3·4구간 보스는 전체핵 1개씩 지급
  g._onKill({ role: 'boss', bossIndex: 3 });
  g._onKill({ role: 'boss', bossIndex: 4 });
  assert.equal(g.ownedCounts().wholecore, 2);
});

test('일반 적 처치는 역할별 소액 골드, 라운드는 200 정액', () => {
  const g = newGame(seqRng([0]));
  g.gold = 0;
  g._onKill({ role: 'swarm' });
  assert.equal(g.gold, CONFIG.GOLD_PER_KILL.swarm); // 5
});

test('마지막 웨이브(50) 후 전멸하면 승리', () => {
  const g = newGame(seqRng([0]));
  g.path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  g.wave = CONFIG.MAX_WAVE; g.spawnQueue = []; g.enemies = [];
  g.update(0.1);
  assert.equal(g.victory, true);
});

test('drawRandomUnit — 골드 차감 후 랜덤 tier1 1개 획득', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; g.gold = 1000;
  const id = g.drawRandomUnit();
  assert.equal(id, 'water');               // rng=0 → 첫 tier1(water)
  assert.equal(g.gold, 1000 - CONFIG.RANDOM_DRAW_COST);
  assert.equal(g.ownedCounts().water, 1);
  assert.equal(g.alchemy.get(id).tier, 1); // 항상 tier1
});

test('drawRandomUnit — 골드 부족이면 null', () => {
  const g = newGame(seqRng([0]));
  g.gold = 10;
  assert.equal(g.drawRandomUnit(), null);
});

test('autoPlace — 빈 슬롯에 차례로 배치', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; g.slots = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
  const a = g.autoPlace('water');
  assert.equal(g.towers.length, 1); assert.deepEqual([a.x, a.y], [2, 2]);
  const b = g.autoPlace('fire');
  assert.deepEqual([b.x, b.y], [3, 2]); // 다음 빈 슬롯
});

test('autoPlace — 슬롯이 꽉 차면 벤치로 폴백(null)', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; g.slots = [{ x: 2, y: 2 }];
  g.autoPlace('water');
  assert.equal(g.autoPlace('fire'), null);
  assert.equal(g.bench.fire, 1);
});

test('moveTower — 빈 칸으로 이동, 점유 칸은 거부', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; g.slots = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
  const a = g.autoPlace('water');
  const b = g.autoPlace('fire');
  assert.equal(g.moveTower(a.uid, { x: 5, y: 5 }), true);
  assert.deepEqual([a.x, a.y], [5, 5]);
  assert.equal(g.moveTower(a.uid, { x: 3, y: 2 }), false); // fire가 점유
});

test('drawRandomUnit — 슬롯 있으면 보드에 자동 배치', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; g.gold = 1000; g.slots = [{ x: 2, y: 2 }];
  const id = g.drawRandomUnit();
  assert.equal(g.towers.length, 1);
  assert.equal(g.towers[0].unitId, id);
});

test('전체핵 = 1단계 8원소, 6단계는 전체핵 1개 필요', () => {
  const g = newGame(seqRng([0]));
  const wc = g.alchemy.get('wholecore');
  assert.equal(wc.inputs.length, 8);                 // 8원소
  const mercury = g.alchemy.get('mercury');
  assert.ok(mercury.inputs.includes('wholecore'));   // 6단계는 전체핵 사용
  assert.equal(mercury.tier, 6);
});

test('7단계는 전체핵 3개 + 게임당 1회만', () => {
  const g = newGame(seqRng([0]));
  const ss = g.alchemy.get('solarsystem');
  assert.equal(ss.tier, 7);
  assert.equal(ss.inputs.filter((x) => x === 'wholecore').length, 3); // 전체핵 3개
  g.bench = {}; g.towers = []; g.slots = []; g.bossTokens = 5;
  g.bench = { wholecore: 3, sun: 1, terra: 1 };
  assert.equal(g.combine('solarsystem'), true);
  assert.equal(g.finalBuilt, true);
  g.bench = { wholecore: 3, sun: 1, terra: 1 };
  assert.equal(g.combine('solarsystem'), false);     // 두 번째 거부(최종 1회)
});

test('라운드 시작마다 200골드 정액 지급', () => {
  const g = newGame(seqRng([0]));
  g.gold = 0;
  g.startWave(); assert.equal(g.gold, 200);
  g.startWave(); assert.equal(g.gold, 400);
  g.startWave(); assert.equal(g.gold, 600);
});

test('퀘스트 — 난이도 해제는 진행할수록 1→2…', () => {
  const g = newGame(seqRng([0]));
  g.path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(g.questMaxDifficulty(), 1);  // 처음엔 1단계만
  assert.equal(g.startQuest(2), false);     // 2단계 잠김
  assert.equal(g.startQuest(1), true);      // 1단계 진행
  assert.equal(g.questMaxDifficulty(), 2);  // 이후 2단계 해제
});

test('퀘스트 — 8라운드 쿨다운', () => {
  const g = newGame(seqRng([0]));
  g.path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  g.wave = 5;
  assert.equal(g.startQuest(1), true);
  assert.equal(g.questCooldownUntil, 5 + CONFIG.QUEST_INTERVAL);
  assert.equal(g.questAvailable(), false);  // 쿨다운 중
  g.wave = 13;
  assert.equal(g.questAvailable(), true);   // 8라운드 경과
});

test('퀘스트 몬스터 처치 시 난이도 수만큼 선택권', () => {
  const g = newGame(seqRng([0]));
  g.bossTokens = 0;
  g._onKill({ role: 'quest', questReward: 3 });
  assert.equal(g.bossTokens, 3);
});

test('다음 웨이브 버튼 — 라운드 시작 15초간 잠금', () => {
  const g = newGame(seqRng([0]));
  g.startWave();                              // roundTimer = 30
  assert.equal(g.canStartNextWave(), false);  // 0초 경과
  g.roundTimer = 16;                          // 14초 경과
  assert.equal(g.canStartNextWave(), false);
  g.roundTimer = 15;                          // 15초 경과
  assert.equal(g.canStartNextWave(), true);
  assert.equal(g.manualStartWave(), true);    // 이제 수동 시작 가능
});

test('라운드당 약 30마리 스폰(0.5초 간격)', () => {
  const g = newGame(seqRng([0]));
  g.startWave();
  const normals = g.spawnQueue.filter((s) => s.role !== 'boss').length;
  assert.ok(normals >= 28 && normals <= 32, `normals=${normals}`); // ~30
  assert.equal(CONFIG.SPAWN_INTERVAL, 0.5);
});

test('난이도 — 시작 골드 반영', () => {
  const g = new Game({ alchemy: new Alchemy(recipes), waveSystem: new WaveSystem(enemies), rng: seqRng([0]), startGold: 400 });
  assert.equal(g.gold, 400);
});

test('난이도 방어도 — 적 체력 배수 적용', () => {
  const mk = (armor) => {
    const g = new Game({ alchemy: new Alchemy(recipes), waveSystem: new WaveSystem(enemies), rng: seqRng([0]), armorMult: armor });
    g.path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    g.startWave();
    return g.spawnQueue[0].hp;
  };
  assert.equal(mk(2), mk(1) * 2); // 어려움(2배)은 보통의 2배 체력
});

test('sellTower — 티어×50 골드 환급 + 보드에서 제거', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = []; g.slots = [{ x: 2, y: 2 }]; g.gold = 0;
  const t = g.autoPlace('water'); // tier1
  const refund = g.sellTower(t.uid);
  assert.equal(refund, 1 * CONFIG.GOLD_SELL_BASE); // 50
  assert.equal(g.gold, 50);
  assert.equal(g.towers.length, 0);
  assert.equal(g.sellTower('nope'), false);
});
