/**
 * 원소 연금술 조합 디펜스 - 합성 로직
 * ------------------------------------------------------------
 * recipes.json 의 데이터를 읽어 합성을 조회/검증/탐색한다.
 * 데이터(무엇을 만드나)와 로직(어떻게 처리하나)을 분리해두었으므로,
 * 유닛 추가나 밸런스 수정은 recipes.json 만 고치면 된다.
 *
 * 환경별 사용:
 *   - Node.js : const data = require('./recipes.json'); const A = new Alchemy(data);
 *   - 브라우저: fetch('recipes.json').then(r=>r.json()).then(d => new Alchemy(d))
 *   - Unity(C#) 등으로 옮길 때도 recipes.json 은 그대로 재사용 가능.
 */

class Alchemy {
  constructor(data) {
    this.meta = data.meta;
    // 모든 유닛(1단계 원소 + 2~5단계 합성품)을 id로 조회 가능한 맵으로 통합
    this.units = new Map();
    for (const e of data.elements) {
      this.units.set(e.id, { ...e, inputs: null }); // 1단계는 재료 없음
    }
    for (const r of data.recipes) {
      this.units.set(r.id, { ...r });
    }
    // 역방향 인덱스: "이 재료가 들어가는 레시피들"
    this.usedIn = new Map();
    for (const r of data.recipes) {
      for (const inId of new Set(r.inputs)) {
        if (!this.usedIn.has(inId)) this.usedIn.set(inId, []);
        this.usedIn.get(inId).push(r.id);
      }
    }
  }

  /* 기본 조회 ------------------------------------------------ */

  get(id) {
    return this.units.get(id) || null;
  }

  name(id) {
    const u = this.units.get(id);
    return u ? u.name : `(미상:${id})`;
  }

  /** 특정 단계의 모든 유닛 반환 */
  byTier(tier) {
    return [...this.units.values()].filter(u => u.tier === tier);
  }

  /* 합성 방향 (재료 -> 결과) -------------------------------- */

  /**
   * 보유 재료(인벤토리)로 지금 당장 만들 수 있는 결과물 목록.
   * inventory: { unitId: 보유개수 } 형태의 객체.
   */
  craftable(inventory) {
    const out = [];
    for (const u of this.units.values()) {
      if (!u.inputs) continue;
      if (this._hasEnough(inventory, this._countInputs(u.inputs))) {
        out.push(u.id);
      }
    }
    return out;
  }

  /** 합성 실행: 재료를 소모하고 결과물을 1개 추가한 새 인벤토리 반환. 불가하면 null */
  craft(inventory, resultId) {
    const u = this.units.get(resultId);
    if (!u || !u.inputs) return null;
    const need = this._countInputs(u.inputs);
    if (!this._hasEnough(inventory, need)) return null;
    const next = { ...inventory };
    for (const [id, cnt] of Object.entries(need)) {
      next[id] -= cnt;
      if (next[id] <= 0) delete next[id];
    }
    next[resultId] = (next[resultId] || 0) + 1;
    return next;
  }

  /* 합성 방향 (결과 -> 재료) -------------------------------- */

  /** 직속 재료(한 단계 아래)만 반환 */
  ingredients(id) {
    const u = this.units.get(id);
    return u && u.inputs ? u.inputs.slice() : [];
  }

  /** 1단계 원소까지 펼친 전체 재료 트리 (재귀) */
  expand(id) {
    const u = this.units.get(id);
    if (!u) return null;
    if (!u.inputs) return { id, name: u.name, tier: u.tier };
    return {
      id, name: u.name, tier: u.tier,
      inputs: u.inputs.map(inId => this.expand(inId)),
    };
  }

  /** 1단계 원소 소요량 총합 (이 유닛 1개 = 원소 몇 개?) */
  baseCost(id) {
    const u = this.units.get(id);
    if (!u) return {};
    if (!u.inputs) return { [id]: 1 };
    const total = {};
    for (const inId of u.inputs) {
      const sub = this.baseCost(inId);
      for (const [k, v] of Object.entries(sub)) {
        total[k] = (total[k] || 0) + v;
      }
    }
    return total;
  }

  /** 이 유닛 1개를 만드는 데 필요한 총 합성 횟수 */
  craftSteps(id) {
    const u = this.units.get(id);
    if (!u || !u.inputs) return 0;
    return 1 + u.inputs.reduce((s, inId) => s + this.craftSteps(inId), 0);
  }

  /** 이 재료가 쓰이는 상위 레시피들 */
  usages(id) {
    return (this.usedIn.get(id) || []).slice();
  }

  /* 내부 헬퍼 ----------------------------------------------- */

  _countInputs(inputs) {
    const c = {};
    for (const id of inputs) c[id] = (c[id] || 0) + 1;
    return c;
  }

  _hasEnough(inventory, need) {
    for (const [id, cnt] of Object.entries(need)) {
      if ((inventory[id] || 0) < cnt) return false;
    }
    return true;
  }

  /* 데이터 무결성 검증 -------------------------------------- */

  /** 존재하지 않는 재료 참조, 단계 규칙 위반 등을 점검 */
  validate() {
    const errors = [];
    const tierRule = { 4: { 3: 2, 2: 1 }, 5: { 4: 2, 3: 1, 2: 1 } };
    for (const u of this.units.values()) {
      if (!u.inputs) continue;
      // 1) 재료 존재 여부
      for (const inId of u.inputs) {
        if (!this.units.has(inId)) {
          errors.push(`${u.id}(${u.name}): 존재하지 않는 재료 '${inId}'`);
        }
      }
      // 2) 단계 구성 규칙 점검 (4,5단계만)
      const rule = tierRule[u.tier];
      if (rule) {
        const got = {};
        for (const inId of u.inputs) {
          const t = this.units.get(inId)?.tier;
          if (t != null) got[t] = (got[t] || 0) + 1;
        }
        for (const [t, need] of Object.entries(rule)) {
          if ((got[t] || 0) !== need) {
            errors.push(
              `${u.id}(${u.name}): ${u.tier}단계 규칙 위반 - ${t}단계 재료 ${need}개 필요, ${got[t] || 0}개`
            );
          }
        }
      }
    }
    return errors;
  }
}

/* Node.js / 브라우저 양쪽 export */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Alchemy;
}
