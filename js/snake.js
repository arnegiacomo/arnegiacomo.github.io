/* Easter egg: left or right pulls the hero chips into a snake, arrow keys steer,
   eating a mark appends it to the tail, a viewport edge ends the run. Clear the
   board and the whole snake gathers into a ring, spins, and bursts apart.

   Segments are the real chip elements. Motion is continuous, not grid-stepped:
   the head records a path and each segment sits a fixed arc length back. */
(() => {
  const chips = [...document.querySelectorAll('.portrait-wrap .chip')];
  const portrait = document.getElementById('portrait');
  if (!chips.length || !portrait) return;

  const SPEED = 360;        // px per second
  const GAP = 1.06;         // segment spacing, as a share of chip size
  const WIGGLE = 4;         // degrees of slither
  const FORM_MS = 380;
  const DEAD_MS = 620;
  const HOME_MS = 480;
  const RING_MS = 520;      // gather into the ring
  const SPIN_MS = 1700;
  const BURST_MS = 620;

  const DIRS = {
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0],
    ArrowUp: [0, -1], w: [0, -1],
    ArrowDown: [0, 1], s: [0, 1],
  };

  // Letters come through as single characters, so caps lock can't matter.
  const keyOf = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

  // Needs #i-<id> in assets/snake-icons.svg and .b-<id> in css/style.css.
  // The hero chips are the starting snake, so they aren't here.
  const FOOD = ['python', 'quarkus', 'pg', 'docker', 'linux', 'grafana', 'bun',
    'node', 'rust', 'hono', 'maven', 'gradle', 'gha', 'bitbucket', 'bash',
    'github', 'git', 'js', 'html', 'css', 'otel', 'arduino', 'esp', 'nginx',
    'keycloak', 'helm'];

  // 45kB nobody who doesn't play needs. A failed fetch still plays, blank.
  let sheet = null;

  function loadSheet() {
    sheet ??= fetch('assets/snake-icons.svg')
      .then(r => r.text())
      .then(svg => document.body.insertAdjacentHTML('afterbegin', svg))
      .catch(() => {});
    return sheet;
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let game = null;

  const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));

  function place(el, x, y, deg) {
    el.style.transform = `translate(${x}px, ${y}px) rotate(${deg}deg)`;
  }

  // Document coordinates, so the trip home survives a mid-run scroll.
  function capture(el) {
    const box = el.getBoundingClientRect();
    return {
      el,
      size: el.offsetWidth,
      parent: el.parentNode,
      next: el.nextSibling,
      tilt: parseFloat(getComputedStyle(el).getPropertyValue('--tilt')) || 0,
      x: box.left + box.width / 2 + scrollX,
      y: box.top + box.height / 2 + scrollY,
    };
  }

  // Clamps past the end of the trail, so a new tail waits to be pulled out.
  function walkBack(path, dist) {
    let seen = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const step = Math.hypot(b.x - a.x, b.y - a.y);
      if (seen + step >= dist) {
        const t = step ? (dist - seen) / step : 0;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      seen += step;
    }
    return path[path.length - 1];
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Always places something: with nothing to eat, the board can't be cleared.
  function spawnOne(g) {
    const id = g.pool.pop();
    const pad = g.size;
    let best = null;

    for (let tries = 0; tries < 40; tries++) {
      const x = pad + Math.random() * (innerWidth - 2 * pad - g.size);
      const y = pad + Math.random() * (innerHeight - 2 * pad - g.size);
      const cx = x + g.size / 2;
      const cy = y + g.size / 2;
      const room = Math.min(...g.centres.map(p => Math.hypot(p.x - cx, p.y - cy)));
      if (!best || room > best.room) best = { x, y, cx, cy, room };
      if (room > g.size * 3) break;
    }

    const el = document.createElement('span');
    el.className = `chip block snake-food b-${id}`;
    el.innerHTML = `<svg><use href="#i-${id}"/></svg>`;
    place(el, best.x, best.y, 0);
    g.stage.append(el);
    g.food.push({ el, x: best.cx, y: best.cy });
  }

  function start(key) {
    const stage = document.createElement('div');
    stage.id = 'snake-stage';
    stage.setAttribute('aria-hidden', 'true');
    document.body.append(stage);

    // Measure all of them before moving any out of the hero.
    const segs = chips.map(capture);
    const size = segs[0].size;
    const gap = size * GAP;
    const half = size / 2;

    for (const s of segs) {
      s.el.classList.add('snake-seg');
      stage.append(s.el);
      place(s.el, s.x - scrollX - half, s.y - scrollY - half, s.tilt);
    }

    // Far enough in that the whole body forms on-screen, off the wall.
    const dir = DIRS[key];
    const tail = gap * (segs.length - 1);
    const box = portrait.getBoundingClientRect();
    const hx = clamp(box.left + box.width / 2, size + (dir[0] < 0 ? 0 : tail), innerWidth - size - (dir[0] > 0 ? 0 : tail));
    const hy = clamp(box.top + box.height / 2, size, innerHeight - size);

    // Seeded with the line the body forms in, so the first frame after the fly-in
    // lands where the transition left off.
    const path = [];
    for (let d = 0; d <= tail + 8; d += 4) path.push({ x: hx - dir[0] * d, y: hy - dir[1] * d });

    const body = segs.map((s, i) => ({ x: hx - dir[0] * i * gap, y: hy - dir[1] * i * gap }));

    game = {
      stage,
      segs,
      food: [],
      pool: shuffle(FOOD.slice()),
      home: segs.slice(),
      centres: body,
      size,
      gap,
      dir,
      turns: [],
      path,
      t: 0,
      over: false,
      raf: 0,
    };

    spawnOne(game);

    // Flush, or the browser only sees the target and skips the transition.
    void stage.offsetWidth;

    segs.forEach((s, i) => {
      s.el.style.transition = `transform ${FORM_MS}ms cubic-bezier(.34, 1.16, .64, 1)`;
      place(s.el, body[i].x - half, body[i].y - half, 0);
    });

    setTimeout(() => {
      if (!game || game.over) return;
      for (const s of game.segs) s.el.style.transition = '';
      game.raf = requestAnimationFrame(now => {
        game.clock = now;
        frame(now);
      });
    }, FORM_MS);
  }

  function frame(now) {
    const g = game;
    if (!g || g.over) return;

    const dt = Math.min((now - g.clock) / 1000, 0.05);
    g.clock = now;
    g.t += dt;

    // Perpendicular turns only.
    while (g.turns.length) {
      const d = g.turns.shift();
      if (d[0] * g.dir[0] + d[1] * g.dir[1] === 0) {
        g.dir = d;
        break;
      }
    }

    const head = g.path[0];
    const next = { x: head.x + g.dir[0] * SPEED * dt, y: head.y + g.dir[1] * SPEED * dt };
    const half = g.size / 2;
    const crashed = next.x < half || next.y < half || next.x > innerWidth - half || next.y > innerHeight - half;

    // Parked flush against the wall rather than part-way through it.
    if (crashed) {
      next.x = clamp(next.x, half, innerWidth - half);
      next.y = clamp(next.y, half, innerHeight - half);
    }

    g.path.unshift(next);

    // Trim to the arc length the body covers, plus slack.
    let keep = g.gap * (g.segs.length - 1) + 8;
    for (let i = 1; i < g.path.length; i++) {
      keep -= Math.hypot(g.path[i].x - g.path[i - 1].x, g.path[i].y - g.path[i - 1].y);
      if (keep <= 0) {
        g.path.length = i + 1;
        break;
      }
    }

    g.centres = g.segs.map((s, i) => {
      const p = i ? walkBack(g.path, i * g.gap) : next;
      const deg = still.matches ? 0 : WIGGLE * Math.sin(g.t * 7 - i * 0.9);
      place(s.el, p.x - half, p.y - half, deg);
      return p;
    });

    for (let i = g.food.length - 1; i >= 0; i--) {
      const f = g.food[i];
      if (Math.hypot(f.x - next.x, f.y - next.y) > g.size * 0.8) continue;
      g.food.splice(i, 1);
      f.el.classList.replace('snake-food', 'snake-seg');
      g.segs.push({ el: f.el, size: g.size });
    }

    // Skips the two behind the head, which are always within a spacing of it.
    const bitten = g.centres.some((p, i) => i > 2 && Math.hypot(p.x - next.x, p.y - next.y) < g.size * 0.6);

    if (crashed || bitten) return die();
    if (!g.food.length) {
      if (!g.pool.length) return win();
      spawnOne(g);
    }
    g.raf = requestAnimationFrame(frame);
  }

  // Board cleared: coil into a ring, spin up, throw it apart.
  function win() {
    const g = game;
    g.over = true;
    cancelAnimationFrame(g.raf);

    const half = g.size / 2;
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    const r = Math.min(g.segs.length * g.gap / (2 * Math.PI),
                       Math.min(innerWidth, innerHeight) / 2 - g.size);

    g.segs.forEach((s, i) => {
      s.angle = (i / g.segs.length) * 2 * Math.PI;
      s.el.style.transition = `transform ${RING_MS}ms ease-in-out`;
      place(s.el, cx + Math.cos(s.angle) * r - half, cy + Math.sin(s.angle) * r - half, 0);
    });

    setTimeout(() => spin(cx, cy, r), RING_MS);
  }

  function spin(cx, cy, r) {
    const g = game;
    for (const s of g.segs) s.el.style.transition = '';

    let from = null;
    const step = now => {
      from ??= now;
      const p = Math.min((now - from) / SPIN_MS, 1);
      const turn = 4 * Math.PI * p * p;   // two revolutions, accelerating
      const half = g.size / 2;

      for (const s of g.segs) {
        const a = s.angle + turn;
        place(s.el, cx + Math.cos(a) * r - half, cy + Math.sin(a) * r - half, turn * 180 / Math.PI);
      }

      if (p < 1) {
        g.raf = requestAnimationFrame(step);
        return;
      }
      burst(cx, cy, turn);
    };
    g.raf = requestAnimationFrame(step);
  }

  function burst(cx, cy, turn) {
    const g = game;
    const reach = Math.hypot(innerWidth, innerHeight);
    const half = g.size / 2;

    for (const s of g.segs) {
      const a = s.angle + turn;
      s.el.style.transition = `transform ${BURST_MS}ms cubic-bezier(.2, .6, .3, 1), opacity ${BURST_MS}ms ease`;
      place(s.el, cx + Math.cos(a) * reach - half, cy + Math.sin(a) * reach - half, 540);
    }

    setTimeout(goHome, BURST_MS);
  }

  function die() {
    const g = game;
    g.over = true;
    cancelAnimationFrame(g.raf);
    g.stage.classList.add('dead');
    setTimeout(goHome, DEAD_MS);
  }

  // Timed rather than on transitionend, which reduced motion never fires.
  function goHome() {
    const g = game;
    g.stage.classList.remove('dead');
    const half = g.size / 2;

    // A running animation outranks inline styles; both here touch opacity.
    for (const el of g.stage.querySelectorAll('.chip')) el.style.animation = 'none';

    for (const f of g.food) {
      f.el.style.transition = `opacity ${HOME_MS}ms ease`;
      f.el.style.opacity = '0';
    }

    for (const s of g.segs) {
      s.el.style.transition = `transform ${HOME_MS}ms ease, opacity ${HOME_MS}ms ease`;
      if (s.parent) {
        place(s.el, s.x - scrollX - half, s.y - scrollY - half, s.tilt);
      } else {
        s.el.style.transform += ' scale(0.2)';
        s.el.style.opacity = '0';
      }
    }

    setTimeout(() => {
      for (const s of g.home) {
        s.el.classList.remove('snake-seg');
        s.el.removeAttribute('style');
        s.parent.insertBefore(s.el, s.next);
      }
      g.stage.remove();
      game = null;
    }, HOME_MS + 40);
  }

  // Stops a second press during the sheet fetch starting a second run.
  let arming = false;

  async function arm(key) {
    arming = true;
    await loadSheet();
    arming = false;
    if (!game) start(key);
  }

  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const key = keyOf(e);

    if (!game) {
      // Any of the eight, so up and down cost the page one scroll keypress.
      if (!arming && DIRS[key]) {
        e.preventDefault();
        arm(key);
      }
      return;
    }

    // Swallowed while a run ends, so the page can't scroll under it.
    if (game.over) {
      if (DIRS[key]) e.preventDefault();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      game.over = true;
      cancelAnimationFrame(game.raf);
      goHome();
      return;
    }

    if (DIRS[key]) {
      e.preventDefault();
      if (game.turns.length < 2) game.turns.push(DIRS[key]);
    }
  });
})();
