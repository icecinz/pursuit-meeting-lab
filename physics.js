/* One-dimensional motion. Positive values point to the right. */
(function (root) {
  'use strict';

  const EPS = 1e-9;

  function stopTime(obj) {
    if (obj.stop && Math.abs(obj.v) < EPS && Math.abs(obj.a) >= EPS) return 0;
    return obj.stop && obj.v * obj.a < 0 ? -obj.v / obj.a : Infinity;
  }

  function position(obj, t) {
    const elapsed = Math.max(0, Math.min(t, stopTime(obj)));
    return obj.x + obj.v * elapsed + 0.5 * obj.a * elapsed * elapsed;
  }

  function velocity(obj, t) {
    if (t >= stopTime(obj)) return 0;
    return obj.v + obj.a * Math.max(0, t);
  }

  function accelerationAt(obj, t) {
    return t >= stopTime(obj) ? 0 : obj.a;
  }

  function uniqueSorted(values) {
    values.sort((a, b) => a - b);
    return values.filter((v, i) => i === 0 || Math.abs(v - values[i - 1]) > EPS * Math.max(1, Math.abs(v), Math.abs(values[i - 1])));
  }

  function boundaries(A, B, T) {
    const points = [0, T];
    for (const obj of [A, B]) {
      const t = stopTime(obj);
      if (t > 0 && t < T) points.push(t);
    }
    return uniqueSorted(points);
  }

  // Solve c + b*t + a*t² = 0, including a repeated quadratic root.
  function roots(a, b, c) {
    if (Math.abs(a) < EPS) {
      if (Math.abs(b) < EPS) return [];
      return [-c / b];
    }
    let discriminant = b * b - 4 * a * c;
    const scale = Math.max(1, b * b, Math.abs(4 * a * c));
    if (discriminant < -EPS * scale) return [];
    if (Math.abs(discriminant) <= EPS * scale) discriminant = 0;
    const sqrt = Math.sqrt(discriminant);
    if (sqrt === 0) return [-b / (2 * a)];
    // This form avoids cancellation for one root; the other follows from their product.
    const q = -0.5 * (b + (b >= 0 ? sqrt : -sqrt));
    return [q / a, c / q];
  }

  function events(A, B, duration) {
    const T = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    const cuts = boundaries(A, B, T);
    const meetings = [];
    const equalTimes = [];
    let coincident = true;
    let previousCoincident = false;
    let previousEqual = false;

    if (T === 0) {
      if (Math.abs(position(A, 0) - position(B, 0)) < EPS) meetings.push(0);
      if (Math.abs(velocity(A, 0) - velocity(B, 0)) < EPS) equalTimes.push(0);
      return { meetings, equalTimes, coincident: false };
    }

    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i];
      const end = cuts[i + 1];
      const length = end - start;
      const midpoint = (start + end) / 2;
      const c = position(B, start) - position(A, start);
      const b = velocity(B, start) - velocity(A, start);
      const accelerationDifference = accelerationAt(B, midpoint) - accelerationAt(A, midpoint);
      const a = accelerationDifference / 2;
      const samePositionThroughout = Math.abs(c) < EPS && Math.abs(b) < EPS && Math.abs(a) < EPS;
      const sameVelocityThroughout = Math.abs(b) < EPS && Math.abs(accelerationDifference) < EPS;
      coincident = coincident && samePositionThroughout;

      if (samePositionThroughout) {
        // Record when a stretch of coincident motion begins, not every instant in it.
        if (!previousCoincident) meetings.push(start);
      } else {
        for (let t of roots(a, b, c)) {
          if (t >= -EPS && t <= length + EPS) {
            t = Math.max(0, Math.min(length, t));
            // The end of a coincident stretch is not a new encounter.
            if (!(previousCoincident && t < EPS)) meetings.push(start + t);
          }
        }
      }
      if (sameVelocityThroughout) {
        if (!previousEqual) equalTimes.push(start);
      } else if (Math.abs(accelerationDifference) >= EPS) {
        let t = -b / accelerationDifference;
        if (t >= -EPS && t <= length + EPS) {
          t = Math.max(0, Math.min(length, t));
          if (!(previousEqual && t < EPS)) equalTimes.push(start + t);
        }
      }
      previousCoincident = samePositionThroughout;
      previousEqual = sameVelocityThroughout;
    }

    return {
      meetings: coincident ? [] : uniqueSorted(meetings),
      equalTimes: uniqueSorted(equalTimes),
      coincident
    };
  }

  function bounds(A, B, duration) {
    const T = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    let min = Infinity;
    let max = -Infinity;
    for (const obj of [A, B]) {
      const samples = [0, T];
      const stoppedAt = stopTime(obj);
      if (stoppedAt > 0 && stoppedAt < T) samples.push(stoppedAt);
      if (Math.abs(obj.a) >= EPS) {
        const turningAt = -obj.v / obj.a;
        if (turningAt > 0 && turningAt < T && turningAt <= stoppedAt) samples.push(turningAt);
      }
      for (const time of samples) {
        const x = position(obj, time);
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
    }
    return { min, max };
  }

  root.Physics = { position, velocity, events, bounds };
})(typeof window !== 'undefined' ? window : globalThis);
