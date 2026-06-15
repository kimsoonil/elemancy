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
  assert.equal(B.baseHP(40), 1111000);
});

test('enemyHP — 역할 배수 적용', () => {
  assert.equal(B.enemyHP('swarm', 10), 300);
  assert.equal(B.enemyHP('tank', 10), 2500);
  assert.equal(B.enemyHP('special', 20), 13200);
});

test('enemyHP — 보스는 구간 끝 base × 3', () => {
  assert.equal(B.enemyHP('boss', 10), 3000);
  assert.equal(B.enemyHP('boss', 20), 33000);
  assert.equal(B.enemyHP('boss', 30), 333000);
  assert.equal(B.enemyHP('boss', 40), 3333000);
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
  assert.equal(B.gambleResult(100, 0), -100);
  assert.equal(B.gambleResult(100, 0.999), 100);
});
