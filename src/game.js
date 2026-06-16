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
}

if (typeof module !== 'undefined' && module.exports) module.exports = Game;
