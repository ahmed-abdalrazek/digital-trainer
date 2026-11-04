/* ============================================================
   Tutori Whiteboard Engine
   Hand-drawn canvas renderer + audio-synced lesson playback.
   Logical coordinate space: 100 (x) by 75 (y), y grows down.
   ============================================================ */
(() => {
  "use strict";

  const LOGICAL_W = 100, LOGICAL_H = 75;

  const PALETTE = {
    ink: "#27272a", blue: "#2563eb", red: "#dc2626", green: "#15803d",
    orange: "#ea580c", purple: "#7c3aed", gray: "#94a3b8", yellow: "#facc15",
  };
  const HILITE = "rgba(250, 204, 21, 0.38)";

  // ---------- deterministic per-op randomness ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- state ----------
  const S = {
    mounted: false,
    wrap: null, agentCv: null, liveCv: null, userCv: null,
    actx: null, bakedOps: [],          // committed agent ops [{op, seed}]
    userStrokes: [],                   // [{color, size, eraser, pts:[[x,y]..]}]
    queue: [], playing: false, curTurn: null, enqueued: 0,
    curAudio: null, raf: 0, paused: false, lectureStarted: false,
    tool: { mode: "pen", color: "#2563eb", size: 0.45 },
    scale: 1, offX: 0, offY: 0,
    opSeedCounter: 1,
    voiceOn: true,
    keepBoardUntil: 0, serverDone: false, completionText: "انتهى الشرح ✓", lectureCompleted: false,
    scrollTid: 0,
  };

  function px([x, y]) { return [S.offX + x * S.scale, S.offY + y * S.scale]; }
  function lw(units) { return Math.max(1.4, units * S.scale); }

  // ---------- hand-drawn primitives ----------
  // Build a jittered polyline between two points.
  function jitterSeg(rnd, x1, y1, x2, y2, wob) {
    const [ax, ay] = px([x1, y1]), [bx, by] = px([x2, y2]);
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(3, Math.round(len / 26));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = (i === 0 || i === n) ? 0.35 : 1;
      pts.push([
        ax + (bx - ax) * t + (rnd() - 0.5) * wob * j,
        ay + (by - ay) * t + (rnd() - 0.5) * wob * j,
      ]);
    }
    return pts;
  }

  function strokePts(ctx, pts, frac, color, width) {
    if (pts.length < 2 || frac <= 0) return;
    const upto = Math.max(2, Math.ceil(pts.length * Math.min(1, frac)));
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < upto - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[upto - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }

  function drawLine(ctx, rnd, a, b, color, frac, width, dash) {
    if (dash) ctx.setLineDash([7, 7]);
    // A single restrained marker stroke stays hand-drawn without becoming
    // the fuzzy double line that made dense science diagrams hard to read.
    const wob = Math.min(1.45, S.scale * 0.28);
    strokePts(ctx, jitterSeg(rnd, a[0], a[1], b[0], b[1], wob), frac, color, width);
    ctx.setLineDash([]);
  }

  function drawArrowHead(ctx, a, b, color, width) {
    const [ax, ay] = px(a), [bx, by] = px(b);
    const ang = Math.atan2(by - ay, bx - ax);
    const L = Math.max(9, S.scale * 2.6);
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - L * Math.cos(ang - 0.45), by - L * Math.sin(ang - 0.45));
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - L * Math.cos(ang + 0.45), by - L * Math.sin(ang + 0.45));
    ctx.stroke();
  }

  function ellipsePts(rnd, cx, cy, rx, ry) {
    const [pcx, pcy] = px([cx, cy]);
    const prx = rx * S.scale, pry = ry * S.scale;
    const n = 38, start = rnd() * Math.PI * 2, pts = [];
    const wob = Math.min(1.35, S.scale * 0.24);
    for (let i = 0; i <= n; i++) {
      const t = start + (i / n) * Math.PI * 2.015;
      pts.push([
        pcx + Math.cos(t) * prx + (rnd() - 0.5) * wob,
        pcy + Math.sin(t) * pry + (rnd() - 0.5) * wob,
      ]);
    }
    return pts;
  }

  function fontPx(size) {
    // numeric sizes are font sizes in board units (notes shrink-to-fit)
    const base = typeof size === "number" ? size
      : ({ xs: 2.55, s: 3.0, m: 4.0, l: 5.1, xl: 6.2 }[size || "m"] || 4.0);
    return Math.max(11.5, base * S.scale);
  }

  // Split a word into normal/superscript runs: "3^2," -> 3, ²(sup), ","
  function parseSupers(word) {
    const segs = [];
    let i = 0, cur = "";
    while (i < word.length) {
      if (word[i] === "^") {
        if (cur) { segs.push({ t: cur, sup: false }); cur = ""; }
        i++;
        let sup = "";
        while (i < word.length && /[A-Za-z0-9+\-]/.test(word[i]) && sup.length < 4) {
          sup += word[i]; i++;
        }
        if (sup) segs.push({ t: sup, sup: true });
      } else { cur += word[i]; i++; }
    }
    if (cur) segs.push({ t: cur, sup: false });
    return segs;
  }

  const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
  const NOTES_WRAP_W = 44;   // must match _NOTES_WRAP_W in engine.py
  const LABEL_FIT_W = 30;    // arrow/dot labels; matches layout_pass

  // Wrapped size of a string in board units, exactly as drawText lays it out.
  function measureWrapped(ctx, text, size, maxWUnits) {
    const str = String(text).replace(/\^/g, "");
    const arabic = ARABIC_RE.test(str);
    const fpx = fontPx(size);
    ctx.save();
    ctx.font = arabic ? `600 ${fpx}px Tahoma, Arial, sans-serif`
                      : `600 ${fpx}px Caveat, "Comic Sans MS", cursive`;
    const maxW = maxWUnits * S.scale;
    let n = 0, widest = 0, line = "";
    for (const word of str.trim().split(/\s+/)) {
      const cand = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(cand).width > maxW) {
        widest = Math.max(widest, ctx.measureText(line).width); n++; line = word;
      } else line = cand;
    }
    if (line || !n) { widest = Math.max(widest, ctx.measureText(line).width); n++; }
    ctx.restore();
    return { n, w: Math.min(widest, maxW) / S.scale,
             lineH: fpx * (arabic ? 1.2 : 1.06) / S.scale };
  }

  function drawArabicText(ctx, rnd, fullStr, at, size, colorValue, frac, align, fitW, fitH, wrapW, maxLines) {
    if (frac <= 0) return;
    const [x, y] = px(at);
    let fontSize = fontPx(size);
    const maxW = (fitW || wrapW || (size === "xl" ? 88 : 52)) * S.scale;
    const font = () => `600 ${fontSize}px Tahoma, Arial, sans-serif`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rnd() - 0.5) * 0.012);
    ctx.direction = "rtl";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colorValue;
    ctx.globalAlpha = Math.min(1, Math.max(0.12, frac));

    const wrap = () => {
      ctx.font = font();
      const lines = [];
      let line = "";
      for (const word of fullStr.trim().split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxW) {
          lines.push(line);
          line = word;
        } else line = candidate;
      }
      if (line) lines.push(line);
      return lines;
    };

    ctx.font = font();
    const naturalWidth = ctx.measureText(fullStr.replace(/\^/g, "")).width;
    if (fitW && !fitH && naturalWidth > maxW) {
      // one-line labels (callouts, arrows): shrink onto a single line.
      // 2% slack: an exact fit can still wrap its last word on rounding
      fontSize = Math.max(9, fontSize * maxW / naturalWidth * 0.98);
    }
    let lines = wrap();
    // the server reserved exactly `maxLines` lines of `wrapW`: shrink a
    // little rather than spill a line into whatever sits below
    for (let k = 0; maxLines && lines.length > maxLines && k < 5; k++) {
      fontSize *= 0.93;
      lines = wrap();
    }
    if (fitH) {
      // A label inside a shape: wrap onto more lines FIRST and shrink only
      // when the wrapped block is still taller (or a word wider) than the
      // shape. Shrinking to one line first made long labels unreadably tiny.
      const availableH = fitH * S.scale;
      for (let k = 0; k < 10 && fontSize > 9; k++) {
        ctx.font = font();
        const neededH = fontSize * (1 + (lines.length - 1) * 1.2);
        const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
        if (neededH <= availableH && widest <= maxW) break;
        fontSize = Math.max(9, fontSize * 0.92);
        lines = wrap();
      }
    }
    ctx.font = font();
    const lineHeight = fontSize * 1.2;
    // inside a shape the wrapped block is centred on the shape's middle
    const top = fitH ? -(lines.length - 1) * lineHeight / 2 : 0;
    let anchorX = 0;
    if (align === "center") ctx.textAlign = "center";
    else if (align === "right") ctx.textAlign = "right";
    else {
      // Left-anchored Arabic keeps the same footprint the server reserved
      // ([x, x + widest line]) but reads right-to-left: every line starts at
      // the block's right edge instead of trailing off a ragged right side.
      const widest = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)));
      anchorX = widest;
      ctx.textAlign = "right";
    }
    lines.forEach((line, index) => ctx.fillText(line, anchorX, top + index * lineHeight, maxW));
    ctx.restore();
  }

  function drawText(ctx, rnd, text, at, size, color, frac, align, fitW, fitH, wrapW, maxLines) {
    const fullStr = String(text);
    if (ARABIC_RE.test(fullStr)) {
      drawArabicText(ctx, rnd, fullStr, at, size, color, frac, align, fitW, fitH, wrapW, maxLines);
      return;
    }
    const visibleLen = fullStr.replace(/\^/g, "").length;
    let budget = Math.ceil(visibleLen * Math.min(1, frac));
    if (budget <= 0) return;
    const [x, y] = px(at);
    let basePx = fontPx(size);
    if (fitW) {  // shrink to stay inside the shape that owns this label
      ctx.font = `600 ${basePx}px Caveat, "Comic Sans MS", cursive`;
      const w1 = ctx.measureText(fullStr.replace(/\^/g, "")).width;
      const fitPx = fitW * S.scale;
      if (w1 > fitPx) basePx = Math.max(8.5, basePx * fitPx / w1);
    }
    if (fitH) {  // first cap for a single line in a squat shape
      basePx = Math.max(7, Math.min(basePx, fitH * S.scale));
    }
    let supPx = basePx * 0.62;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rnd() - 0.5) * 0.035);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const fontFor = (sup) =>
      `600 ${sup ? supPx : basePx}px Caveat, "Comic Sans MS", cursive`;
    const maxW = (fitW || wrapW || (size === "xl" ? 88 : 52)) * S.scale;
    const buildLines = () => {
      supPx = basePx * 0.62;
      const words = fullStr.trim().split(/\s+/).map(w => {
        const segs = parseSupers(w);
        let wpx = 0;
        for (const s of segs) {
          ctx.font = fontFor(s.sup);
          s.w = ctx.measureText(s.t).width;
          wpx += s.w;
        }
        return { segs, wpx };
      });
      ctx.font = fontFor(false);
      const spaceW = ctx.measureText(" ").width;
      const lines = [];
      let line = [], lineW = 0;
      for (const word of words) {
        if (lineW > 0 && lineW + spaceW + word.wpx > maxW) {
          lines.push({ line, lw: lineW }); line = []; lineW = 0;
        }
        if (lineW > 0) lineW += spaceW;
        line.push(word); lineW += word.wpx;
      }
      if (line.length) lines.push({ line, lw: lineW });
      return { lines, spaceW };
    };
    let layout = buildLines();
    for (let k = 0; maxLines && layout.lines.length > maxLines && k < 5; k++) {
      basePx *= 0.93;          // stay inside the box the server reserved
      layout = buildLines();
    }
    if (fitH && layout.lines.length > 1) {
      const requiredH = basePx * (1 + (layout.lines.length - 1) * 1.06);
      const availableH = fitH * S.scale;
      if (requiredH > availableH) {
        basePx = Math.max(7, basePx * availableH / requiredH);
        layout = buildLines();
      }
    }
    const { lines, spaceW } = layout;
    // draw, spending the reveal budget char by char
    let ly = 0;
    for (const L of lines) {
      let lx = (align === "center") ? -L.lw / 2 : (align === "right") ? -L.lw : 0;
      for (let wi = 0; wi < L.line.length; wi++) {
        if (budget <= 0) break;
        if (wi > 0) { lx += spaceW; budget--; }
        for (const s of L.line[wi].segs) {
          if (budget <= 0) break;
          const shown = s.t.slice(0, budget);
          ctx.font = fontFor(s.sup);
          ctx.fillText(shown, lx, ly + (s.sup ? -basePx * 0.42 : 0));
          lx += ctx.measureText(shown).width;
          budget -= shown.length;
        }
      }
      if (budget <= 0) break;
      ly += basePx * 1.06;
    }
    ctx.restore();
  }

  function catmullRom(ptsPx) {
    if (ptsPx.length < 3) return ptsPx;
    const out = [];
    for (let i = 0; i < ptsPx.length - 1; i++) {
      const p0 = ptsPx[Math.max(0, i - 1)], p1 = ptsPx[i],
            p2 = ptsPx[i + 1], p3 = ptsPx[Math.min(ptsPx.length - 1, i + 2)];
      for (let t = 0; t < 1; t += 0.12) {
        const t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(ptsPx[ptsPx.length - 1]);
    return out;
  }

  // ---------- op rendering (frac = 0..1 animation progress) ----------
  function color(c) { return PALETTE[c] || c || PALETTE.ink; }

  function renderOp(ctx, item, frac) {
    const o = item.op, rnd = mulberry32(item.seed);
    const W = lw(0.55);
    try {
      switch (o.op) {
        case "title": {
          drawText(ctx, rnd, o.text, [50, 6.5], "xl", color(o.color || "ink"), frac, "center", 86, 7.2);
          if (frac > 0.75) {
            const tw = Math.min(70, String(o.text).length * 1.9);
            drawLine(ctx, rnd, [50 - tw / 2, 15], [50 + tw / 2, 15],
              color(o.color || "ink"), (frac - 0.75) / 0.25, lw(0.5));
          }
          break;
        }
        case "text":
          drawText(ctx, rnd, o.text, o.at || [10, 20], o.size || "m",
            color(o.color), frac, o.align, o.fit_w, undefined, o.wrap_w, o.max_lines);
          break;
        case "note":
          drawText(ctx, rnd, o.text, o.at || [10, 20], "s", color(o.color || "gray"), frac, o.align,
            undefined, undefined, o.wrap_w, o.max_lines);
          break;
        case "line":
          drawLine(ctx, rnd, o.from, o.to, color(o.color), frac, W, o.dash);
          break;
        case "arrow": {
          const lineFrac = Math.min(1, frac / 0.8);
          drawLine(ctx, rnd, o.from, o.to, color(o.color), lineFrac, W);
          if (frac > 0.8) drawArrowHead(ctx, o.from, o.to, color(o.color), W);
          if (o.label && frac > 0.55) {
            // server may relocate the label to dodge collisions (label_at)
            const mid = o.label_at ||
              [(o.from[0] + o.to[0]) / 2, (o.from[1] + o.to[1]) / 2 - 3.4];
            drawText(ctx, rnd, o.label, mid, "s", color(o.color), (frac - 0.55) / 0.45, "center", LABEL_FIT_W);
          }
          break;
        }
        case "callout": {
          const c = o.around || o.at || [50, 38];
          const r = o.r || 3;
          const dest = o.label_at || o.to || [c[0] + 12, c[1] - 8];
          const dx = dest[0] - c[0], dy = dest[1] - c[1];
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const circleFrac = Math.min(1, frac / 0.45);
          strokePts(ctx, ellipsePts(rnd, c[0], c[1], r, r * 0.82),
            circleFrac, color(o.color || "orange"), W);
          if (frac > 0.25) {
            const lineFrac = Math.min(1, (frac - 0.25) / 0.45);
            const a = [c[0] + ux * (r + 0.5), c[1] + uy * (r + 0.5)];
            // stop the leader at the label's edge, not a fixed 4 units from
            // its centre — a long Arabic label would otherwise be struck through
            let back = 4.0;
            if (o.label) {
              const lm = measureWrapped(ctx, o.label, "s", o.fit_w || 24);
              const hw = lm.w / 2 + 1.0, hh = lm.lineH / 2 + 0.9;
              back = Math.min(hw / Math.max(Math.abs(ux), 1e-6), hh / Math.max(Math.abs(uy), 1e-6));
            }
            const b = [dest[0] - ux * back, dest[1] - uy * back];
            drawLine(ctx, rnd, a, b, color(o.color || "orange"), lineFrac, W * 0.85);
          }
          if (o.label && frac > 0.55) {
            drawText(ctx, rnd, o.label, dest, "s", color(o.color || "orange"),
              (frac - 0.55) / 0.45, "center", o.fit_w || 24);
          }
          break;
        }
        case "box": {
          const [x, y] = o.at, w = o.w || 22, h = o.h || 10;
          const segs = [
            [[x, y], [x + w, y]], [[x + w, y], [x + w, y + h]],
            [[x + w, y + h], [x, y + h]], [[x, y + h], [x, y]],
          ];
          const sf = Math.min(1, frac / 0.7) * 4;
          segs.forEach((s, i) => {
            const f = Math.max(0, Math.min(1, sf - i));
            if (f > 0) drawLine(ctx, rnd, s[0], s[1], color(o.color), f, W);
          });
          if (o.label && frac > 0.6) {
            drawText(ctx, rnd, o.label, [x + w / 2, y + h / 2], o.size || "m",
              color(o.color), (frac - 0.6) / 0.4, "center", w * 0.92, h * 0.72);
          }
          break;
        }
        case "ellipse": {
          const [x, y] = o.at, w = o.w || 22, h = o.h || 12;
          const pts = ellipsePts(rnd, x + w / 2, y + h / 2, w / 2, h / 2);
          strokePts(ctx, pts, Math.min(1, frac / 0.7), color(o.color), W);
          if (o.label && frac > 0.6) {
            drawText(ctx, rnd, o.label, [x + w / 2, y + h / 2], o.size || "m",
              color(o.color), (frac - 0.6) / 0.4, "center", w * 0.78, h * 0.62);
          }
          break;
        }
        case "curve": {
          const ptsPx = (o.points || []).map(px);
          if (ptsPx.length >= 2) {
            const smooth = catmullRom(ptsPx).map(p =>
              [p[0] + (rnd() - 0.5) * 1.2, p[1] + (rnd() - 0.5) * 1.2]);
            strokePts(ctx, smooth, frac, color(o.color), W);
          }
          break;
        }
        case "polygon": {
          const pts = o.points || [];
          if (pts.length >= 3) {
            const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
            const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
            const segs = pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
            const drawFrac = Math.min(1, frac / 0.7) * segs.length;
            segs.forEach((s, i) => {
              const f = Math.max(0, Math.min(1, drawFrac - i));
              if (f > 0) drawLine(ctx, rnd, s[0], s[1], color(o.color), f, W);
            });
            // side labels: auto-placed outside each edge's midpoint
            if (Array.isArray(o.side_labels) && frac > 0.45) {
              o.side_labels.slice(0, pts.length).forEach((lb, i) => {
                if (!lb) return;
                const a = pts[i], b = pts[(i + 1) % pts.length];
                const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
                let dx = mx - cx, dy = my - cy;
                const len = Math.hypot(dx, dy) || 1;
                drawText(ctx, rnd, lb, [mx + (dx / len) * 5, my + (dy / len) * 5],
                  "s", color(o.color), (frac - 0.45) / 0.55, "center");
              });
            }
            if (o.label && frac > 0.65) {
              // fit the label to the polygon's interior: width of the
              // horizontal chord through the centroid
              const yc = cy + 0.07;   // dodge exact-vertex degeneracy
              const xs = [];
              segs.forEach(([a, b]) => {
                if ((a[1] - yc) * (b[1] - yc) < 0) {
                  xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
                }
              });
              let lx = cx, chord = 0;
              if (xs.length >= 2) {
                const lo = Math.min(...xs), hi = Math.max(...xs);
                chord = hi - lo;
                lx = (lo + hi) / 2;
              } else {
                const pxs = pts.map(p => p[0]);
                chord = (Math.max(...pxs) - Math.min(...pxs)) * 0.55;
              }
              // a height budget too, so a long label (a decision question in
              // a diamond) wraps onto two lines instead of shrinking to one
              const pys = pts.map(p => p[1]);
              const shapeH = Math.max(...pys) - Math.min(...pys);
              drawText(ctx, rnd, o.label, [lx, cy], o.size || "m",
                color(o.color), (frac - 0.65) / 0.35, "center", chord * 0.82,
                Math.max(4, shapeH * 0.5));
            }
          }
          break;
        }
        case "notes": {
          const [nx, ny] = o.at || [66, 20];
          const compact = !!o.compact;     // server shrinks crowded blocks
          const lines = [];
          if (o.title) lines.push({ t: String(o.title), size: compact ? "s" : "m" });
          (o.lines || []).slice(0, 7).forEach(t => lines.push({ t: String(t), size: compact ? "xs" : "s" }));
          const total = lines.reduce((s, l) => s + l.t.length, 0) || 1;
          // Measure every row first: long rows wrap, and the rows below must
          // move down by the extra lines instead of being painted over them.
          const rtl = lines.some(l => ARABIC_RE.test(l.t));
          const indent = compact ? 1.5 : 2;
          const UNITS = { xs: 2.55, s: 3.0, m: 4.0 };
          // The server reserved wrap_w x box_h for this block. Rows wrap
          // inside that width; if the real glyphs need more height than
          // reserved, shrink every row a little instead of overflowing.
          const blockMax = Math.min(NOTES_WRAP_W + indent, o.wrap_w || NOTES_WRAP_W + indent);
          const layoutRows = (k) => {
            let h = 0;
            const rows = lines.map((ln, li) => {
              const ind = li > 0 ? indent : 0;
              const fu = UNITS[ln.size] * k;
              const rowW = Math.min(NOTES_WRAP_W, blockMax - ind);
              let m = measureWrapped(ctx, ln.t, fu, rowW);
              let fit;
              if (m.n > 1) {
                // only slightly too wide (e.g. the 11.5px minimum font on a
                // small board): shrink onto one line instead of wrapping
                const natural = measureWrapped(ctx, ln.t, fu, 1e6).w;
                if (natural <= rowW * 1.25) { fit = rowW; m = { ...m, n: 1, w: rowW }; }
              }
              const step = (li === 0 && o.title ? (compact ? 4.8 : 6.2) : (compact ? 4.0 : 5.2)) * k;
              h += step + (m.n - 1) * m.lineH;
              return { ...ln, ind, fu, m, step, fit };
            });
            return { rows, h };
          };
          let k = 1, lay = layoutRows(1);
          while (o.box_h && lay.h > o.box_h + 0.5 && k > 0.72) { k *= 0.93; lay = layoutRows(k); }
          const rows = lay.rows;
          const blockW = o.wrap_w || Math.max(...rows.map(r => r.m.w + r.ind));
          let used = 0, yy = ny;
          for (let li = 0; li < rows.length; li++) {
            const ln = rows[li];
            const f = Math.max(0, Math.min(1, (frac * total - used) / ln.t.length));
            if (f > 0) {
              // Arabic notes are a right-aligned list inside the same block
              const ax = rtl ? nx + blockW - ln.ind : nx + ln.ind;
              drawText(ctx, rnd, ln.t, [ax, yy], ln.fu, color(o.color), f,
                rtl ? "right" : "left", ln.fit, undefined, Math.min(NOTES_WRAP_W, blockMax - ln.ind));
            }
            used += ln.t.length;
            yy += ln.step + (ln.m.n - 1) * ln.m.lineH;
          }
          break;
        }
        case "graph": {
          const [x, y] = o.at || [12, 22], w = o.w || 56, h = o.h || 34;
          const xr = Array.isArray(o.x_range) ? o.x_range : [0, 1];
          const yr = Array.isArray(o.y_range) ? o.y_range : [0, 1];
          const xmin = Number(xr[0]), xmax = Number(xr[1]);
          const ymin = Number(yr[0]), ymax = Number(yr[1]);
          const xspan = Math.max(1e-9, xmax - xmin), yspan = Math.max(1e-9, ymax - ymin);
          const map = p => [
            x + Math.max(0, Math.min(1, (Number(p[0]) - xmin) / xspan)) * w,
            y + h - Math.max(0, Math.min(1, (Number(p[1]) - ymin) / yspan)) * h,
          ];
          const fmt = v => {
            const a = Math.abs(v);
            if ((a >= 10000 || (a > 0 && a < .01))) return v.toExponential(1);
            return String(Math.round(v * 100) / 100);
          };
          const scaffold = Math.min(1, frac / 0.28);
          ctx.save(); ctx.globalAlpha = 0.32;
          for (let i = 1; i < 5; i++) {
            drawLine(ctx, rnd, [x + w * i / 5, y], [x + w * i / 5, y + h], color("gray"), scaffold, W * .35, true);
            drawLine(ctx, rnd, [x, y + h * i / 5], [x + w, y + h * i / 5], color("gray"), scaffold, W * .35, true);
          }
          ctx.restore();
          drawLine(ctx, rnd, [x, y], [x, y + h], color("ink"), scaffold, W);
          drawLine(ctx, rnd, [x, y + h], [x + w, y + h], color("ink"), scaffold, W);
          if (frac > .18) {
            for (let i = 0; i <= 5; i++) {
              const tf = Math.min(1, (frac - .18) / .18);
              drawText(ctx, rnd, fmt(xmin + xspan * i / 5), [x + w * i / 5, y + h + 3], "s", color("gray"), tf, "center");
              if (i % 2 === 0) drawText(ctx, rnd, fmt(ymin + yspan * i / 5), [x - 2, y + h - h * i / 5], "s", color("gray"), tf, "center");
            }
          }
          const series = (o.series || []).slice(0, 4);
          series.forEach((s, si) => {
            const local = Math.max(0, Math.min(1, (frac - .30 - si * .08) / Math.max(.18, .55 - si * .06)));
            const pts = (s.points || []).map(map).map(px);
            if (pts.length >= 2 && local > 0) {
              const smooth = catmullRom(pts).map(p => [p[0] + (rnd() - .5) * .75, p[1] + (rnd() - .5) * .75]);
              strokePts(ctx, smooth, local, color(s.color || "blue"), W * 1.18);
            }
            if (frac > .70 && s.label) {
              const ly = y + 3 + si * 4.2;
              drawLine(ctx, rnd, [x + w - 17, ly], [x + w - 12, ly], color(s.color || "blue"), 1, W * 1.1);
              drawText(ctx, rnd, String(s.label), [x + w - 10, ly], "s", color(s.color || "blue"), (frac - .70) / .30, "left", 12);
            }
          });
          if (frac > .72) {
            for (const m of (o.markers || []).slice(0, 6)) {
              const [mx, my] = px(map(m.at || [xmin, ymin]));
              const rr = Math.max(3, S.scale * .8);
              ctx.beginPath(); ctx.fillStyle = color(m.color || "orange"); ctx.arc(mx, my, rr, 0, Math.PI * 2); ctx.fill();
              if (m.label) drawText(ctx, rnd, String(m.label), [map(m.at)[0] + 2, map(m.at)[1] - 3], "s", color(m.color || "orange"), (frac - .72) / .28, "left");
            }
          }
          if (frac > .82) {
            if (o.title) drawText(ctx, rnd, o.title, [x + w / 2, y - 4], "m", color("ink"), (frac - .82) / .18, "center", w * .75);
            if (o.xlabel) drawText(ctx, rnd, o.xlabel, [x + w / 2, y + h + 7], "s", color("gray"), 1, "center");
            if (o.ylabel) drawText(ctx, rnd, o.ylabel, [x, y - 4], "s", color("gray"), 1, "center");
          }
          break;
        }
        case "axes": {
          const [x, y] = o.at || [16, 22], w = o.w || 46, h = o.h || 32;
          const f1 = Math.min(1, frac / 0.45), f2 = Math.max(0, Math.min(1, (frac - 0.45) / 0.45));
          drawLine(ctx, rnd, [x, y], [x, y + h], color(o.color || "ink"), f1, W);
          if (f1 >= 1) drawArrowHead(ctx, [x, y + h], [x, y], color(o.color || "ink"), W);
          if (f2 > 0) {
            drawLine(ctx, rnd, [x, y + h], [x + w, y + h], color(o.color || "ink"), f2, W);
            if (f2 >= 1) drawArrowHead(ctx, [x, y + h], [x + w, y + h], color(o.color || "ink"), W);
          }
          if (frac > 0.9) {
            if (o.xlabel) drawText(ctx, rnd, o.xlabel, [x + w + 2, y + h], "s", "gray", 1, "left");
            if (o.ylabel) drawText(ctx, rnd, o.ylabel, [x, y - 3], "s", "gray", 1, "center");
          }
          break;
        }
        case "underline": case "highlight": {
          let [x, y] = o.at, w = o.w || 20;
          // the engine sizes the swipe from an ESTIMATE of the text width —
          // measure the actual drawn text and hug it instead
          const t = findTextSpan(ctx, x, y, w);
          if (t) { x = t.x - 0.6; w = t.w + 1.2; }
          const isH = o.op === "highlight";
          const pts = jitterSeg(rnd, x, y, x + w, y, 2);
          const ctx2 = ctx;
          ctx2.save();
          ctx2.globalAlpha = isH ? 0.45 : 1;
          strokePts(ctx2, pts, frac, isH ? HILITE.replace(/[\d.]+\)$/, "1)") : color(o.color || "orange"),
            isH ? lw(3.2) : lw(0.8));
          ctx2.restore();
          break;
        }
        case "dot": {
          const [x, y] = px(o.at);
          const r = Math.max(3, S.scale * 0.9) * Math.min(1, frac * 2);
          ctx.beginPath(); ctx.fillStyle = color(o.color);
          ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          if (o.label && frac > 0.5) {
            const lp2 = o.label_at || [o.at[0] + 2.5, o.at[1] - 2.5];
            drawText(ctx, rnd, o.label, lp2, "s", color(o.color), (frac - 0.5) / 0.5,
              o.label_at ? "center" : "left", LABEL_FIT_W);
          }
          break;
        }
        default: break; // unknown op: skip quietly
      }
    } catch (e) { /* never let one bad op kill the lesson */ }
  }

  // rough time-cost of an op, for scheduling within a step
  function opCost(o) {
    const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    switch (o.op) {
      case "title": return 22 + String(o.text || "").length * 1.6;
      case "text": case "note": return 10 + String(o.text || "").length * 1.4;
      case "line": return 8 + d(o.from || [0, 0], o.to || [0, 0]);
      case "arrow": return 14 + d(o.from || [0, 0], o.to || [0, 0]) + String(o.label || "").length;
      case "callout": return 18 + d(o.around || [0, 0], o.to || o.label_at || [0, 0]) + String(o.label || "").length * 1.2;
      case "box": return 16 + 2 * ((o.w || 22) + (o.h || 10)) + String(o.label || "").length;
      case "ellipse": return 16 + 3.2 * ((o.w || 22) + (o.h || 12)) / 2 + String(o.label || "").length;
      case "curve": { let s = 10; const p = o.points || []; for (let i = 1; i < p.length; i++) s += d(p[i - 1], p[i]); return s; }
      case "polygon": { let s = 14 + String(o.label || "").length + (o.side_labels || []).join("").length; const p = o.points || []; for (let i = 0; i < p.length; i++) s += d(p[i], p[(i + 1) % p.length]); return s; }
      case "notes": { let s = 10 + String(o.title || "").length; (o.lines || []).forEach(t => { s += String(t).length; }); return s * 1.3; }
      case "axes": return 30 + (o.w || 46) + (o.h || 32);
      case "graph": { let s = 90 + (o.w || 56) + (o.h || 34); (o.series || []).forEach(v => { s += (v.points || []).length * 8 + String(v.label || "").length; }); return s; }
      case "underline": case "highlight": return 8 + (o.w || 20);
      case "dot": return 8;
      case "clear": return 6;
      default: return 8;
    }
  }

  // find the baked text op a highlight/underline belongs to, with its
  // true rendered span in board units
  function findTextSpan(ctx, hx, hy, hw) {
    let best = null;
    for (const it of S.bakedOps) {
      const cand = (it && typeof it.op === "object") ? it.op : it;
      const t = (cand && cand.op === "text") ? cand : null;
      if (!t || !t.at || !t.text) continue;
      const dy = Math.abs(t.at[1] - hy);
      if (dy > 3.6) continue;
      ctx.save();
      const bpx = fontPx(t.size || "m");
      const arabic = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(t.text);
      ctx.font = arabic ? `600 ${bpx}px Tahoma, Arial, sans-serif`
                        : `600 ${bpx}px Caveat, "Comic Sans MS", cursive`;
      const spaceW = ctx.measureText(" ").width;
      let wpx = 0;
      const wordsArr = String(t.text).split(" ");
      wordsArr.forEach((word, wi) => {
        for (const seg of parseSupers(word)) {
          ctx.font = arabic ? `600 ${(seg.sup ? 0.62 : 1) * bpx}px Tahoma, Arial, sans-serif`
                            : `600 ${(seg.sup ? 0.62 : 1) * bpx}px Caveat, "Comic Sans MS", cursive`;
          wpx += ctx.measureText(seg.t).width;
        }
        if (wi < wordsArr.length - 1) wpx += spaceW;
      });
      ctx.restore();
      const wu = Math.min(wpx / S.scale, 52);
      const left = (t.align === "center") ? t.at[0] - wu / 2 : t.at[0];
      const overlap = Math.min(hx + hw, left + wu) - Math.max(hx, left);
      if (overlap < Math.min(hw, wu) * 0.4) continue;
      const score = dy + Math.abs(left - hx) * 0.15;
      if (!best || score < best.score) best = { x: left, w: wu, score };
    }
    return best;
  }

  // ---------- canvas plumbing ----------
  function fitCanvases() {
    const r = S.wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    [S.agentCv, S.liveCv, S.userCv].forEach(cv => {
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    S.scale = Math.min(r.width / LOGICAL_W, r.height / LOGICAL_H);
    S.offX = (r.width - LOGICAL_W * S.scale) / 2;
    S.offY = (r.height - LOGICAL_H * S.scale) / 2;
    redrawBaked(); redrawUser();
  }

  function redrawBaked() {
    const ctx = S.agentCv.getContext("2d");
    ctx.clearRect(0, 0, S.agentCv.width, S.agentCv.height);
    for (const item of S.bakedOps) renderOp(ctx, item, 1);
  }

  function redrawUser() {
    const ctx = S.userCv.getContext("2d");
    ctx.clearRect(0, 0, S.userCv.width, S.userCv.height);
    for (const st of S.userStrokes) {
      if (st.shape) { drawUserShape(ctx, st); continue; }
      ctx.save();
      if (st.eraser) ctx.globalCompositeOperation = "destination-out";
      strokePts(ctx, st.pts.map(px), 1, st.eraser ? "#000" : st.color, lw(st.eraser ? 2.4 : st.size));
      ctx.restore();
    }
  }

  function bake(item) { S.bakedOps.push(item); renderOp(S.agentCv.getContext("2d"), item, 1); }

  function clearAgent() {
    S.bakedOps = [];
    S.agentCv.getContext("2d").clearRect(0, 0, S.agentCv.width, S.agentCv.height);
    S.liveCv.getContext("2d").clearRect(0, 0, S.liveCv.width, S.liveCv.height);
  }

  function eraseAgent(targets) {
    const ids = new Set((targets || []).map(String));
    if (!ids.size) return;
    S.bakedOps = S.bakedOps.filter(item => !ids.has(String(item?.op?.id || "")));
    S.liveCv.getContext("2d").clearRect(0, 0, S.liveCv.width, S.liveCv.height);
    redrawBaked();
  }

  // ---------- audio ----------
  function actx() {
    if (!S.actx) S.actx = new (window.AudioContext || window.webkitAudioContext)();
    if (S.actx.state === "suspended") S.actx.resume();
    return S.actx;
  }

  function b64ToBuf(b64) {
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr.buffer;
  }

  function loadStepAudio(step) {
    if (step._bufP) return step._bufP;
    if (step.audio_url) {
      step._bufP = fetch(step.audio_url, { cache: "force-cache" })
        .then(response => {
          if (!response.ok) throw new Error(`audio request failed (${response.status})`);
          return response.arrayBuffer();
        })
        .then(buffer => actx().decodeAudioData(buffer))
        .catch(error => { console.warn("[tutori] saved lesson audio failed", error); return null; });
    } else if (step.audio) {
      try { step._bufP = actx().decodeAudioData(b64ToBuf(step.audio)).catch(() => null); }
      catch (error) { step._bufP = Promise.resolve(null); }
    }
    return step._bufP || Promise.resolve(null);
  }

  // ---------- lesson playback ----------
  async function playStep(step) {
    const ops = (step.board || []).map(o => ({ op: o, seed: (S.opSeedCounter++ * 2654435761) >>> 0 }));
    let dur = step.dur || Math.max(2.2, String(step.say || "").split(/\s+/).length * 0.36);
    let src = null;
    let audioEnded = true;   // true while there is no source; set false when one starts

    if ((step.audio || step.audio_url) && S.voiceOn) {
      try {
        // audio was pre-decoded the moment the step arrived (see enqueue)
        const buf = await loadStepAudio(step);
        if (buf) {
          dur = buf.duration;
          src = actx().createBufferSource();
          src.buffer = buf;
          src.connect(actx().destination);
          audioEnded = false;
          src.onended = () => { audioEnded = true; };  // the ONLY reliable end signal
        }
      } catch (e) { src = null; }
    }

    if (!src && S.voiceOn && step.say) {
      setStatus("صوت الذكاء الاصطناعي غير متاح لهذا الجزء", "teaching");
    }

    await waitWhilePaused();
    setCaption(step.say || "");

    // Clear and targeted erase are agent actions, not drawable marks.
    for (const item of ops) {
      if (item.op.op === "clear") clearAgent();
      if (item.op.op === "erase") eraseAgent(item.op.targets || [item.op.target]);
    }
    const drawable = ops.filter(x => !["clear", "erase"].includes(x.op.op));

    const total = drawable.reduce((s, x) => s + opCost(x.op), 0) || 1;
    let t0 = 0;
    // Keep canvas drawing brisk and independent of long narration clips.
    // Speech continues while the complete visual is drawn in a few seconds.
    const budget = Math.min(8, Math.max(2.5, drawable.length * 0.65));
    const sched = drawable.map(x => {
      const span = Math.max(0.22, (opCost(x.op) / total) * budget);
      const item = { ...x, start: t0, end: t0 + span };
      t0 += span;
      return item;
    });

    let elapsed = 0;
    let lastTick = performance.now();
    if (src) src.start();

    await new Promise(resolve => {
      let bakedIdx = 0;
      const tick = () => {
        const now = performance.now();
        if (!S.paused) elapsed += (now - lastTick) / 1000;
        lastTick = now;
        const el = elapsed;
        const live = S.liveCv.getContext("2d");
        if (!S.paused) live.clearRect(0, 0, S.liveCv.width, S.liveCv.height);
        if (S.paused) {
          S.raf = requestAnimationFrame(tick);
          return;
        }
        for (let i = bakedIdx; i < sched.length; i++) {
          const it = sched[i];
          if (el >= it.end) { bake(it); bakedIdx = i + 1; continue; }
          if (el >= it.start) {
            renderOp(live, it, (el - it.start) / (it.end - it.start));
          }
        }
        // wait for the audio's real `ended` event — clock estimates start the
        // next clip while this one's tail is still audible (voices overlap).
        // el > dur + 2 is only a safety net if `ended` never fires.
        const audioDone = src ? (audioEnded || el > dur + 2.0) : el > dur;
        if (bakedIdx >= sched.length && audioDone) {
          live.clearRect(0, 0, S.liveCv.width, S.liveCv.height);
          setTimeout(resolve, 140);   // natural breath between steps
        } else if (S.stopFlag) {
          try { src && src.stop(); } catch (e) {}
          if (S.curTurn !== S.killTurn) {
            // bake the remainder instantly so the board ends complete —
            // but NOT when the turn was abandoned via "New lesson"
            for (let i = bakedIdx; i < sched.length; i++) bake(sched[i]);
          }
          live.clearRect(0, 0, S.liveCv.width, S.liveCv.height);
          resolve();
        } else {
          S.raf = requestAnimationFrame(tick);
        }
      };
      S.raf = requestAnimationFrame(tick);
    });
  }

  function setHeaderStatus(text) {
    const el = document.getElementById("tutori-live-status");
    if (el) el.textContent = text;
  }

  function finishPlayback() {
    setCaption("");
    if (S.completionText.includes("المحاضرة")) {
      S.lectureCompleted = true;
      setHeaderStatus("✓ اكتملت المحاضرة");
      updateLectureButton();
    } else {
      setHeaderStatus("● المحاضر جاهز");
    }
    setStatus(S.completionText || "انتهى الشرح ✓", "done");
  }

  async function pump() {
    if (S.playing) return;
    if (S.stopFlag) { setTimeout(pump, 90); return; }  // wait out the stop window
    S.playing = true;
    setTalking(true);
    setHeaderStatus("🔊 المحاضرة تعمل");
    while (S.queue.length) {
      if (S.stopFlag) break;
      const step = S.queue.shift();
      await playStep(step);
    }
    S.playing = false;
    setTalking(false);
    if (S.queue.length) setTimeout(pump, 120);         // interrupted mid-queue: retry
    else {
      if (S.serverDone) finishPlayback();
      else setCaption("");
    }
  }

  function waitWhilePaused() {
    return new Promise(resolve => {
      const check = () => S.paused ? setTimeout(check, 100) : resolve();
      check();
    });
  }

  function setPaused(paused) {
    S.paused = !!paused;
    updateLectureButton();
    if (S.actx) {
      const action = S.paused ? S.actx.suspend() : S.actx.resume();
      action.catch(() => {});
    }
    setStatus(S.paused ? "المحاضرة متوقفة مؤقتًا · يمكنك كتابة سؤال أو تسجيله" : "", S.paused ? "paused" : "idle");
    setHeaderStatus(S.paused ? "⏸ المحاضرة متوقفة مؤقتًا" :
      S.lectureCompleted ? "✓ اكتملت المحاضرة" :
      S.lectureStarted ? "🔊 المحاضرة تعمل" : "● المحاضر جاهز");
    return S.paused;
  }

  function updateLectureButton() {
    const button = document.querySelector("#demo-start-lecture-btn button") ||
      document.querySelector("#demo-start-lecture-btn");
    const replay = document.getElementById("replay-btn");
    if (replay) replay.style.display = S.lectureStarted ? "block" : "none";
    if (button) {
      button.textContent = S.lectureCompleted ? "✓ اكتملت المحاضرة · إعادة التشغيل" :
        !S.lectureStarted ? "ابدأ المحاضرة ▶" :
        S.paused ? "▶ استئناف المحاضرة" : "⏸ إيقاف مؤقت";
      button.setAttribute("aria-pressed", String(S.paused));
      button.classList.toggle("is-paused", S.paused);
    }
  }

  window.tutoriTogglePause = () => setPaused(!S.paused);
  document.addEventListener("click", event => {
    const startButton = event.target.closest?.("#demo-start-lecture-btn button, button#demo-start-lecture-btn");
    if (!startButton) return;
    if (S.lectureCompleted) {
      S.lectureCompleted = false;
      S.lectureStarted = false;
    }
    if (!S.lectureStarted) {
      S.lectureStarted = true;
      setHeaderStatus("⏳ جاري بدء المحاضرة");
      updateLectureButton();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    setPaused(!S.paused);
  }, true);
  window.tutoriResetLectureControls = () => {
    S.lectureStarted = false;
    S.lectureCompleted = false;
    setHeaderStatus("● المحاضر جاهز");
    if (S.paused) setPaused(false);
    else updateLectureButton();
  };

  // ---------- public API ----------
  function setBoardBig(on) {
    document.body.classList.toggle("board-big", !!on);
    const row = document.querySelector(".board-col")?.parentElement;
    if (row) row.classList.toggle("board-big", !!on);
  }

  function keepBoardInView() {
    if (Date.now() > S.keepBoardUntil) return;
    const shell = document.querySelector(".board-shell");
    const actions = document.querySelector(".board-actions");
    if (!shell) return;
    const r = shell.getBoundingClientRect();
    const bottom = actions ? actions.getBoundingClientRect().bottom : r.bottom;
    // Only fight automatic scroll when the board can actually fit.
    if (r.height + 48 > window.innerHeight) return;
    if (r.top < 8 || bottom > window.innerHeight - 8) {
      window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 8), left: 0, behavior: "auto" });
    }
  }

  // The guard below exists to undo Gradio's AUTOMATIC scrolls (focus jumps
  // after submit, chat updates). A scroll the learner makes themselves must
  // win: when the page scrolls right after a wheel / touch / scroll key /
  // scrollbar press, the page is handed back for the rest of this lesson
  // instead of being yanked to the board. (A wheel over the chat log that
  // only scrolls the log does not move the page, so it changes nothing.)
  let userScrollIntentAt = 0;
  const markIntent = () => { userScrollIntentAt = Date.now(); };
  const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  window.addEventListener("wheel", markIntent, { passive: true });
  window.addEventListener("touchmove", markIntent, { passive: true });
  window.addEventListener("keydown", (e) => {
    const t = e.target;   // typing in the question box is not scrolling
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (SCROLL_KEYS.has(e.key)) markIntent();
  });
  window.addEventListener("mousedown", (e) => {
    // a press on the page scrollbar (outside the document's client area)
    if (e.clientX >= document.documentElement.clientWidth ||
        e.clientY >= document.documentElement.clientHeight) markIntent();
  });

  window.addEventListener("scroll", () => {
    if (Date.now() > S.keepBoardUntil) return;
    if (Date.now() - userScrollIntentAt < 1000) {
      S.keepBoardUntil = 0;            // the learner is scrolling: let go
      clearTimeout(S.scrollTid);
      return;
    }
    clearTimeout(S.scrollTid);
    S.scrollTid = setTimeout(keepBoardInView, 45);
  }, { passive: true });

  window.tutoriOnPayload = (raw) => {
    if (!raw) return;
    let p;
    try { p = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!S.mounted) { setTimeout(() => window.tutoriOnPayload(raw), 300); return; }
    if (p.turn && p.turn === S.killTurn) return; // cancelled via "New lesson"

    if (p.turn && p.turn !== S.curTurn) {        // a new turn begins
      const isFirstTurn = !S.curTurn;
      S.lectureCompleted = false;
      S.lectureStarted = true;
      updateLectureButton();
      if (S.paused && !isFirstTurn) setPaused(false);
      S.curTurn = p.turn;
      S.enqueued = 0;
      S.serverDone = false;
      S.stopFlag = true;                          // fast-forward whatever is playing
      setTimeout(() => { S.stopFlag = false; }, 50);
      S.queue = [];
      // Gradio may focus the transcript/input after submit, which scrolls the
      // board header out of view right as drawing begins. Keep the whole board
      // visible for the teaching part of the turn.
      S.keepBoardUntil = Date.now() + 11 * 60 * 1000;
      requestAnimationFrame(keepBoardInView);
    }
    S.voiceOn = p.voice !== false;
    if (p.completion_text) S.completionText = p.completion_text;
    // the agent asks for a bigger stage when the lesson is drawing-heavy
    if (p.big !== undefined) setBoardBig(!!p.big);
    if (p.status_detail !== undefined) setStatus(p.status_detail, p.status);
    for (const s of (p.steps || [])) {        // incremental: each step carries its index
      const idx = (s.i !== undefined) ? s.i : S.enqueued;
      if (idx >= S.enqueued) {
        if ((s.audio || s.audio_url) && S.voiceOn) { // load audio without bloating the lesson payload
          loadStepAudio(s);
        }
        S.queue.push(s);
        S.enqueued = idx + 1;
      }
    }
    if (S.queue.length) setTimeout(pump, 30);
    if (p.status === "done" || p.status === "error") {
      S.serverDone = p.status === "done";
      if (p.status === "error") {
        setTimeout(() => setStatus("", "idle"), 6000);
      } else if (!S.playing && !S.queue.length) {
        finishPlayback();
      }
    }
  };

  window.tutoriSnapshot = () => {
    if (!S.mounted) return "";
    const r = S.wrap.getBoundingClientRect();
    const out = document.createElement("canvas");
    const scl = Math.min(1, 1100 / r.width);
    out.width = Math.round(r.width * scl); out.height = Math.round(r.height * scl);
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#FBF8F1"; ctx.fillRect(0, 0, out.width, out.height);
    [S.agentCv, S.liveCv, S.userCv].forEach(cv =>
      ctx.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, out.width, out.height));
    return out.toDataURL("image/png");
  };

  window.tutoriStop = () => {
    S.stopFlag = true; S.queue = [];
    setTimeout(() => { S.stopFlag = false; }, 60);
  };

  // Snapshot only when the learner has actually drawn something (saves vision tokens).
  window.tutoriSnapshotIfInk = () =>
    (S.mounted && S.userStrokes.length ? window.tutoriSnapshot() : "");

  window.tutoriClearAll = () => {
    setBoardBig(false);
    window.tutoriResetLectureControls();
    if (!S.mounted) return;
    S.killTurn = S.curTurn;   // silence stragglers + suppress the stop-bake
    window.tutoriStop();
    S.userStrokes = [];
    redrawUser();
    clearAgent();
    setCaption("");
    setStatus("", "idle");
    setTimeout(clearAgent, 280);  // belt-and-braces against repaint races
  };

  // ---------- UI chrome ----------
  function setCaption(text) {
    const el = document.getElementById("tutori-caption");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("show", !!text);
  }

  function setStatus(text, mode) {
    const el = document.getElementById("tutori-status");
    if (!el) return;
    el.textContent = text || "";
    el.dataset.mode = mode || "idle";
    el.classList.toggle("show", !!text);
  }

  function setTalking(on) {
    const dot = document.getElementById("tutori-talking");
    if (dot) dot.classList.toggle("on", on);
  }

  // ---------- user pen ----------
  function toLogical(ev) {
    const r = S.userCv.getBoundingClientRect();
    return [
      ((ev.clientX - r.left) - S.offX) / S.scale,
      ((ev.clientY - r.top) - S.offY) / S.scale,
    ];
  }

  function bindPen() {
    let cur = null;
    S.userCv.addEventListener("pointerdown", ev => {
      actx();
      S.userCv.setPointerCapture(ev.pointerId);
      const p = toLogical(ev);
      const shape = ["line", "rect", "ellipse"].includes(S.tool.mode) ? S.tool.mode : null;
      cur = shape
        ? { color: S.tool.color, size: S.tool.size, shape, a: p, b: p }
        : { color: S.tool.color, size: S.tool.size,
            eraser: S.tool.mode === "eraser", pts: [p] };
      S.userStrokes.push(cur);
      S.redoStack = [];               // a new mark ends the redo history
    });
    S.userCv.addEventListener("pointermove", ev => {
      if (!cur) return;
      if (cur.shape) cur.b = toLogical(ev);
      else cur.pts.push(toLogical(ev));
      redrawUser();
    });
    const up = () => {
      // a click without a drag leaves a zero-size shape: drop it
      if (cur?.shape && Math.hypot(cur.b[0] - cur.a[0], cur.b[1] - cur.a[1]) < 0.8) {
        S.userStrokes.pop(); redrawUser();
      }
      cur = null;
    };
    S.userCv.addEventListener("pointerup", up);
    S.userCv.addEventListener("pointercancel", up);
  }

  // Learner shapes keep exact geometry (straight edges, real ellipse)
  // instead of the smoothed freehand path.
  function drawUserShape(ctx, st) {
    const [ax, ay] = px(st.a), [bx, by] = px(st.b);
    ctx.save();
    ctx.strokeStyle = st.color; ctx.lineWidth = lw(st.size);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    if (st.shape === "line") { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
    else if (st.shape === "rect") ctx.rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    else ctx.ellipse((ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) / 2, Math.abs(by - ay) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const PEN_COLORS = ["#2563eb", "#dc2626", "#15803d", "#27272a", "#7c3aed"];

  // 20px line icons (stroke = currentColor) for the board toolbar
  const ICON = (d) => `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    pen: ICON('<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/><path d="M14 7l3 3"/>'),
    eraser: ICON('<path d="M8 20h12"/><path d="M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H8.5z"/><path d="M9 11l5 5"/>'),
    line: ICON('<path d="M5 19L19 5"/>'),
    rect: ICON('<rect x="4.5" y="6" width="15" height="12" rx="1.5"/>'),
    ellipse: ICON('<circle cx="12" cy="12" r="7.5"/>'),
    undo: ICON('<path d="M9 7L5 11l4 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-2"/>'),
    redo: ICON('<path d="M15 7l4 4-4 4"/><path d="M19 11h-9a5 5 0 0 0 0 10h2"/>'),
    trash: ICON('<path d="M5 7h14"/><path d="M10 11v6M14 11v6"/><path d="M7 7l1 12h8l1-12"/><path d="M10 7V5h4v2"/>'),
    board: ICON('<rect x="3.5" y="4.5" width="17" height="12" rx="1.5"/><path d="M12 16.5V20M8.5 20h7"/><path d="M7.5 12l3-3 2 2 4-4"/>'),
  };

  function toolbarHTML() {
    const sw = PEN_COLORS.map(c =>
      `<button class="tb-swatch" data-color="${c}" style="--c:${c}" title="لون القلم" aria-label="لون القلم"></button>`).join("");
    const tool = (mode, title) =>
      `<button class="tb-btn tb-icon tb-tool" data-mode="${mode}" title="${title}" aria-label="${title}">${ICONS[mode]}</button>`;
    return `
      <div class="tb-title">${ICONS.board}<span class="talk-label">السبورة التفاعلية</span><span id="tutori-talking" class="talk-dot" title="المدرب يتحدث"></span></div>
      <div class="tb-spacer"></div>
      <div class="tb-group">
        <button class="tb-btn tb-icon" id="tb-undo" title="تراجع" aria-label="تراجع">${ICONS.undo}</button>
        <button class="tb-btn tb-icon" id="tb-redo" title="إعادة" aria-label="إعادة">${ICONS.redo}</button>
        <button class="tb-btn tb-icon" id="tb-clear-mine" title="مسح رسوماتي" aria-label="مسح رسوماتي">${ICONS.trash}</button>
        <button class="tb-btn tb-text" id="tb-clear-all" title="مسح السبورة بالكامل">مسح الكل</button>
      </div>
      <div class="tb-sep"></div>
      <div class="tb-group">
        ${tool("pen", "قلم")}${tool("eraser", "ممحاة")}${tool("line", "خط مستقيم")}${tool("rect", "مستطيل")}${tool("ellipse", "دائرة")}
      </div>
      <div class="tb-sep"></div>
      <div class="tb-group">${sw}</div>`;
  }

  function bindToolbar(bar) {
    S.redoStack = [];
    const setActive = () => {
      bar.querySelectorAll(".tb-tool").forEach(b => b.classList.toggle("active", b.dataset.mode === S.tool.mode));
      bar.querySelectorAll(".tb-swatch").forEach(b =>
        b.classList.toggle("active", S.tool.mode !== "eraser" && b.dataset.color === S.tool.color));
    };
    bar.querySelectorAll(".tb-swatch").forEach(b => {
      b.addEventListener("click", () => {
        S.tool.color = b.dataset.color;
        if (S.tool.mode === "eraser") S.tool.mode = "pen";   // a colour means drawing
        setActive();
      });
    });
    bar.querySelectorAll(".tb-tool").forEach(b => {
      b.addEventListener("click", () => { S.tool.mode = b.dataset.mode; setActive(); });
    });
    S.tool.mode = "pen";
    setActive();
    bar.querySelector("#tb-undo").addEventListener("click", () => {
      const st = S.userStrokes.pop();
      if (st) S.redoStack.push(st);
      redrawUser();
    });
    bar.querySelector("#tb-redo").addEventListener("click", () => {
      const st = S.redoStack.pop();
      if (st) S.userStrokes.push(st);
      redrawUser();
    });
    bar.querySelector("#tb-clear-mine").addEventListener("click", () => {
      S.userStrokes = []; S.redoStack = []; redrawUser();
    });
    bar.querySelector("#tb-clear-all").addEventListener("click", () => {
      S.userStrokes = []; S.redoStack = []; redrawUser(); clearAgent(); setCaption("");
    });
  }

  // ---------- mount ----------
  function mount() {
    const host = document.getElementById("tutori-board-mount");
    if (!host || S.mounted) return;
    S.mounted = true;
    host.innerHTML = `
      <div class="board-shell">
        <div class="board-toolbar" id="tutori-toolbar">${toolbarHTML()}</div>
        <div class="board-wrap" id="tutori-wrap">
          <canvas id="cv-agent"></canvas>
          <canvas id="cv-live"></canvas>
          <canvas id="cv-user"></canvas>
          <div class="board-status" id="tutori-status"></div>
        </div>
        <div class="board-caption" id="tutori-caption"></div>
      </div>`;
    S.wrap = host.querySelector("#tutori-wrap");
    S.agentCv = host.querySelector("#cv-agent");
    S.liveCv = host.querySelector("#cv-live");
    S.userCv = host.querySelector("#cv-user");
    bindToolbar(host.querySelector("#tutori-toolbar"));
    updateLectureButton();
    bindPen();
    fitCanvases();
    new ResizeObserver(fitCanvases).observe(S.wrap);
    // Prime cloud-audio playback after the control's own click handler runs.
    // A capture-phase pointer handler can interfere with Gradio button clicks.
    document.addEventListener("click", () => actx(), { once: true, passive: true });
    const primeOnEnter = event => {
      if (event.key !== "Enter") return;
      actx();
      document.removeEventListener("keydown", primeOnEnter);
    };
    document.addEventListener("keydown", primeOnEnter);
  }

  // Gradio can ignore its native Textbox.submit event while another queued
  // lesson is streaming. Route Enter through the Send button instead, which
  // is an independent, unqueued acknowledgement path.
  function bindSubmissionBridge() {
    if (window.__tutoriSubmissionBridge) return;
    window.__tutoriSubmissionBridge = true;

    const typedInput = () => document.querySelector(
      '#lesson-question textarea'
    );
    const sendButton = () => {
      const node = document.querySelector("#send-btn");
      return node?.matches("button") ? node : node?.querySelector("button");
    };
    document.addEventListener("keydown", event => {
      const input = typedInput();
      if (event.key !== "Enter" || event.shiftKey || event.isComposing ||
          !input || event.target !== input) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      actx();
      sendButton()?.click();
    }, true);
  }

  bindSubmissionBridge();

  // ---------- asking a question: voice recorder + pause-on-ask ----------
  // One button: first press starts recording (and pauses the lecture right
  // away), second press sends. The recording travels to the server as a
  // data URL through a hidden Gradio textbox + button (see app.py).
  function bindAskControls() {
    if (window.__tutoriAskControls) return;
    window.__tutoriAskControls = true;
    const R = { rec: null, chunks: [], stream: null, startedAt: 0, tick: 0,
                cancelled: false, mime: "" };
    const MAX_SECONDS = 60;
    const micBtn = () => document.getElementById("tutori-mic");
    function setAskStatus(text, kind) {
      const el = document.getElementById("tutori-ask-status");
      if (!el) return;
      el.textContent = text;
      el.dataset.kind = kind || "";
    }
    function setMicUi(state) {
      const b = micBtn();
      if (!b) return;
      b.classList.toggle("is-recording", state === "recording");
      b.classList.toggle("is-busy", state === "sending");
      b.disabled = state === "sending";
      document.querySelectorAll("[data-mic]").forEach(m =>
        m.classList.toggle("is-recording", state === "recording"));
      const label = b.querySelector(".ask-mic-label");
      if (label) label.textContent = state === "recording" ? "إرسال التسجيل"
        : state === "sending" ? "جارٍ الإرسال…" : "سجّل سؤالك";
    }
    // The learner starts asking: hold the lecture where it is.
    function pauseForQuestion() {
      if (S.lectureStarted && !S.lectureCompleted && !S.paused) setPaused(true);
    }
    function pickMime() {
      if (!window.MediaRecorder) return "";
      return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
        .find(t => MediaRecorder.isTypeSupported?.(t)) || "";
    }
    function stopTracks() {
      R.stream?.getTracks().forEach(t => t.stop());
      R.stream = null;
      clearInterval(R.tick);
    }
    function sendRecording(dataUrl) {
      const sink = document.querySelector("#tutori-voice-sink textarea, #tutori-voice-sink input");
      const node = document.getElementById("tutori-voice-send");
      const button = node?.matches("button") ? node : node?.querySelector("button");
      if (!sink || !button) {
        setAskStatus("تعذّر إرسال التسجيل. حدّث الصفحة وحاول مرة أخرى.", "error");
        setMicUi("idle");
        return;
      }
      const proto = sink.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(sink, dataUrl);
      sink.dispatchEvent(new Event("input", { bubbles: true }));
      // let Gradio take the new value before the click reads it
      setTimeout(() => {
        button.click();
        setAskStatus("تم إرسال سؤالك… المدرب يجهّز الإجابة.", "sent");
        setMicUi("idle");
      }, 80);
    }
    async function startRecording() {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setAskStatus("المتصفح لا يدعم التسجيل الصوتي. اكتب سؤالك بدلًا من ذلك.", "error");
        return;
      }
      pauseForQuestion();            // stop talking the moment they want to talk
      actx();
      try {
        R.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        setAskStatus("لم نتمكن من استخدام الميكروفون. اسمح للمتصفح باستخدامه ثم حاول مرة أخرى.", "error");
        return;
      }
      R.mime = pickMime();
      R.chunks = [];
      R.cancelled = false;
      R.rec = new MediaRecorder(R.stream, R.mime ? { mimeType: R.mime } : undefined);
      R.rec.ondataavailable = e => { if (e.data && e.data.size) R.chunks.push(e.data); };
      R.rec.onstop = () => {
        const seconds = (Date.now() - R.startedAt) / 1000;
        stopTracks();
        const rec = R.rec; R.rec = null;
        if (R.cancelled) { setAskStatus("تم إلغاء التسجيل.", ""); setMicUi("idle"); return; }
        if (seconds < 0.8 || !R.chunks.length) {
          setAskStatus("التسجيل قصير جدًا. اضغط وتكلّم ثم اضغط مرة أخرى للإرسال.", "error");
          setMicUi("idle");
          return;
        }
        setMicUi("sending");
        const blob = new Blob(R.chunks, { type: rec?.mimeType || R.mime || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => sendRecording(String(reader.result || ""));
        reader.onerror = () => { setAskStatus("تعذّر قراءة التسجيل. حاول مرة أخرى.", "error"); setMicUi("idle"); };
        reader.readAsDataURL(blob);
      };
      R.rec.start(250);
      R.startedAt = Date.now();
      setMicUi("recording");
      const showTime = () => {
        const s = Math.floor((Date.now() - R.startedAt) / 1000);
        setAskStatus(`● جارٍ التسجيل ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} · ` +
          "اضغط «إرسال التسجيل» عند الانتهاء، أو Esc للإلغاء.", "recording");
        if (s >= MAX_SECONDS) R.rec?.state === "recording" && R.rec.stop();
      };
      showTime();
      R.tick = setInterval(showTime, 500);
    }

    document.addEventListener("click", e => {
      // «سجّل سؤالك» and the small mic inside the question box
      const b = e.target.closest?.("#tutori-mic, [data-mic]");
      if (!b || micBtn()?.disabled) return;
      e.preventDefault();
      if (R.rec && R.rec.state === "recording") R.rec.stop();
      else startRecording();
    });

    // ---- lecture action tiles ----
    function askTutor(text) {
      const input = document.querySelector("#lesson-question textarea");
      const node = document.getElementById("send-btn");
      const send = node?.matches("button") ? node : node?.querySelector("button");
      if (!input || !send) return;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      setTimeout(() => send.click(), 80);       // same path as typing + «إرسال»
    }
    function lectureLog() {
      return [...document.querySelectorAll("#tutori-chat .message")]
        .map(m => ({ user: !!m.closest(".user, [data-testid='user']"), text: m.innerText.trim() }))
        .filter(m => m.text);
    }
    function exportWord() {
      const log = lectureLog();
      if (!log.length) {
        setAskStatus("لا يوجد محتوى للتصدير بعد. ابدأ المحاضرة أو اطرح سؤالًا أولًا.", "error");
        return;
      }
      const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      const title = document.querySelector("#tutori-header .tag")?.textContent?.trim() || "محاضرة المدرب الرقمي";
      const body = log.map(m => `<p class="${m.user ? "q" : "a"}"><b>${m.user ? "سؤال المتدرب" : "المدرب"}:</b> ${esc(m.text).replace(/\n/g, "<br>")}</p>`).join("");
      // Word opens an HTML document saved as .doc, right-to-left intact
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{direction:rtl;font-family:Tahoma,Arial;font-size:13pt;line-height:1.7}h1{font-size:18pt}.q{color:#1e3a8a}</style></head><body dir="rtl"><h1>${esc(title)}</h1>${body}</body></html>`;
      const url = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "محاضرة-المدرب-الرقمي.doc" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setAskStatus("تم تصدير سجل المحاضرة إلى ملف Word.", "sent");
    }
    async function shareLink() {
      const url = location.origin + location.pathname;
      try {
        await navigator.clipboard.writeText(url);
        setAskStatus("تم نسخ رابط القاعة. أرسله للمتدربين.", "sent");
      } catch (err) {
        setAskStatus(`انسخ الرابط وأرسله للمتدربين: ${url}`, "");
      }
    }
    document.addEventListener("click", e => {
      const tile = e.target.closest?.(".action-tile");
      if (!tile) return;
      e.preventDefault();
      if (tile.dataset.ask) askTutor(tile.dataset.ask);
      else if (tile.dataset.action === "share") shareLink();
      else if (tile.dataset.action === "export") exportWord();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && R.rec && R.rec.state === "recording") {
        R.cancelled = true;
        R.rec.stop();
      }
    });
    // Typing a question is asking too: pause as soon as the first character
    // lands in an empty box (not on every keystroke, so they can resume).
    document.addEventListener("input", e => {
      const t = e.target;
      if (!t?.closest?.("#lesson-question")) return;
      if (t.value && t.value.trim().length === 1) pauseForQuestion();
    }, true);
  }
  bindAskControls();

  // Gradio renders the DOM asynchronously; retry until the mount node exists.
  const tryMount = setInterval(() => {
    mount();
    if (S.mounted) clearInterval(tryMount);
  }, 200);
  if (document.readyState !== "loading") setTimeout(mount, 0);

  // study-coach chips: pop animation when their labels change
  function watchChips() {
    const row = document.querySelector(".chip-row");
    if (!row) { setTimeout(watchChips, 600); return; }
    // tag accordion blocks (gradio strips :has() from custom css) — and keep
    // tagging as gradio mounts/replaces them
    const tagFolders = () => {
      document.querySelectorAll(".side-col button.label-wrap").forEach(b => {
        const blk = b.closest(".block");
        if (blk) blk.classList.add("paper-folder");
      });
    };
    tagFolders();
    new MutationObserver(tagFolders).observe(document.body,
      { childList: true, subtree: true });
    row.querySelectorAll("button").forEach(btn => {
      new MutationObserver(() => {
        btn.classList.remove("chip-pop");
        void btn.offsetWidth;            // restart the animation
        btn.classList.add("chip-pop");
      }).observe(btn, { childList: true, characterData: true, subtree: true });
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchChips);
  } else { watchChips(); }

})();
