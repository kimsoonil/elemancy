var CONFIG = (typeof require !== 'undefined') ? require('./config.js') : globalThis.CONFIG;
var Stats = (typeof require !== 'undefined') ? require('./stats.js') : globalThis.stats;
var balance = (typeof require !== 'undefined') ? require('./balance.js') : globalThis.balance;
var Combat = (typeof require !== 'undefined') ? require('./combat.js') : globalThis.combat;

class Game {
  constructor({ alchemy, waveSystem, rng = Math.random, slots = [] }) {
    this.alchemy = alchemy;
    this.waveSystem = waveSystem;
    this.rng = rng;
    this.slots = slots;         // 자동 배치 가능한 빌드 칸 [{x,y}, ...]
    this.selectedUid = null;    // 클릭 선택된 타워
    this.moveMode = false;      // 이동 모드
    this.gold = CONFIG.START_GOLD;
    this.wave = 0;
    this.phase = 'prep';        // 'prep' | 'combat'
    this.bench = {};            // {unitId: count} 미배치 소유분
    this.towers = [];           // 배치된 타워 인스턴스
    this.enemies = [];
    this.effects = [];          // 공격 모션 이펙트 (렌더용, 짧게 유지)
    this.upgrades = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.bossTokens = 0;        // 원소 선택권
    this.gameOver = false;
    this.victory = false;
    this.finalBuilt = false;    // 7단계(최종) 게임당 1회 제작 여부
    this._uid = 0;
    this._tier1 = alchemy.byTier(1).map((u) => u.id);
    this.path = [];        // main에서 주입
    this.now = 0;          // 누적 시각(초)
    this.spawnQueue = [];  // [{id, role, hp}] 남은 스폰
    this.spawnTimer = 0;
    this.roundTimer = CONFIG.ROUND_TIME; // 다음 자동 웨이브까지 남은 초
    this.grantRandomElements(CONFIG.START_ELEMENTS);
  }

  /** 벤치 + 배치 타워를 합산한 소유 개수 {unitId: count} */
  ownedCounts() {
    const out = { ...this.bench };
    for (const t of this.towers) out[t.unitId] = (out[t.unitId] || 0) + 1;
    return out;
  }

