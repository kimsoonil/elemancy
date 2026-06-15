const test = require('node:test');
const assert = require('node:assert/strict');
const Alchemy = require('../src/alchemy.js');
const recipes = require('../data/recipes.json');
const Stats = require('../src/stats.js');

const a = new Alchemy(recipes);

test('dominantElement — 단일 지배 원소', () => {
  assert.equal(Stats.dominantElement(a, 'fire'), 'fire');
  assert.equal(Stats.dominantElement(a, 'lava'), 'fire'); // lava(fire+earth) 동률 → inputs[0]=fire
});

test('dominantElement — 동률은 inputs[0] 따라감 (증기=물)', () => {
  assert.equal(Stats.dominantElement(a, 'steam'), 'water'); // steam(water,fire) → inputs[0]=water
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
  const s = Stats.deriveStats(a, 'steam'); // tier2, 지배=water(둔화), 밴드 ×10
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
