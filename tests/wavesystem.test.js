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
