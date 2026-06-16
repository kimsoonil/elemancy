const CONFIG = (typeof require !== 'undefined') ? require('./config.js') : globalThis.CONFIG;
const Stats = (typeof require !== 'undefined') ? require('./stats.js') : globalThis.stats;

class Game {
  constructor({ alchemy, waveSystem, rng = Math.random }) {
    this.alchemy = alchemy;
    this.waveSystem = waveSystem;
    this.rng = rng;
    this.gold = 0;
    this.wave = 0;
    this.phase = 'prep';        // 'prep' | 'combat'
    this.bench = {};            // {unitId: count} 미배치 소유분
    this.towers = [];           // 배치된 타워 인스턴스
    this.enemies = [];
    this.upgrades = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.bossTokens = 0;        // 원소 선택권
    this.gameOver = false;
    this.victory = false;
    this._uid = 0;
    this._tier1 = alchemy.byTier(1).map((u) => u.id);
    this.grantRandomElements(CONFIG.START_ELEMENTS);
  }

  /** 벤치 + 배치 타워를 합산한 소유 개수 {unitId: count} */
  ownedCounts() {
    const out = { ...this.bench };
    for (const t of this.towers) out[t.unitId] = (out[t.unitId] || 0) + 1;
    return out;
  }

  /** rng로 tier1 원소를 n개 벤치에 추가 */
  grantRandomElements(n) {
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.rng() * this._tier1.length);
      const id = this._tier1[idx];
      this.bench[id] = (this.bench[id] || 0) + 1;
    }
  }

  nextUid() { return `u${this._uid++}`; }

  /** 벤치의 unitId 1개를 보드 위치 pos에 타워로 배치. 없으면 null. */
  place(unitId, pos) {
    if (!this.bench[unitId]) return null;
    this.bench[unitId] -= 1;
    if (this.bench[unitId] <= 0) delete this.bench[unitId];
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
        this.towers.splice(idx, 1);
        remaining -= 1;
      }
    }
    this.bench[resultId] = (this.bench[resultId] || 0) + 1;
    return true;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = Game;
