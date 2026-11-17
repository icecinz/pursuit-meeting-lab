/* Shared, physically scaled canvas drawing for single and comparison scenes. */
(() => {
  'use strict';
  const P = window.Physics;
  const A_COLOR = '#477fa8', B_COLOR = '#795bb1';
  const PAPER = '#fbfaf5', INK = '#4d5c50';
  const modelCache = new Map();
  const fontScale = () => typeof window.motionFontScale === 'function' ? window.motionFontScale() : 1;
  const uiScale = () => Math.max(.1, typeof window.motionUIScale === 'function' ? window.motionUIScale() : fontScale() / 1.5);

  function context(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const ratio = window.devicePixelRatio || 1;
    const w = rect.width, h = rect.height;
    const width = Math.round(w * ratio), height = Math.round(h * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return {ctx, w, h};
  }

  function model(scene) {
    const key = JSON.stringify([scene.A, scene.B, scene.duration]);
    let cached = modelCache.get(key);
    if (!cached) {
      const times = [0, scene.duration];
      for (const obj of [scene.A, scene.B]) {
        const turn = obj.a ? -obj.v / obj.a : Infinity;
        if (turn > 0 && turn < scene.duration) times.push(turn);
      }
      cached = {
        bounds: scene.bounds || P.bounds(scene.A, scene.B, scene.duration),
        events: scene.events || P.events(scene.A, scene.B, scene.duration),
        maxSpeed: Math.max(...[scene.A, scene.B].flatMap(obj => [
          Math.abs(P.velocity(obj, 0)), Math.abs(P.velocity(obj, scene.duration))
        ])),
        // Exact breakpoints keep the vertex of a stopping v–t graph sharp.
        velocityTimes: [...new Set(times)].sort((a, b) => a - b),
        positionTimes: [...new Set(times.concat(Array.from({length: 161}, (_, i) => scene.duration * i / 160)))].sort((a, b) => a - b)
      };
      if (modelCache.size >= 64) modelCache.delete(modelCache.keys().next().value);
      modelCache.set(key, cached);
    }
    return cached;
  }

  function niceAxis(low, high, target = 4) {
    if (!Number.isFinite(low) || !Number.isFinite(high)) { low = -1; high = 1; }
    if (low > high) [low, high] = [high, low];
    if (low === high) {
      const padding = Math.max(1, Math.abs(low) * .1);
      low -= padding; high += padding;
    }
    const rough = (high - low) / Math.max(1, target);
    const power = 10 ** Math.floor(Math.log10(rough));
    const fraction = rough / power;
    const unit = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    const step = unit * power, eps = step * 1e-10;
    let start = Math.floor((low + eps) / step) * step;
    let end = Math.ceil((high - eps) / step) * step;
    if (start > low + eps) start -= step;
    if (end < high - eps) end += step;
    const clean = value => Math.abs(value) < eps ? 0 : Number(value.toPrecision(14));
    start = clean(start); end = clean(end);
    const count = Math.round((end - start) / step), ticks = [];
    for (let i = 0; i <= count && i <= 30; i++) ticks.push(clean(start + i * step));
    return {min: start, max: end, step, ticks};
  }

  function axisLabel(value, step) {
    const digits = Math.max(0, Math.min(15, -Math.floor(Math.log10(step) + 1e-10)));
    if (Math.abs(value) < step * 1e-9) value = 0;
    return value.toLocaleString('en-US', {maximumFractionDigits: digits});
  }

  function block(c, front, top, width, height, label, color, direction, velocity, maxSpeed, canvasWidth, compact, arrowY = top - 8, textScale = fontScale()) {
    const left = direction > 0 ? front - width : front;
    const right = left + width, bottom = top + height;
    c.save();
    c.fillStyle = '#faf9f4';
    c.fillRect(left, top, width, height);
    c.save(); c.beginPath(); c.rect(left, top, width, height); c.clip();
    c.globalAlpha = .34; c.strokeStyle = color; c.lineWidth = .8;
    for (let i = -height; i < width + height; i += 8) {
      c.beginPath(); c.moveTo(left + i, bottom + 1);
      c.lineTo(left + i + height + 1, top - 1); c.stroke();
    }
    c.restore();
    c.strokeStyle = color; c.lineWidth = 1.8; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(left + .4, top + .3); c.lineTo(right - .4, top);
    c.lineTo(right, bottom - .3); c.lineTo(left, bottom); c.closePath(); c.stroke();
    c.globalAlpha = .34; c.lineWidth = .65;
    c.beginPath(); c.moveTo(left - 1, top + 1.4); c.lineTo(right + .5, top + .7);
    c.lineTo(right + 1, bottom + .6); c.lineTo(left - .7, bottom - .4); c.closePath(); c.stroke();
    c.globalAlpha = 1;
    // The reference edge stays on the same material point after a reversal.
    c.lineWidth = compact ? 3.5 : 5;
    c.beginPath(); c.moveTo(front, top + 1); c.lineTo(front, bottom - 1); c.stroke();
    c.fillStyle = color;
    c.font = `600 ${Math.min(17 * textScale, height * .62)}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, (left + right) / 2, top + height / 2 + 1);
    const arrowLimit = compact ? 34.8 : Math.min(54, width * .6);
    const length = maxSpeed > 0 ? Math.abs(velocity) / maxSpeed * Math.min(arrowLimit, Math.max(0, canvasWidth - 8)) : 0;
    if (length > 0) {
      const sign = Math.sign(velocity), center = (left + right) / 2, y = arrowY;
      // Translate, never shorten, an arrow close to the canvas edge.
      const start = sign > 0
        ? Math.max(4, Math.min(center, canvasWidth - 4 - length))
        : Math.max(4 + length, Math.min(center, canvasWidth - 4));
      const tip = start + sign * length, head = Math.min(6, length * .35), halfHead = head * .65;
      c.lineWidth = Math.min(1.8, Math.max(.15, length / 2));
      c.beginPath(); c.moveTo(start, y); c.lineTo(tip, y);
      c.moveTo(tip - sign * head, y - halfHead); c.lineTo(tip, y);
      c.lineTo(tip - sign * head, y + halfHead); c.stroke();
    }
    c.restore();
  }

  function track(canvas, scene, options = {}) {
    const surface = context(canvas);
    if (!surface) return;
    const c = surface.ctx, ui = uiScale(), compact = options.compact === true;
    const w = surface.w / ui, h = surface.h / ui, scale = fontScale() / ui;
    // Draw the whole track in one logical coordinate system. Fonts are
    // divided by the same factor so this transform scales them only once.
    c.save(); c.scale(ui, ui);
    const data = model(scene), bounds = options.bounds || scene.bounds || data.bounds;
    const range = Math.max(15, bounds.max - bounds.min), pad = range * .11;
    const min = bounds.min - pad, max = bounds.max + pad;
    const blockWidth = compact
      ? Math.min(58, Math.max(36, w * .17))
      : Math.min(116, Math.max(82, w * .2), Math.max(42, (w - 32) / 2));
    const margin = blockWidth + (compact ? 8 : 12), axisWidth = Math.max(1, w - 2 * margin);
    const x = value => margin + (value - min) / (max - min) * axisWidth;
    const xa = x(P.position(scene.A, scene.time)), xb = x(P.position(scene.B, scene.time));
    const frontDirection = obj => Math.sign(obj.v) || Math.sign(obj.a) || 1;
    const blockHeight = compact ? Math.min(22, Math.max(16, (h - 96) / 2)) : Math.min(50, Math.max(38, h * .15));
    const axisFontSize = (compact ? 9 : 12) * scale;
    const topA = compact ? 20 : Math.max(20, 14 + 4 * scale);
    const axisY = compact ? h - axisFontSize - 10 : h - Math.max(40, 25 + 12 * scale);
    const topB = compact
      ? topA + blockHeight + 28
      : Math.max(topA + blockHeight + 36, axisY - blockHeight - Math.max(22, 10 + 10 * scale));
    const guideY = (topA + blockHeight + topB) / 2;
    const maxSpeed = options.maxSpeed ?? data.maxSpeed;
    const labels = !compact && scene.scope === 'pursuit' ? ['A 追', 'B 被追'] : ['A', 'B'];
    block(c, xa, topA, blockWidth, blockHeight, labels[0], A_COLOR, frontDirection(scene.A), P.velocity(scene.A, scene.time), maxSpeed, w, compact, undefined, scale);
    // The distance guide stays between the objects. The second speed arrow
    // belongs below B, away from both that guide and the position axis.
    const bArrowY = compact ? Math.min(topB + blockHeight + 10, axisY - 14) : undefined;
    block(c, xb, topB, blockWidth, blockHeight, labels[1], B_COLOR, frontDirection(scene.B), P.velocity(scene.B, scene.time), maxSpeed, w, compact, bArrowY, scale);
    c.save();
    c.setLineDash([3, 4]); c.lineWidth = 1; c.strokeStyle = '#aab4a7';
    c.beginPath(); c.moveTo(xa, topA + blockHeight + 2); c.lineTo(xa, guideY);
    c.moveTo(xb, guideY); c.lineTo(xb, topB - 2); c.stroke();
    c.setLineDash([]); c.strokeStyle = '#869783'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(xa, guideY); c.lineTo(xb, guideY); c.stroke();
    for (const [point, color] of [[xa, A_COLOR], [xb, B_COLOR]]) {
      c.fillStyle = color; c.beginPath(); c.arc(point, guideY, 2.3, 0, Math.PI * 2); c.fill();
    }
    if (!compact) {
      // Reserve a fixed label, number and unit from the whole trajectory.
      // Only the physical midpoint follows the objects; digit length cannot
      // change the caption's anchor, unit position or edge clamping.
      const size = 13 * scale, spacing = 5;
      const textFont = `600 ${size}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const numberFont = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      const value = Math.abs(P.position(scene.B, scene.time) - P.position(scene.A, scene.time)).toFixed(2);
      c.font = textFont;
      const labelWidth = c.measureText('车头间距').width, unitWidth = c.measureText('m').width;
      c.font = numberFont;
      const digits = Math.max(4, (bounds.max - bounds.min).toFixed(2).length);
      const numberWidth = c.measureText('0'.repeat(digits)).width;
      const reservedWidth = labelWidth + numberWidth + unitWidth + spacing * 2 + 12;
      const boxWidth = Math.min(w - 8, reservedWidth), compression = boxWidth / reservedWidth;
      const mid = Math.max(boxWidth / 2 + 3, Math.min(w - boxWidth / 2 - 3, (xa + xb) / 2));
      c.fillStyle = PAPER;
      c.fillRect(mid - boxWidth / 2, guideY - 9 - size, boxWidth, size + 7);
      c.translate(mid - boxWidth / 2, guideY - 6);
      c.scale(compression, 1);
      c.fillStyle = INK; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.font = textFont;
      c.fillText('车头间距', 6, 0);
      c.font = numberFont; c.textAlign = 'right';
      c.fillText(value, 6 + labelWidth + spacing + numberWidth, 0);
      c.font = textFont; c.textAlign = 'left';
      c.fillText('m', 6 + labelWidth + spacing * 2 + numberWidth, 0);
    }
    c.restore();
    c.strokeStyle = '#c5d0c2'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(margin, axisY); c.lineTo(w - margin, axisY); c.stroke();
    c.fillStyle = INK; c.font = `600 ${axisFontSize}px -apple-system, sans-serif`;
    c.textAlign = 'center';
    const axis = niceAxis(min, max, Math.max(2, Math.min(6, Math.floor(axisWidth / ((compact ? 65 : 100) * scale)))));
    for (const tick of axis.ticks) {
      if (tick < min - 1e-9 || tick > max + 1e-9) continue;
      const xx = x(tick);
      c.beginPath(); c.moveTo(xx, axisY); c.lineTo(xx, axisY + 5); c.stroke();
      c.fillText(axisLabel(tick, axis.step), xx, axisY + 7 + axisFontSize);
    }
    c.textAlign = 'right';
    c.fillText(compact ? 'x / m' : '位置 / m', w - (compact ? 2 : 8), compact ? axisY + 7 + axisFontSize : axisY + 20 + axisFontSize);
    c.restore();
  }

  function limits(type, scene, options, data) {
    if (type === 'v' && options.velocityLimits) return options.velocityLimits;
    let low, high;
    if (type === 'x') {
      const bounds = options.bounds || scene.bounds || data.bounds;
      low = bounds.min; high = bounds.max;
    } else {
      const values = [scene.A, scene.B].flatMap(obj => [P.velocity(obj, 0), P.velocity(obj, scene.duration)]);
      low = Math.min(...values); high = Math.max(...values);
    }
    low = Math.min(0, low); high = Math.max(0, high);
    if (low === high) return [0, 1];
    const padding = (high - low) * .06;
    return [low < 0 ? low - padding : 0, high > 0 ? high + padding : 0];
  }

  function equalAreaGeometry(scene, config, data) {
    const te = config.speedTime, td = config.displacementTime;
    if (!Number.isFinite(te) || !Number.isFinite(td) || te <= 0 || td <= te || td > scene.duration) return null;
    const key = `${te}:${td}`;
    if (!data.equalAreas) data.equalAreas = new Map();
    if (data.equalAreas.has(key)) return data.equalAreas.get(key);
    const equalVelocity = P.velocity(scene.A, te);
    const close = (a, b) => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
    const first = [[0, P.velocity(scene.A, 0)], [0, P.velocity(scene.B, 0)], [te, equalVelocity]];
    const second = [[te, equalVelocity], [td, P.velocity(scene.A, td)], [td, P.velocity(scene.B, td)]];
    const turnsInside = [scene.A, scene.B].some(obj => obj.stop && obj.v * obj.a < 0 && -obj.v / obj.a < td);
    // These are differences between the two v–t curves, not areas to the
    // zero axis. A half-turn about their intersection matches all vertices.
    const congruent = first.every(([t, v]) => second.some(([s, u]) => close(2 * te - t, s) && close(2 * equalVelocity - v, u)));
    const displacementA = P.position(scene.A, td) - scene.A.x;
    const displacementB = P.position(scene.B, td) - scene.B.x;
    const area = Math.abs(first[1][1] - first[0][1]) * te / 2;
    const valid = !turnsInside && area > 1e-10 && close(equalVelocity, P.velocity(scene.B, te)) && close(displacementA, displacementB) && congruent;
    const geometry = valid ? {triangles: [first, second], area} : null;
    data.equalAreas.set(key, geometry);
    return geometry;
  }

  function areaRegions(c, geometry, X, Y, plotBox) {
    const colors = [B_COLOR, A_COLOR], fills = ['#795bb132', '#477fa835'];
    c.save();
    c.beginPath(); c.rect(plotBox.left, plotBox.top, plotBox.width, plotBox.height); c.clip();
    geometry.triangles.forEach((triangle, i) => {
      c.beginPath();
      triangle.forEach(([t, v], j) => { if (j === 0) c.moveTo(X(t), Y(v)); else c.lineTo(X(t), Y(v)); });
      c.closePath(); c.fillStyle = fills[i]; c.fill();
      c.setLineDash([]); c.strokeStyle = colors[i]; c.lineWidth = 1.25; c.stroke();
    });
    c.restore();
  }

  function areaLabels(c, geometry, X, Y, fontSize, plotBox) {
    c.save();
    c.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    geometry.triangles.forEach((triangle, i) => {
      const centerX = triangle.reduce((sum, [t]) => sum + X(t), 0) / 3;
      const centerY = triangle.reduce((sum, [, v]) => sum + Y(v), 0) / 3;
      const offset = Math.max(18, fontSize * 1.4) * (i === 0 ? 1 : -1);
      const label = i === 0 ? 'S₁' : 'S₂';
      const width = c.measureText(label).width + 8, height = fontSize * 1.2;
      const x = Math.max(plotBox.left + width / 2 + 3, Math.min(plotBox.right - width / 2 - 3, centerX));
      const y = Math.max(plotBox.top + height / 2 + 2, Math.min(plotBox.bottom - height / 2 - 2, centerY + offset));
      c.strokeStyle = i === 0 ? B_COLOR : A_COLOR; c.lineWidth = 1; c.setLineDash([]);
      c.beginPath(); c.moveTo(centerX, centerY); c.lineTo(x, y); c.stroke();
      c.fillStyle = PAPER; c.fillRect(x - width / 2, y - height / 2, width, height);
      c.fillStyle = i === 0 ? '#6d4b9b' : '#366b92'; c.fillText(label, x, y);
    });
    // Use the spare heading space, never the thin triangles themselves.
    const areaText = Number(geometry.area.toFixed(3)).toString();
    const complete = `S₁ = S₂ = ${areaText} m`, short = 'S₁ = S₂';
    const available = plotBox.right - (plotBox.left + 5 + c.measureText('v / (m/s)').width + 12);
    const equation = c.measureText(complete).width <= available ? complete : c.measureText(short).width <= available ? short : '';
    if (equation) {
      c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.fillStyle = '#596452';
      c.fillText(equation, plotBox.right, plotBox.top - 10);
    }
    c.restore();
  }

  function plot(canvas, type, scene, options = {}) {
    const surface = context(canvas);
    if (!surface) return;
    const {ctx: c, w, h} = surface, scale = fontScale(), compact = options.compact === true;
    const T = scene.duration, data = model(scene);
    const fontSize = 10 * scale;
    const top = Math.ceil((compact ? 10 : 18) + fontSize * .8);
    const bottom = h - Math.ceil((compact ? 12 : 18) + fontSize);
    const r = Math.ceil(Math.max(17, fontSize * 1.6));
    const [dataMin, dataMax] = limits(type, scene, options, data), ph = Math.max(1, bottom - top);
    const yTarget = compact ? Math.max(3, Math.min(5, Math.floor(ph / (19 * scale)))) : Math.max(4, Math.min(6, Math.floor(ph / (27 * scale)))) * 1.5;
    const yAxis = niceAxis(dataMin, dataMax, yTarget);
    const visibleTicks = yAxis.ticks.filter(value => value >= dataMin - yAxis.step * 1e-9 && value <= dataMax + yAxis.step * 1e-9);
    c.font = `600 ${fontSize}px -apple-system, sans-serif`;
    const labelWidth = Math.max(0, ...visibleTicks.map(value => c.measureText(axisLabel(value, yAxis.step)).width));
    const l = Math.max(36, Math.ceil(labelWidth + 13)), pw = Math.max(1, w - l - r);
    const X = t => l + t / T * pw, Y = value => top + (dataMax - value) / (dataMax - dataMin) * ph;
    const at = (obj, t) => type === 'x' ? P.position(obj, t) : P.velocity(obj, t);
    const zeroY = Y(0), axisColor = '#68766a', tickLength = 3;
    const area = type === 'v' && options.areaComparison && scene.time + 1e-9 >= options.areaComparison.displacementTime
      ? equalAreaGeometry(scene, options.areaComparison, data) : null;
    const plotBox = {left: l, right: w - r, top, bottom, width: pw, height: ph};
    c.lineWidth = 1; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const tick of visibleTicks) {
      const yy = Y(tick);
      if (Math.abs(tick) > yAxis.step * 1e-9) {
        c.strokeStyle = '#e7ebe1'; c.beginPath(); c.moveTo(l, yy); c.lineTo(w - r, yy); c.stroke();
      }
      c.fillStyle = INK; c.fillText(axisLabel(tick, yAxis.step), l - 6, yy);
      c.strokeStyle = axisColor; c.beginPath(); c.moveTo(l - tickLength, yy); c.lineTo(l, yy); c.stroke();
    }
    const timeAxis = niceAxis(0, T, Math.max(3, Math.min(6, Math.floor(pw / ((compact ? 45 : 65) * scale)))));
    c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = INK;
    for (const tick of timeAxis.ticks) {
      if (tick <= 0 || tick > T + timeAxis.step * 1e-9) continue;
      const xx = X(tick);
      c.strokeStyle = axisColor; c.beginPath(); c.moveTo(xx, zeroY); c.lineTo(xx, zeroY + tickLength); c.stroke();
      c.fillText(axisLabel(tick, timeAxis.step), xx, zeroY + tickLength + 2);
    }
    if (area) areaRegions(c, area, X, Y, plotBox);
    c.strokeStyle = axisColor; c.lineWidth = 1.1; c.setLineDash([]); c.beginPath();
    c.moveTo(l, bottom); c.lineTo(l, top - 5); c.lineTo(l - 3.5, top);
    c.moveTo(l, top - 5); c.lineTo(l + 3.5, top);
    c.moveTo(l, zeroY); c.lineTo(w - r + 5, zeroY); c.lineTo(w - r, zeroY - 3.5);
    c.moveTo(w - r + 5, zeroY); c.lineTo(w - r, zeroY + 3.5); c.stroke();
    c.fillStyle = INK; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillText(type === 'x' ? 'x / m' : 'v / (m/s)', l + 5, top - 10);
    c.textAlign = 'right'; c.fillText('t / s', w - 2, Math.max(fontSize + 1, zeroY - 6));
    const times = type === 'v' ? data.velocityTimes : data.positionTimes;
    for (const [obj, color, dashed] of [[scene.A, A_COLOR, false], [scene.B, B_COLOR, true]]) {
      c.strokeStyle = color; c.lineWidth = 2.1; c.setLineDash(dashed ? [6, 3.5] : []); c.beginPath();
      for (let i = 0; i < times.length; i++) {
        const t = times[i], px = X(t), py = Y(at(obj, t));
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke(); c.setLineDash([]);
      const px = X(scene.time), py = Y(at(obj, scene.time));
      c.fillStyle = PAPER; c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = color; c.lineWidth = 2; c.stroke();
    }
    if (scene.time > 1e-9) {
      c.strokeStyle = '#bfc8b9'; c.lineWidth = 1; c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(X(scene.time), top); c.lineTo(X(scene.time), bottom); c.stroke(); c.setLineDash([]);
    }
    const events = scene.events || data.events;
    for (const t of type === 'x' ? events.meetings : events.equalTimes) {
      if (t < 0 || t > T) continue;
      c.fillStyle = '#b87a43'; c.beginPath(); c.arc(X(t), Y(at(scene.A, t)), 3.3, 0, Math.PI * 2); c.fill();
    }
    if (area) areaLabels(c, area, X, Y, fontSize, plotBox);
    c.textBaseline = 'alphabetic';
  }

  window.MotionRenderer = Object.freeze({track, plot});
})();
