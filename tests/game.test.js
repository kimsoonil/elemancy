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
  for (const id of Object.keys(g.ownedCounts())) {
    assert.equal(g.alchemy.get(id).tier, 1);
  }
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
  assert.equal(g.towers.find((t) => t.unitId === 'fire'), undefined);
  assert.equal(g.ownedCounts().steam, 1);
});

test('combine — 재료 부족이면 실패(false)', () => {
  const g = newGame(seqRng([0]));
  g.bench = { water: 1 }; g.towers = [];
  assert.equal(g.combine('steam'), false);
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

test('웨이브 클리어 — 적 전멸 시 prep 복귀 + tier1 원소 2개 지급', () => {
  const g = newGame(seqRng([0]));
  g.bench = {}; g.towers = [];
  g.phase = 'combat'; g.wave = 3; g.enemies = [];
  g.update(0.1);
  assert.equal(g.phase, 'prep');
  assert.equal(Object.values(g.ownedCounts()).reduce((s, n) => s + n, 0), 2);
});

test('보스 웨이브 클리어 시 보스 토큰 ×3 지급', () => {
  const g = newGame(seqRng([0]));
  g.phase = 'combat'; g.enemies = [];
  g.wave = 10; g._wasBoss = true;
  g.update(0.1);
  assert.equal(g.bossTokens, 1);
  g.wave = 20; g._wasBoss = true; g.phase = 'combat'; g.enemies = [];
  g.update(0.1);
  assert.equal(g.bossTokens, 1 + 3);
});

test('40웨이브 클리어 시 승리', () => {
  const g = newGame(seqRng([0]));
  g.phase = 'combat'; g.enemies = []; g.wave = 40; g._wasBoss = true;
  g.update(0.1);
  assert.equal(g.victory, true);
});
