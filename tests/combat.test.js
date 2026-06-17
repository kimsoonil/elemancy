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
  assert.equal(enemies[0]?.hp <= 0 || enemies.length === 0, true);
  assert.deepEqual(dead, ['e']);
  assert.equal(enemies.length, 0);
});

test('tick — 적은 죽지 않으면 경로를 계속 돈다(누수/제거 없음)', () => {
  const Combat = require('../src/combat.js');
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const enemies = [{ uid: 'e', role: 'tank', hp: 9999, maxHp: 9999, baseSpeed: 2, pathPos: 39, x: 0, y: 10, slowUntil: 0 }];
  Combat.tick({ towers: [], enemies, path }, 1, 0, () => {});
  assert.equal(enemies.length, 1);
  assert.ok(enemies[0].pathPos < 40);
});

test('tick — dmgScale로 업그레이드 배수 반영', () => {
  const Combat = require('../src/combat.js');
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const enemies = [{ uid: 'e', role: 'swarm', hp: 100, maxHp: 100, baseSpeed: 0, pathPos: 0, x: 0, y: 0, slowUntil: 0 }];
  const towers = [{ uid: 't', atkType: 'single', damage: 10, atkSpeed: 1, range: 3, x: 0, y: 0, cooldown: 0, tier: 1 }];
  Combat.tick({ towers, enemies, path, dmgScale: () => 2 }, 1, 0, () => {});
  assert.equal(enemies[0].hp, 80); // 10 × 2배 = 20 데미지
});

test('tick — 경로 미주입(빈 배열)이면 NaN 없이 안전 종료', () => {
  const Combat = require('../src/combat.js');
  const enemies = [{ uid: 'e', role: 'swarm', hp: 100, maxHp: 100, baseSpeed: 1, pathPos: 0, x: 0, y: 0, slowUntil: 0 }];
  Combat.tick({ towers: [], enemies, path: [] }, 1, 0, () => {});
  assert.equal(Number.isNaN(enemies[0].pathPos), false);
  assert.equal(enemies[0].pathPos, 0);
});

test('tick — 타워 발사 시 공격 이펙트 기록(effects)', () => {
  const Combat = require('../src/combat.js');
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const enemies = [{ uid: 'e', role: 'swarm', hp: 100, maxHp: 100, baseSpeed: 0, pathPos: 0, x: 0, y: 0, slowUntil: 0 }];
  const towers = [{ uid: 't', atkType: 'single', damage: 10, atkSpeed: 1, range: 3, x: 0, y: 0, cooldown: 0, tier: 1 }];
  const effects = [];
  Combat.tick({ towers, enemies, path, effects }, 1, 0, () => {});
  assert.equal(effects.length, 1);
  assert.equal(effects[0].type, 'single');
});
