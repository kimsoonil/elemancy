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
