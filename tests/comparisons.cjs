'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
context.window = context;
for (const file of ['physics.js', 'comparison.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, {filename: file});
}
const P = context.Physics, M = context.MotionComparison;
const near = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)),
  `Expected ${expected}, received ${actual}`
);
function times(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => near(value, expected[i]));
}
function select(id, events, count) {
  assert.equal(M.select(id), true);
  assert.equal(M.cases.length, count);
  times(M.events().map(event => event.t), events);
}
function area(vertices) {
  return Math.abs(vertices.reduce((sum, [x, y], i) => {
    const [nextX, nextY] = vertices[(i + 1) % vertices.length];
    return sum + x * nextY - nextX * y;
  }, 0)) / 2;
}

select('slow-start', [1.25, 2.5, 3.75], 4);
for (const {A, B} of M.cases) {
  const events = P.events(A, B, 5);
  times(events.equalTimes, [1.25]);
  times(events.meetings, [3.75]);
  near(P.velocity(A, 1.25), P.velocity(B, 1.25));
  near(P.position(A, 2.5) - A.x, P.position(B, 2.5) - B.x);
  near(P.position(B, 2.5) - P.position(A, 2.5), 3.75);
  near(P.position(A, 3.75), P.position(B, 3.75));

  // All vertices lie on the two v-t curves; neither triangle uses the zero axis.
  const intersection = [1.25, P.velocity(A, 1.25)];
  const first = [[0, P.velocity(A, 0)], [0, P.velocity(B, 0)], intersection];
  const second = [[2.5, P.velocity(A, 2.5)], [2.5, P.velocity(B, 2.5)], intersection];
  near(area(first), 1.25);
  near(area(second), 1.25);
  for (let i = 0; i < first.length; i++) {
    const rotated = first[i].map((value, axis) => 2 * intersection[axis] - value);
    near(rotated[0], second[i][0]);
    near(rotated[1], second[i][1]);
  }
}

select('braking-pursuit', [1, 2.5, 4], 3);
const pursuitMeetings = [[], [2.5], [1, 4]];
M.cases.forEach(({A, B}, i) => {
  const events = P.events(A, B, 5);
  times(events.meetings, pursuitMeetings[i]);
  times(events.equalTimes, [2.5]);
  near(A.v, 9);
  near(A.a, -1.6);
  near(B.v, 5);
  near(B.a, 0);
  for (const time of events.meetings) near(P.position(A, time), P.position(B, time));
});

select('braking-meeting', [2, 3], 3);
const meetingTimes = [[2], [3], []];
M.cases.forEach(({A, B}, i) => {
  times(P.events(A, B, 5).meetings, meetingTimes[i]);
  for (const time of [3, 4, 5]) {
    // Zero velocity means a zero-length velocity arrow after stopping.
    near(P.velocity(A, time), 0);
    near(P.velocity(B, time), 0);
    near(P.position(A, time), P.position(A, 3));
    near(P.position(B, time), P.position(B, 3));
    near(Math.abs(P.position(B, time) - P.position(A, time)), i === 1 ? 0 : 4);
  }
});

const previousId = M.id, previousCases = M.cases;
assert.equal(M.select('unknown-comparison'), false);
assert.equal(M.id, previousId);
assert.equal(M.cases, previousCases);
console.log('Comparison physics: all 3 demos passed.');
