/* Fixed teaching comparisons share one clock and one physical scale per demo. */
(() => {
  'use strict';
  const P = window.Physics, R = window.MotionRenderer, duration = 5;
  const EPS = 1e-8;
  const sameTime = (a, b) => Math.abs(a - b) <= EPS;
  const format = value => (Math.abs(value) < .005 ? 0 : value).toFixed(2);
  const freezeEvents = events => Object.freeze({
    meetings: Object.freeze([...events.meetings]),
    equalTimes: Object.freeze([...events.equalTimes]),
    coincident: events.coincident
  });

  function scene(id, title, scope, initialA, initialB, compareAreas = false) {
    const A = Object.freeze({...initialA}), B = Object.freeze({...initialB});
    const events = freezeEvents(P.events(A, B, duration));
    // Equal displacements are encounters after rebasing each starting point to zero.
    const displacementEvents = freezeEvents(P.events({...A, x: 0}, {...B, x: 0}, duration));
    const bounds = Object.freeze(P.bounds(A, B, duration));
    const speedExtrema = Object.freeze(events.equalTimes.map(t => {
      const dt = Math.min(.0001, t / 2, (duration - t) / 2);
      const gap = time => Math.abs(P.position(B, time) - P.position(A, time));
      const center = gap(t), before = gap(t - dt), after = gap(t + dt);
      const label = dt > 0 && center > before && center > after ? '间距最大'
        : dt > 0 && center < before && center < after ? '间距最小' : '速度相等';
      return Object.freeze({t, label});
    }));
    let areaComparison;
    if (compareAreas) {
      const speedTime = events.equalTimes.find(t => t > EPS);
      const displacementTime = displacementEvents.meetings.find(t => t > EPS);
      const area = .5 * speedTime * Math.abs(B.v - A.v);
      areaComparison = Object.freeze({speedTime, displacementTime, area});
    }
    return Object.freeze({id, title, scope, A, B, duration, events, bounds,
      displacementEvents, speedExtrema, areaComparison});
  }

  function mergePoints(points) {
    const merged = [];
    for (const point of points.filter(p => Number.isFinite(p.t) && p.t >= 0 && p.t <= duration).sort((a, b) => a.t - b.t)) {
      const previous = merged[merged.length - 1];
      const tolerance = 64 * Number.EPSILON * Math.max(1, Math.abs(point.t), Math.abs(previous?.t || 0));
      if (previous && Math.abs(previous.t - point.t) <= tolerance) {
        if (!previous.labels.includes(point.label)) previous.labels.push(point.label);
      } else merged.push({t: point.t, labels: [point.label]});
    }
    return Object.freeze(merged.map(point => Object.freeze({t: point.t, labels: Object.freeze(point.labels)})));
  }

  function commonTimes(cases, read) {
    return read(cases[0]).filter(t => t > EPS && cases.every(item => read(item).some(other => sameTime(t, other))));
  }

  function demo(id, title, description, summary, cases, velocityLimits, points) {
    const bounds = Object.freeze({
      min: Math.min(...cases.map(item => item.bounds.min)),
      max: Math.max(...cases.map(item => item.bounds.max))
    });
    const velocities = cases.flatMap(item => [item.A, item.B].flatMap(obj => [
      P.velocity(obj, 0), P.velocity(obj, duration)
    ]));
    const maxSpeed = Math.max(...velocities.map(Math.abs));
    const options = Object.freeze({compact: true, bounds, maxSpeed, velocityLimits: Object.freeze(velocityLimits)});
    return Object.freeze({id, title, description, summary, duration, cases: Object.freeze(cases),
      bounds, maxSpeed, options, points: mergePoints(points),
      gapWidth: format(bounds.max - bounds.min).length + .5,
      speedWidth: Math.max(...velocities.map(value => format(value).length)) + .5});
  }

  const slowCases = [
    ['accelerate-uniform', '加速追匀速', 1.6, 0],
    ['uniform-decelerate', '匀速追减速', 0, -1.6],
    ['accelerate-decelerate', '加速追减速', .8, -.8],
    ['accelerate-accelerate', '加速追加速', 2.4, .8]
  ].map(([id, title, aA, aB]) => scene(id, title, 'pursuit',
    {x: 0, v: 7, a: aA, stop: aA < 0}, {x: 3.75, v: 9, a: aB, stop: aB < 0}, true));
  const slowPoints = [
    ...commonTimes(slowCases, item => item.events.equalTimes).map(t => ({t, label: '四组等速'})),
    ...commonTimes(slowCases, item => item.displacementEvents.meetings).map(t => ({t, label: '四组位移相同'})),
    ...commonTimes(slowCases, item => item.events.meetings).map(t => ({t, label: '四组相遇'}))
  ];

  const pursuitCases = [
    ['not-caught', '未追上', 7],
    ['just-caught', '恰好追上', 5],
    ['twice-caught', '两次相遇', 3.2]
  ].map(([id, title, distance]) => scene(id, title, 'pursuit',
    {x: 0, v: 9, a: -1.6, stop: true}, {x: distance, v: 5, a: 0, stop: false}));
  const pursuitPoints = commonTimes(pursuitCases, item => item.events.equalTimes).map(t => ({t, label: '三组等速'}));
  for (const item of pursuitCases) item.events.meetings.forEach((t, i) => {
    pursuitPoints.push({t, label: item.events.meetings.length > 1 ? `${item.title} · ${i === 0 ? '首次' : '再次'}` : item.title});
  });

  const meetingCases = [
    ['before-stopping', '停车前相遇', 32],
    ['at-stopping', '恰好停下时相遇', 36],
    ['no-meeting', '停下仍未相遇', 40]
  ].map(([id, title, distance]) => scene(id, title, 'meeting',
    {x: 0, v: 12, a: -4, stop: true}, {x: distance, v: -12, a: 4, stop: true}));
  const stoppedAt = item => [item.A, item.B].map(obj => obj.stop && obj.v * obj.a < 0 ? -obj.v / obj.a : Infinity);
  const meetingPoints = commonTimes(meetingCases, stoppedAt).map(t => ({t, label: '三组停车'}));
  meetingCases.forEach((item, i) => item.events.meetings.forEach(t => {
    meetingPoints.push({t, label: i === 0 ? '首组相遇' : '临界相遇'});
  }));

  const demos = Object.freeze([
    demo('slow-start', '初速度小追初速度大的',
      '2.5 s 时位移相同，位置仍差 3.75 m；两块阴影三角形全等。',
      'A 在后、B 在前 · 初速度 7 / 9 m/s · 初始间距 3.75 m', slowCases, [0, 20], slowPoints),
    demo('braking-pursuit', '减速追匀速的三种结果',
      '只改变初始间距，比较未追上、恰好追上和两次相遇。',
      'A 初速度 9 m/s，加速度 −1.6 m/s² · B 匀速 5 m/s · 初始间距 7 / 5 / 3.2 m', pursuitCases, [0, 10], pursuitPoints),
    demo('braking-meeting', '相向减速的临界情况',
      '只改变初始间距；两物体均在 3 s 停下，比较相遇与停车的先后。',
      '初速度 12 / −12 m/s · 加速度 −4 / 4 m/s² · 初始间距 32 / 36 / 40 m', meetingCases, [-15, 15], meetingPoints)
  ]);
  const list = Object.freeze(demos.map(({id, title, description, summary}) => Object.freeze({id, title, description, summary})));
  let active = demos[0], boundRoot = null, cards = [];

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function reading(className, label, unit, width) {
    const wrapper = node('span', `${className} numeric-reading labeled-reading`);
    const value = node('span', 'reading-number', '0.00');
    value.style.setProperty('--number-width', `${width}ch`);
    wrapper.append(node('span', 'reading-label', label), value, node('span', 'reading-unit', unit));
    return {wrapper, value};
  }

  function mount(root) {
    boundRoot = root;
    const grid = root.classList.contains('comparison-grid') ? root : node('div', 'comparison-grid');
    grid.dataset.count = String(active.cases.length);
    grid.replaceChildren();
    if (grid !== root) root.replaceChildren(grid);
    // Reserve the whole model domain, including negative speeds, before playback.
    cards = active.cases.map((item, i) => {
      const card = node('section', 'comparison-card panel');
      const heading = node('header', 'comparison-card-head');
      const title = node('h3', '', item.title);
      title.id = `comparison-title-${active.id}-${item.id}`;
      card.setAttribute('aria-labelledby', title.id);
      heading.append(node('span', 'comparison-number', String(i + 1).padStart(2, '0')), title);
      const condition = node('p', 'comparison-condition');
      condition.innerHTML = active.id === 'slow-start'
        ? `a<sub>A</sub> = ${item.A.a}，a<sub>B</sub> = ${item.B.a} m/s²`
        : `初始间距 d = ${format(item.B.x - item.A.x)} m`;
      const track = node('canvas', 'comparison-track');
      track.setAttribute('aria-label', `${item.title}，两物体的运动与车头位置`);
      const readings = node('div', 'comparison-readings');
      const gap = reading('comparison-gap', '间距', 'm', active.gapWidth);
      const phase = node('span', 'comparison-phase');
      readings.append(gap.wrapper, phase);
      const chart = node('canvas', 'comparison-chart');
      chart.setAttribute('aria-label', `${item.title}的速度—时间图，A为实线，B为虚线`);
      const speeds = node('div', 'comparison-speeds');
      const speedA = reading('comparison-speed-a', 'A', 'm/s', active.speedWidth);
      const speedB = reading('comparison-speed-b', 'B', 'm/s', active.speedWidth);
      speeds.append(speedA.wrapper, speedB.wrapper);
      card.append(heading, condition, track, readings, chart, speeds);
      grid.append(card);
      return {scene: item, track, chart, gap: gap.value, phase, speedA: speedA.value, speedB: speedB.value};
    });
  }

  function phaseAt(item, t, relative, vA, vB) {
    const met = item.events.meetings.some(time => time <= t + EPS);
    if (item.scope === 'meeting') {
      const stopped = Math.abs(vA) < EPS && Math.abs(vB) < EPS;
      if (Math.abs(relative) < EPS) return stopped ? (item.events.meetings.some(time => sameTime(time, t)) ? '同位停下' : '保持重合') : '相遇';
      if (stopped) return met ? '相遇后停下' : '停下未相遇';
      return met ? '已相遇' : '正在靠近';
    }
    if (item.areaComparison && sameTime(t, item.areaComparison.displacementTime)) return '位移相同';
    if (Math.abs(relative) < EPS) {
      if (Math.abs(vA - vB) < EPS) return '恰好追上';
      const index = item.events.meetings.findIndex(time => sameTime(time, t));
      return item.events.meetings.length > 1 ? (index > 0 ? '再次相遇' : '首次相遇') : '相遇';
    }
    if (relative < 0) return '已追上';
    const extremum = item.speedExtrema.find(point => sameTime(point.t, t));
    return extremum ? extremum.label : vA < vB ? '正在远离' : '正在靠近';
  }

  function render(time) {
    const t = Number.isFinite(time) ? Math.max(0, Math.min(active.duration, time)) : 0;
    for (const card of cards) {
      const item = card.scene, current = {...item, time: t};
      const vA = P.velocity(item.A, t), vB = P.velocity(item.B, t);
      const relative = P.position(item.B, t) - P.position(item.A, t);
      card.gap.textContent = format(Math.abs(relative));
      card.phase.textContent = phaseAt(item, t, relative, vA, vB);
      card.phase.dataset.phase = item.events.meetings.some(at => at <= t + EPS) ? 'caught' : 'before';
      card.speedA.textContent = format(vA);
      card.speedB.textContent = format(vB);
      R.track(card.track, current, active.options);
      R.plot(card.chart, 'v', current, item.areaComparison ? {...active.options, areaComparison: item.areaComparison} : active.options);
    }
  }

  function select(id) {
    const next = demos.find(item => item.id === id);
    if (!next) return false;
    if (next === active) return true;
    active = next;
    if (boundRoot) mount(boundRoot);
    return true;
  }

  window.MotionComparison = Object.freeze({
    list, select, mount, render, events: () => active.points,
    get id() { return active.id; }, get title() { return active.title; },
    get description() { return active.description; }, get summary() { return active.summary; },
    get duration() { return active.duration; }, get cases() { return active.cases; },
    get bounds() { return active.bounds; }, get maxSpeed() { return active.maxSpeed; }
  });
})();
