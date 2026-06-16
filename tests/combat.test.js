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
