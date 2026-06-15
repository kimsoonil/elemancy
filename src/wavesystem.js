/**
 * 원소 연금술 조합 디펜스 - 웨이브 로직
 * ------------------------------------------------------------
 * enemies.json 을 읽어 각 웨이브에 어떤 적이 나올지 구성한다.
 * 핵심 설계: 한 웨이브에 여러 역할(role)의 적을 섞어, 단일 조합으로는
 * 못 막게 한다. 보스 웨이브(10의 배수)는 보스 단독으로 구성.
 */

class WaveSystem {
  constructor(data) {
    this.meta = data.meta;
    this.segments = data.segments;
    this.enemies = data.enemies;
    this.bySegment = new Map();
    for (const e of this.enemies) {
      if (!this.bySegment.has(e.segment)) this.bySegment.set(e.segment, []);
      this.bySegment.get(e.segment).push(e);
    }
  }

  /** 웨이브 번호(1~40)가 속한 구간 반환 */
  segmentOf(wave) {
    const idx = Math.min(Math.floor((wave - 1) / 10), this.segments.length - 1);
    return this.segments[idx];
  }

  /** 보스 웨이브인지 (10의 배수) */
  isBossWave(wave) {
    return wave % 10 === 0;
  }

  /**
   * 한 웨이브의 적 구성을 반환.
   * 일반 웨이브: 해당 구간의 비(非)보스 적들을 역할별로 섞어 구성.
   * 보스 웨이브: 해당 구간 보스 단독.
   */
  composeWave(wave) {
    const seg = this.segmentOf(wave);
    const pool = this.bySegment.get(seg.id) || [];

    // 일반 적 구성 (보스 웨이브에서도 동일하게 깔고, 보스를 얹는다)
    const normals = pool.filter((e) => e.role !== "boss");
    const picked = this._pickMixed(normals, wave);
    const progress = ((wave - 1) % 10) / 9; // 0 ~ 1
    const spawns = picked.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      count: Math.max(1, Math.round(e.count * (0.7 + 0.6 * progress))),
    }));

    if (this.isBossWave(wave)) {
      const boss = pool.find((e) => e.role === "boss");
      if (boss) {
        spawns.push({ id: boss.id, name: boss.name, role: boss.role, count: 1 });
      }
      return { wave, segment: seg.name, type: "boss", reqTier: seg.reqTier, spawns };
    }

    return { wave, segment: seg.name, type: "normal", reqTier: seg.reqTier, spawns };
  }

  /** 역할이 최대한 겹치지 않도록 2~3종을 결정적으로 선택 (wave를 시드처럼 사용) */
  _pickMixed(normals, wave) {
    const byRole = {};
    for (const e of normals) {
      (byRole[e.role] = byRole[e.role] || []).push(e);
    }
    const roles = Object.keys(byRole);
    const pickCount = Math.min(roles.length, wave % 3 === 0 ? 3 : 2);
    const chosen = [];
    for (let i = 0; i < pickCount; i++) {
      const role = roles[(wave + i) % roles.length];
      const group = byRole[role];
      chosen.push(group[(wave + i) % group.length]);
    }
    // 중복 제거
    return [...new Map(chosen.map(e => [e.id, e])).values()];
  }

  /** 전체 캠페인(1~maxWave) 미리보기 생성 */
  campaign(maxWave = 40) {
    const out = [];
    for (let w = 1; w <= maxWave; w++) out.push(this.composeWave(w));
    return out;
  }

  /** 특정 적의 상세 정보 */
  enemy(id) {
    return this.enemies.find(e => e.id === id) || null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = WaveSystem;
}