  /** rng로 tier1 원소를 n개 받아 자동 배치(슬롯 없으면 벤치). */
  grantRandomElements(n) {
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.rng() * this._tier1.length);
      this.autoPlace(this._tier1[idx]);
    }
  }

  nextUid() { return `u${this._uid++}`; }

  /** unitId로 타워 인스턴스 생성(능력치 부여) 후 보드에 추가. */
  _makeTower(unitId, pos) {
    const s = Stats.deriveStats(this.alchemy, unitId);
    const tower = {
      uid: this.nextUid(),
      unitId,
      tier: s.tier,
      atkType: s.atkType,
      damage: Stats.rollDamage(s.damageBand, this.rng()),
      atkSpeed: s.atkSpeed,
      range: s.range,
      x: pos.x, y: pos.y,
      cooldown: 0,
    };
    this.towers.push(tower);
    return tower;
  }

  /** 비어있는 첫 빌드 슬롯 반환(타워 미점유). 없으면 null. */
  freeSlot() {
    const occupied = new Set(this.towers.map((t) => `${t.x},${t.y}`));
    return this.slots.find((s) => !occupied.has(`${s.x},${s.y}`)) || null;
  }

  /** 빈 슬롯에 자동 배치. 슬롯이 꽉 차면 벤치에 보관하고 null 반환. */
  autoPlace(unitId) {
    const slot = this.freeSlot();
    if (!slot) {
      this.bench[unitId] = (this.bench[unitId] || 0) + 1;
      return null;
    }
    return this._makeTower(unitId, slot);
  }

  /** 벤치의 unitId 1개를 보드 위치 pos에 배치. 없으면 null. */
  place(unitId, pos) {
    if (!this.bench[unitId]) return null;
    this.bench[unitId] -= 1;
    if (this.bench[unitId] <= 0) delete this.bench[unitId];
    return this._makeTower(unitId, pos);
  }

  /** 배치 타워를 빈 칸 pos로 이동. 대상 칸이 점유돼 있으면 false. */
  moveTower(uid, pos) {
    const t = this.towers.find((x) => x.uid === uid);
    if (!t) return false;
    if (this.towers.some((o) => o !== t && o.x === pos.x && o.y === pos.y)) return false;
    t.x = pos.x; t.y = pos.y;
    return true;
  }

  /** 배치 타워를 회수해 벤치로 되돌림. */
  recall(uid) {
    const idx = this.towers.findIndex((t) => t.uid === uid);
    if (idx < 0) return false;
    const t = this.towers[idx];
    this.towers.splice(idx, 1);
    this.bench[t.unitId] = (this.bench[t.unitId] || 0) + 1;
    return true;
  }

  /** resultId 합성: 소유(벤치+보드)에서 재료 소모, 결과는 벤치로. */
  combine(resultId) {
    const unit = this.alchemy.get(resultId);
    if (!unit || !unit.inputs) return false;
    if (unit.tier === 7 && this.finalBuilt) return false; // 최종 진화는 게임당 1회
    const need = {};
    for (const id of unit.inputs) need[id] = (need[id] || 0) + 1;
    const owned = this.ownedCounts();
    for (const [id, cnt] of Object.entries(need)) {
      if ((owned[id] || 0) < cnt) return false;
    }
    // 소모: 벤치 우선, 부족분은 보드 타워에서 제거
    for (const [id, cnt] of Object.entries(need)) {
      let remaining = cnt;
      const fromBench = Math.min(remaining, this.bench[id] || 0);
      if (fromBench > 0) {
        this.bench[id] -= fromBench;
        if (this.bench[id] <= 0) delete this.bench[id];
        remaining -= fromBench;
      }
      while (remaining > 0) {
        const idx = this.towers.findIndex((t) => t.unitId === id);
        if (this.towers[idx] && this.towers[idx].uid === this.selectedUid) this.selectedUid = null;
        this.towers.splice(idx, 1);
        remaining -= 1;
      }
    }
    this.autoPlace(resultId); // 결과물 자동 배치
    if (unit.tier === 7) this.finalBuilt = true;
    return true;
  }

  /** 티어 공격력 업그레이드(레벨+1). 골드 부족/최대레벨이면 false. */
  upgrade(tier) {
    if (this.upgrades[tier] >= CONFIG.UPGRADE_MAX_LEVEL) return false;
    const cost = CONFIG.UPGRADE_COST(tier, this.upgrades[tier]);
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.upgrades[tier] += 1;
    return true;
  }

  /** 티어의 현재 데미지 배수 (1 + 레벨×0.01). */
  damageMultiplier(tier) {
    return 1 + this.upgrades[tier] * CONFIG.UPGRADE_PER_LEVEL;
  }

  /** 도박: 베팅액만큼 보유해야 함. 순손익 −bet~+bet. */
  gamble(bet) {
    if (!CONFIG.GAMBLE_BETS.includes(bet) || this.gold < bet) return false;
    const net = balance.gambleResult(bet, this.rng());
    this.gold += net;
    return net;
  }

  /** 가챠: 티어별 비용·확률. 성공 시 해당 티어 유닛 랜덤 1개 자동 배치. */
  gacha(tier) {
    const g = CONFIG.GACHA[tier];
    if (!g || this.gold < g.cost) return { success: false, reason: 'gold' };
    this.gold -= g.cost;
    if (this.rng() >= g.rate) return { success: false };
    const pool = this.alchemy.byTier(tier).map((u) => u.id);
    const id = pool[Math.floor(this.rng() * pool.length)];
    this.autoPlace(id);
    return { success: true, id };
  }

  /** 랜덤 뽑기: 골드 차감 후 무작위 tier1 원소 1개를 자동 배치. 부족하면 null. */
  drawRandomUnit() {
    if (this.gold < CONFIG.RANDOM_DRAW_COST) return null;
    this.gold -= CONFIG.RANDOM_DRAW_COST;
    const id = this._tier1[Math.floor(this.rng() * this._tier1.length)];
    this.autoPlace(id);
    return id;
  }

  /** 보스 토큰 사용: 원하는 tier1 원소를 자동 배치. */
  redeemToken(elementId) {
    if (this.bossTokens <= 0) return false;
    const u = this.alchemy.get(elementId);
    if (!u || u.tier !== 1) return false;
    this.bossTokens -= 1;
    this.autoPlace(elementId);
    return true;
  }

  /** 보드 위 적의 가중치 합(보스 8). */
  boardWeight() {
    return this.enemies.reduce(
      (s, e) => s + (e.role === 'boss' ? CONFIG.BOSS_CAP_WEIGHT : 1), 0
    );
  }

  checkGameOver() {
    if (this.boardWeight() > CONFIG.GAME_OVER_CAP) this.gameOver = true;
  }

  /** 다음 웨이브 시작: 적 구성 → 스폰 큐 적재, 타이머 리셋. 웨이브는 누적된다. */
  startWave() {
    if (this.gameOver || this.victory || this.wave >= CONFIG.MAX_WAVE) return;
    this.wave += 1;
    this.phase = 'combat';
    this.roundTimer = CONFIG.ROUND_TIME; // 다음 자동 웨이브까지 30초 리셋
    this.gold += this.wave * CONFIG.GOLD_PER_ROUND; // 라운드 골드: 1000,2000,3000…
    // 웨이브 2부터는 라운드 보상(tier1 원소) 지급
    if (this.wave >= 2) this.grantRandomElements(CONFIG.WAVE_CLEAR_ELEMENTS);

    const comp = this.waveSystem.composeWave(this.wave);
    const normals = comp.spawns.filter((s) => s.role !== 'boss');
    const rawTotal = normals.reduce((s, x) => s + x.count, 0) || 1;
    const scale = CONFIG.SPAWN_PER_ROUND / rawTotal;
    const queue = [];
    for (const s of normals) {
      const n = Math.max(1, Math.round(s.count * scale));
      for (let i = 0; i < n; i++) {
        queue.push({ id: s.id, role: s.role, hp: balance.enemyHP(s.role, this.wave) });
      }
    }
    for (const s of comp.spawns.filter((x) => x.role === 'boss')) {
      queue.push({ id: s.id, role: s.role, hp: balance.enemyHP('boss', this.wave), bossIndex: this.wave / 10 });
    }
    // 이번 웨이브 스폰을 기존 큐 뒤에 이어붙임(누적)
    this.spawnQueue.push(...queue);
  }

  /** 스폰 큐에서 0.4초 간격으로 1마리씩 경로 시작점에 투입. */
  _spawnTick(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 0.4;
    const s = this.spawnQueue.shift();
    const start = this.path.length ? this.path[0] : { x: 0, y: 0 };
    this.enemies.push({
      uid: this.nextUid(),
      id: s.id, role: s.role, bossIndex: s.bossIndex,
      hp: s.hp, maxHp: s.hp,
      baseSpeed: 1.0,
      x: start.x, y: start.y, pathPos: 0, slowUntil: 0,
    });
  }

  /** 전투 중 적 사망 시: 골드 지급, 보스면 원소 선택권(+3·4구간 보스는 전체핵) 지급. */
  _onKill(enemy) {
    this.gold += CONFIG.GOLD_PER_KILL[enemy.role] || 5;
    if (enemy.role === 'boss') {
      const idx = enemy.bossIndex || 1;
      this.bossTokens += CONFIG.BOSS_TOKEN_STEP * idx; // 3,6,9,12,15
      if (idx === 3 || idx === 4) this.autoPlace('wholecore'); // 3·4구간 보스: 전체핵 1개
    }
  }

  /** 메인 루프 1틱. 라운드 타이머가 0이 되면 자동으로 다음 웨이브 시작. */
  update(dt) {
    if (this.gameOver || this.victory) return;
    this.now += dt;
    // 라운드 타이머: 마지막 웨이브 전까지 30초마다 자동 진행
    if (this.wave < CONFIG.MAX_WAVE) {
      this.roundTimer -= dt;
      if (this.roundTimer <= 0) this.startWave();
    }
    this._spawnTick(dt);
    Combat.tick(
      { towers: this.towers, enemies: this.enemies, path: this.path, effects: this.effects, dmgScale: (t) => this.damageMultiplier(t.tier) },
      dt, this.now, (e) => this._onKill(e)
    );
    // 오래된 공격 이펙트 정리 (0.18초)
    this.effects = this.effects.filter((fx) => this.now - fx.born < 0.18);
    this.checkGameOver();
    // 승리: 마지막 웨이브까지 모두 스폰되고 전멸시키면 클리어
    if (this.wave >= CONFIG.MAX_WAVE && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.victory = true;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = Game;
