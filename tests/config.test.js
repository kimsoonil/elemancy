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
  assert.equal(CONFIG.SPAWN_PER_ROUND, 30);
  assert.equal(CONFIG.SPAWN_INTERVAL, 0.5);
});

test('업그레이드 비용은 초기 저렴하고 레벨에 따라 증가', () => {
  assert.equal(CONFIG.UPGRADE_COST(1, 0), 20);
  assert.ok(CONFIG.UPGRADE_COST(1, 10) > CONFIG.UPGRADE_COST(1, 0));
  assert.ok(CONFIG.UPGRADE_COST(5, 0) > CONFIG.UPGRADE_COST(1, 0));
});
