/* 同一组物理情境可从多种分类入口访问。无外部依赖，可离线使用。 */
(function () {
  'use strict';
  const EPS = 1e-7;
  const T = 18;
  const types = ['匀速', '匀加速', '匀减速'];
  const kindShort = { '匀速': '匀速', '匀加速': '匀加速', '匀减速': '匀减速' };
  const fmt = n => Number(n.toFixed(2));
  const stopTime = o => o.stop && o.a !== 0 && o.v * o.a < 0 ? Math.max(0, -o.v / o.a) : Infinity;
  function state(o, t, after) {
    const ts = stopTime(o);
    if (t > ts - (after ? EPS : -EPS)) {
      return { x: o.x + o.v * ts + .5 * o.a * ts * ts, v: 0, a: 0 };
    }
    return { x: o.x + o.v * t + .5 * o.a * t * t, v: o.v + o.a * t, a: o.a };
  }
  function uniq(xs) {
    return xs.sort((a, b) => a - b).filter((x, i, arr) => !i || Math.abs(x - arr[i - 1]) > 1e-5);
  }
  function equationRoots(c, b, a) {
    if (Math.abs(a) < EPS) return Math.abs(b) < EPS ? [] : [-c / b];
    const d = b * b - 4 * a * c;
    if (d < -EPS) return [];
    if (Math.abs(d) <= EPS) return [-b / (2 * a)];
    const s = Math.sqrt(d);
    return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
  }
  function analyze(A, B, duration) {
    const cuts = uniq([0, duration, stopTime(A), stopTime(B)].filter(t => Number.isFinite(t) && t >= 0 && t <= duration));
    const roots = [];
    let together = false;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const from = cuts[i], span = cuts[i + 1] - from;
      const a = state(A, from, true), b = state(B, from, true);
      const c = b.x - a.x, v = b.v - a.v, acc = (b.a - a.a) / 2;
      if (Math.abs(c) < EPS && Math.abs(v) < EPS && Math.abs(acc) < EPS) {
        together = true;
        roots.push(from);
      } else {
        for (const q of equationRoots(c, v, acc)) {
          if (q >= -EPS && q <= span + EPS) roots.push(Math.max(0, from + q));
        }
      }
    }
    const hits = uniq(roots.filter(t => t >= -EPS && t <= duration + EPS));
    let result;
    if (together) result = '相遇后保持同位置';
    else if (hits.length >= 2) result = '相遇两次';
    else if (hits.length === 1) {
      const va = state(A, hits[0], true).v, vb = state(B, hits[0], true).v;
      result = Math.abs(va - vb) < 1e-5 ? '恰好相遇' : '相遇一次';
    } else result = '没有相遇';

    // Classify the observed gap only up to the first encounter; after that
    // front/back positions change, so the usual pursuit labels no longer apply.
    const end = hits.length ? hits[0] : duration;
    const turning = [0, end];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const lo = cuts[i], hi = Math.min(cuts[i + 1], end);
      if (lo > end || hi < lo + EPS) continue;
      turning.push(lo, hi);
      const a = state(A, lo, true), b = state(B, lo, true);
      const dv = b.v - a.v, da = b.a - a.a;
      if (Math.abs(da) > EPS) {
        const t = lo - dv / da;
        if (t > lo + EPS && t < hi - EPS) turning.push(t);
      }
    }
    const ts = uniq(turning.filter(t => t >= 0 && t <= end));
    const signs = [];
    for (let i = 0; i + 1 < ts.length; i++) {
      if (ts[i + 1] - ts[i] < EPS) continue;
      const mid = (ts[i] + ts[i + 1]) / 2;
      const va = state(A, mid, true).v, vb = state(B, mid, true).v;
      const gap = state(B, mid, true).x - state(A, mid, true).x;
      const rate = Math.sign(gap || 1) * (vb - va);
      const s = rate > EPS ? 1 : rate < -EPS ? -1 : 0;
      if (s && signs[signs.length - 1] !== s) signs.push(s);
    }
    let process = '间距保持不变';
    if (signs.length === 1) process = signs[0] < 0 ? '一直靠近' : '一直远离';
    else if (signs.length === 2) process = signs[0] < 0 ? '先靠近后远离' : '先远离后靠近';
    else if (signs.length > 2) process = '间距多次变化';
    return { result, process, hits };
  }
  function accPairs(typeA, typeB, signA, signB) {
    const a = typeA === '匀速' ? [0] : typeA === '匀加速' ? [signA] : [-signA];
    const b = typeB === '匀速' ? [0] : typeB === '匀加速' ? [signB] : [-signB];
    if (typeA === typeB && typeA !== '匀速') {
      return [[a[0] * 2, b[0]], [a[0], b[0]], [a[0], b[0] * 2]];
    }
    return [[a[0], b[0]]];
  }
  function createPursuit() {
    const out = [], seen = new Set();
    const speedCases = [
      { name: '后快前慢', va: 8, vb: 4, key: 'fast' },
      { name: '后慢前快', va: 4, vb: 8, key: 'slow' },
      { name: '初速度相同', va: 6, vb: 6, key: 'equal' }
    ];
    const distances = [6, 8, 4, 4.5, 2, 12, 20, 40];
    types.forEach((ka, ia) => types.forEach((kb, ib) => {
      const group = `${kindShort[ka]}追${kindShort[kb]}`;
      speedCases.forEach(s => accPairs(ka, kb, 1, 1).forEach(([aa, ab], ai) => distances.forEach(d => {
        // 两车都减速时采用较大的初速度，使两次相遇可以在停车前完整呈现。
        const va = ka === '匀减速' && kb === '匀减速' ? s.va + 5 : s.va;
        const vb = ka === '匀减速' && kb === '匀减速' ? s.vb + 6 : s.vb;
        // 保持所声明的初速度关系，包括相等这一特殊情况。
        const adjustedVa = ka === '匀减速' && kb === '匀减速' && s.key === 'equal' ? 12 : va;
        const adjustedVb = ka === '匀减速' && kb === '匀减速' && s.key === 'equal' ? 12 : vb;
        const A = { x: 0, v: adjustedVa, a: aa, stop: ka === '匀减速' };
        const B = { x: d, v: adjustedVb, a: ab, stop: kb === '匀减速' };
        const adv = aa > ab ? '越来越有利' : aa < ab ? '越来越不利' : '速度差不变';
        const info = analyze(A, B, T);
        const key = [group, s.name, adv, info.process, info.result].join('|');
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          id: `p-${ia}${ib}-${s.key}-${ai}-${d}`, title: `${group} · ${s.name} · ${info.result}`,
          scope: 'pursuit', group, initial: s.name, advantage: adv,
          process: info.process, result: info.result, A, B, duration: T,
          description: `A 在后，B 在前；初始间距 ${d} m。减速物体停下后保持静止；速度差分类描述起始运动阶段。`,
        });
      })));
    }));
    return out;
  }
  function meetingPhase(A, B, info, duration) {
    const ta = stopTime(A), tb = stopTime(B);
    if (!info.hits.length) {
      return ta <= duration + EPS && tb <= duration + EPS
        ? '双方停下仍未相遇' : '展示时间内未相遇';
    }
    const t = info.hits[0];
    if (Math.abs(t - ta) < 1e-5 || Math.abs(t - tb) < 1e-5) return '恰好停下时相遇';
    if (ta < t - EPS || tb < t - EPS) return '一方停下后相遇';
    return '相遇前都在运动';
  }
  function createMeeting() {
    const out = [], seen = new Set();
    types.forEach((ka, ia) => types.forEach((kb, ib) => {
      const group = `${kindShort[ka]}与${kindShort[kb]}相向`;
      const pairs = accPairs(ka, kb, 1, -1);
      // Mixed acceleration and deceleration can make the initial closing rate
      // increase, decrease, or stay constant depending on their magnitudes.
      if (ka === '匀加速' && kb === '匀减速') pairs.push([2, 1], [1, 2]);
      if (ka === '匀减速' && kb === '匀加速') pairs.push([-2, -1], [-1, -2]);
      pairs.forEach(([aa, ab], ai) => [8, 24, 36, 48, 72].forEach(d => {
        const A = { x: 0, v: 6, a: aa, stop: ka === '匀减速' };
        const B = { x: d, v: -6, a: ab, stop: kb === '匀减速' };
        const r = aa - ab;
        const advantage = r > 0 ? '靠近越来越快' : r < 0 ? '靠近越来越慢' : '靠近速度不变';
        const info = analyze(A, B, T);
        const phase = meetingPhase(A, B, info, T);
        const key = [group, advantage, info.process, info.result, phase].join('|');
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          id: `m-${ia}${ib}-${ai}-${d}`, title: `${group} · ${phase}`,
          scope: 'meeting', group, initial: '双方运动', advantage,
          process: info.process, result: info.result, phase, A, B, duration: T,
          description: `A 向右、B 向左，初始间距 ${d} m。减速物体停下后保持静止；靠近速度分类描述起始运动阶段。`,
        });
      }));
    }));
    return out;
  }
  // Keep each trajectory and its classifications intact, while bringing its
  // meaningful events into a short, classroom-friendly viewing window.
  function shortenDemo(preset) {
    const events = window.Physics.events(preset.A, preset.B, preset.duration);
    const times = [...events.meetings, ...events.equalTimes, stopTime(preset.A), stopTime(preset.B)]
      .filter(t => Number.isFinite(t) && t > EPS && t <= preset.duration + EPS);
    const lastEvent = times.length ? Math.max(...times) : 0;
    const scale = (obj, factor) => ({ ...obj, v: obj.v * factor, a: obj.a * factor * factor });
    for (const factor of [1, 1.5, 2, 2.5, 3, 3.5]) {
      if (lastEvent / factor > 4 + EPS) continue;
      const A = scale(preset.A, factor), B = scale(preset.B, factor);
      const info = analyze(A, B, 5);
      if (info.result !== preset.result || info.process !== preset.process) continue;
      if (preset.scope === 'meeting' && meetingPhase(A, B, info, 5) !== preset.phase) continue;
      return { ...preset, A, B, duration: 5 };
    }
    // Preserve the original rather than mislabel a future preset that cannot
    // safely be compressed into the standard viewing window.
    return preset;
  }
  // Reduce common forward drift in pursuit examples where both bodies keep
  // moving forward throughout. This changes the actual preset speeds (not the
  // plotted data), while leaving their relative motion and event times intact.
  function clearerPursuit(preset) {
    if (preset.scope !== 'pursuit') return preset;
    const A = { ...preset.A }, B = { ...preset.B };

    // Two meetings within five seconds, with a clearly visible separation
    // between them; use genuine position equations and a shared linear scale.
    if (preset.id === 'p-01-fast-0-6') {
      Object.assign(A, { v: 11, a: 0 });
      Object.assign(B, { x: 6, v: 1, a: 4 });
      return { ...preset, A, B };
    }
    if (preset.id === 'p-11-fast-2-6') {
      Object.assign(A, { v: 11, a: 1 });
      Object.assign(B, { x: 6, v: 1, a: 5 });
      return { ...preset, A, B };
    }
    if (!A.stop && !B.stop) {
      const commonSpeed = Math.max(0, Math.min(A.v, B.v) - 1);
      A.v -= commonSpeed;
      B.v -= commonSpeed;
    } else if (A.stop && B.stop && A.v === B.v && A.a === B.a && A.v > 8) {
      // Identical braking keeps the interval constant and the stop time
      // unchanged, so a gentler shared motion makes parallel lines clearer.
      const factor = 8 / A.v;
      A.v *= factor; B.v *= factor;
      A.a *= factor; B.a *= factor;
    }
    return { ...preset, A, B };
  }
  // Reusable examples keep their classifications but place meaningful
  // events near the middle of the five-second demonstration.
  const teachingDefaults = {
    'p-00-fast-0-6': {"B": {"x": 10}},
    'p-01-fast-0-8': {"A": {"v": 5}, "B": {"x": 5, "v": 1, "a": 1.6}},
    'p-01-fast-0-12': {"A": {"v": 8.5}, "B": {"v": 1.5, "a": 2.75}},
    'p-02-fast-0-6': {"A": {"v": 10}, "B": {"v": 5, "a": -1.75, "x": 18}},
    'p-02-slow-0-6': {"A": {"v": 11}, "B": {"v": 22, "a": -7.5}},
    'p-02-equal-0-6': {"B": {"x": 7}},
    'p-10-fast-0-6': {"A": {"v": 7, "a": 2}, "B": {"v": 1.5, "x": 20}},
    'p-10-slow-0-6': {"A": {"a": 7}, "B": {"v": 11.5}},
    'p-10-equal-0-6': {"A": {"v": 1.5, "a": 2.25}, "B": {"v": 1.5, "x": 7}},
    'p-11-fast-0-6': {"A": {"v": 6.5, "a": 3.25}, "B": {"v": 1.5, "a": 1.5, "x": 18}},
    'p-11-fast-1-6': {"B": {"x": 10}},
    'p-11-fast-2-8': {"A": {"v": 5, "a": 1}, "B": {"x": 5, "v": 1, "a": 2.6}},
    'p-11-fast-2-12': {"A": {"v": 8.5, "a": 2.75}, "B": {"v": 1.5, "a": 5.5}},
    'p-11-slow-0-6': {"A": {"a": 14.5}, "B": {"v": 12, "a": 7.25}},
    'p-11-equal-0-6': {"A": {"v": 1.5, "a": 3.25}, "B": {"v": 1.5, "a": 1.5, "x": 5.5}},
    'p-12-fast-0-6': {"A": {"v": 7.5}, "B": {"x": 15}},
    'p-12-slow-0-6': {"A": {"v": 6, "a": 2}, "B": {"v": 11.5, "a": -2}},
    'p-12-equal-0-6': {"A": {"v": 8.5, "a": 2}, "B": {"v": 8.5, "a": -2, "x": 12.5}},
    'p-20-fast-0-6': {"A": {"v": 10, "a": -2}, "B": {"v": 5, "x": 4}},
    'p-20-fast-0-8': {"A": {"v": 8, "a": -1.6}, "B": {"x": 5, "v": 4}},
    'p-20-fast-0-12': {"A": {"v": 13, "a": -2.5}, "B": {"v": 6.5}},
    'p-21-fast-0-6': {"A": {"v": 5.5, "a": -0.5}, "B": {"v": 3, "a": 0.5}},
    'p-21-fast-0-4': {"A": {"v": 8, "a": -0.8}, "B": {"x": 5, "v": 4, "a": 0.8}},
    'p-21-fast-0-2': {"A": {"v": 8, "a": -1}, "B": {"v": 3, "a": 1, "x": 4}},
    'p-22-fast-0-6': {"A": {"v": 14.5, "a": -2.5}, "B": {"v": 11.5, "a": -1.25}},
    'p-22-fast-0-4': {"A": {"v": 12, "a": -2.5}, "B": {"v": 7, "a": -0.5}},
    'p-22-fast-0-4.5': {"A": {"v": 12, "a": -3}, "B": {"x": 5, "v": 8, "a": -1.4}},
    'p-22-fast-1-6': {"A": {"v": 12, "a": -2}, "B": {"x": 10, "v": 8, "a": -2}},
    'p-22-fast-2-6': {"A": {"v": 12, "a": -1}, "B": {"x": 13, "v": 8, "a": -2}},
    'p-22-slow-2-6': {"A": {"v": 18, "a": -4}, "B": {"v": 28, "a": -8}},
    'p-22-equal-2-6': {"A": {"v": 12, "a": -1}, "B": {"x": 3, "v": 12, "a": -2}},
    'm-00-0-8': {"B": {"x": 30}},
    'm-01-0-8': {"B": {"x": 33}},
    'm-02-0-8': {"B": {"x": 38}},
    'm-02-0-72': {"B": {"x": 55.5}},
    'm-10-0-8': {"B": {"x": 33}},
    'm-11-0-8': {"A": {"v": 5.5, "a": 1.5}, "B": {"v": -5.5, "a": -0.75, "x": 34.5}},
    'm-12-0-8': {"B": {"x": 45}},
    'm-12-0-72': {"A": {"v": 10, "a": 4}, "B": {"x": 50, "v": -10, "a": 4}},
    'm-12-1-8': {"B": {"x": 52}},
    'm-12-2-8': {"A": {"v": 5, "a": 0.75}, "B": {"v": -5, "a": 1.25, "x": 23.5}},
    'm-12-2-36': {"A": {"v": 8, "a": 1.75}, "B": {"v": -8, "a": 3.75, "x": 34}},
    'm-20-0-8': {"B": {"x": 38}},
    'm-20-0-72': {"B": {"x": 55.5}},
    'm-21-0-8': {"B": {"x": 45}},
    'm-21-0-72': {"A": {"v": 10, "a": -4}, "B": {"x": 50, "v": -10, "a": -4}},
    'm-21-1-8': {"A": {"v": 5, "a": -1.25}, "B": {"v": -5, "a": -0.75, "x": 23.5}},
    'm-21-1-36': {"A": {"v": 8, "a": -3.75}, "B": {"v": -8, "a": -1.75, "x": 34}},
    'm-21-2-8': {"B": {"x": 52}},
    'm-22-0-8': {"A": {"v": 7, "a": -2.75}, "B": {"v": -7, "a": 1.25, "x": 22.5}},
    'm-22-0-24': {"A": {"a": -4.25}, "B": {"x": 25}},
    'm-22-0-36': {"A": {"v": 10, "a": -8}, "B": {"x": 36, "v": -10, "a": 4}},
    'm-22-1-36': {"A": {"v": 10, "a": -4}, "B": {"x": 25, "v": -10, "a": 4}},
  };
  function centerTeachingEvent(preset) {
    const values = teachingDefaults[preset.id];
    if (!values) return preset;
    const A = { ...preset.A, ...values.A }, B = { ...preset.B, ...values.B };
    const description = preset.description.replace(/初始间距 [\d.]+ m/, `初始间距 ${B.x} m`);
    return { ...preset, A, B, description };
  }
  // A shared forward speed preserves the relative motion and event times,
  // while giving both initial velocity arrows enough length to compare.
  // Apply only while neither object stops: adding speed during braking would
  // otherwise change the stop times and the physical situation.
  const sharedSpeed = {
    'p-01-fast-0-6': 5, 'p-01-fast-0-8': 2, 'p-01-fast-0-12': 3,
    'p-01-slow-0-6': 2, 'p-01-equal-0-6': 2,
    'p-10-fast-0-6': 3, 'p-10-equal-0-6': 2,
    'p-11-fast-0-6': 5, 'p-11-fast-1-6': 2,
    'p-11-fast-2-6': 6, 'p-11-fast-2-8': 3, 'p-11-fast-2-12': 6,
    'p-11-slow-1-6': 2, 'p-11-slow-2-6': 3,
    'p-11-equal-0-6': 3, 'p-11-equal-1-6': 2, 'p-11-equal-2-6': 2
  };
  // For the most extreme accelerating/braking examples, choose simpler
  // numbers while retaining the declared motion and encounter outcome.
  const balancedDefaults = {
    'p-10-slow-0-6': { A: { v: 6, a: 4 }, B: { x: 3.5, v: 12 } },
    'p-11-slow-0-6': { A: { v: 6, a: 4 }, B: { x: 5, v: 9, a: 2 } },
    'p-22-fast-1-40': { A: { v: 13, a: -3.5 }, B: { x: 12, v: 10, a: -3.5 } },
    'p-22-slow-0-6': { A: { v: 9, a: -7 }, B: { v: 14, a: -3.5 } },
    'p-22-slow-1-6': { A: { v: 9, a: -3.5 }, B: { v: 14, a: -3.5 } },
    'p-22-equal-0-6': { A: { v: 12, a: -6 }, B: { v: 12, a: -3 } },
    'p-22-equal-2-40': { A: { v: 12, a: -3 }, B: { x: 15, v: 12, a: -6 } }
  };
  function balanceTeachingExample(preset) {
    const extra = sharedSpeed[preset.id] || 0;
    const values = balancedDefaults[preset.id] || {};
    const A = { ...preset.A, v: preset.A.v + extra, ...values.A };
    const B = { ...preset.B, v: preset.B.v + extra, ...values.B };
    return { ...preset, A, B, description: preset.description.replace(/初始间距 [\d.]+ m/, `初始间距 ${B.x} m`) };
  }
  const list = createPursuit().concat(createMeeting()).map(shortenDemo).map(clearerPursuit).map(centerTeachingEvent).map(balanceTeachingExample);
  window.Presets = {
    list,
    labels: {
      scope: { pursuit: '同向追及', meeting: '相向相遇' },
      fields: { group: '按运动形式分', initial: '按初速度关系分', advantage: '按速度差变化分', process: '按间距变化分', phase: '按运动过程分', result: '按相遇结果分' },
      pursuit: { initial: ['后快前慢', '后慢前快', '初速度相同'], advantage: ['越来越有利', '越来越不利', '速度差不变'] },
      meeting: { initial: ['双方运动'], advantage: ['靠近越来越快', '靠近越来越慢', '靠近速度不变'], phase: ['相遇前都在运动', '一方停下后相遇', '双方停下仍未相遇', '恰好停下时相遇'] },
      process: ['一直靠近', '一直远离', '先远离后靠近', '先靠近后远离', '间距保持不变', '间距多次变化'],
      result: ['没有相遇', '相遇一次', '恰好相遇', '相遇两次', '相遇后保持同位置']
    }
  };
})();
