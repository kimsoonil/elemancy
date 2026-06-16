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
