/* ══════════════════════════════════════════════════════════════════
   BAU CONTROL SYSTEM — INTERACTIVE LOGIC
══════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── State ─────────────────────────────────────────────────────── */
const state = {
  engine:   false,
  starting: false,
  estop:    false,
  locked:   true,

  throttle:  0,       // 0–100
  workMode: 'POWER',
  travelSpeed: 1,

  boom:   50,         // 0–100
  arm:    50,
  bucket: 50,
  swing:  0,          // −90 to +90 degrees

  fuel:       78,
  engineTemp: 0,
  def:        62,
  batVolt:    24.6,

  rpm:      0,        // displayed as RPM
  load:     0,        // 0–100 %
  hydPres:  0,        // 0–350 bar
  hydTemp:  40,       // °C

  lightsWork:   false,
  lightsTravel: false,
  lightsCabin:  false,

  pitch: 0,
  roll:  0,

  opHours: 1483.2,
  tick: 0,
};

/* ─── Helpers ────────────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ─── Clock ──────────────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  $('clock').textContent =
    String(now.getHours()).padStart(2,'0') + ':' +
    String(now.getMinutes()).padStart(2,'0');
}
updateClock();
setInterval(updateClock, 10_000);

/* ─── Ring gauge ─────────────────────────────────────────────────── */
// Reads r from the SVG circle element so it works at any size.
// stroke-dasharray = C, stroke-dashoffset = C*(1−pct), rotate −90°
function setRing(id, value, maxVal) {
  const circle = $(id);
  if (!circle) return;
  const r    = parseFloat(circle.getAttribute('r') || 38);
  const circ = 2 * Math.PI * r;
  const pct  = cl(value / maxVal, 0, 1);
  circle.style.strokeDasharray  = `${circ} ${circ}`;
  circle.style.strokeDashoffset = circ * (1 - pct);
}

// Initialise all rings to zero
['boom-ring','arm-ring','bucket-ring','rpm-ring','load-ring','throttle-ring'].forEach(id => {
  const el = $(id);
  if (!el) return;
  const r    = parseFloat(el.getAttribute('r') || 38);
  const circ = 2 * Math.PI * r;
  el.style.strokeDasharray  = `${circ} ${circ}`;
  el.style.strokeDashoffset = `${circ}`;
});

/* ─── Hydraulic rings + buttons ──────────────────────────────────── */
function updateHyd(axis) {
  const val = state[axis];
  setRing(axis + '-ring', val, 100);
  $(axis + '-val').textContent = Math.round(val);
}

['boom','arm','bucket'].forEach(axis => {
  document.querySelectorAll(`[data-axis="${axis}"]`).forEach(btn => {
    let iv = null;
    const step = () => {
      state[axis] = cl(state[axis] + parseInt(btn.dataset.dir, 10) * 4, 0, 100);
      updateHyd(axis);
      updateMachineSvg();
    };
    btn.addEventListener('pointerdown', () => { step(); iv = setInterval(step, 120); });
    const stop = () => { clearInterval(iv); iv = null; };
    btn.addEventListener('pointerup',    stop);
    btn.addEventListener('pointerleave', stop);
  });
  updateHyd(axis);
});

/* ─── Swing ──────────────────────────────────────────────────────── */
// Needle rotates on a 180° arc: −90° → left extreme, +90° → right extreme
// SVG arc path: M8 48 A40 40 0 0 1 82 48  (half circle, total ~125px arc)
// Arc length: π × r = π × 40 ≈ 125.7
const SWING_ARC = Math.PI * 40;

function updateSwing() {
  const pct    = (state.swing + 90) / 180;   // 0 at −90°, 1 at +90°
  const filled = pct * SWING_ARC;
  const needle = $('swing-needle');
  const arc    = $('swing-arc-fill');
  const deg    = $('swing-deg');
  if (needle) needle.style.transform = `rotate(${state.swing}deg)`;
  if (arc)    arc.style.strokeDasharray = `${filled} ${SWING_ARC}`;
  if (deg)    deg.textContent = (state.swing > 0 ? '+' : '') + state.swing + '°';
}

let swingIv = null;
const startSwing = dir => { swingIv = setInterval(() => { state.swing = cl(state.swing + dir * 3, -90, 90); updateSwing(); }, 80); };
const stopSwing  = ()  => { clearInterval(swingIv); swingIv = null; };
$('swing-left') .addEventListener('pointerdown', () => startSwing(-1));
$('swing-right').addEventListener('pointerdown', () => startSwing( 1));
['swing-left','swing-right'].forEach(id => {
  $(id).addEventListener('pointerup',    stopSwing);
  $(id).addEventListener('pointerleave', stopSwing);
});
updateSwing();

/* ─── Machine SVG schematic ──────────────────────────────────────── */
function updateMachineSvg() {
  const toRad   = a => a * Math.PI / 180;
  const boomAng = -90 + (state.boom   / 100) * 65;
  const armAng  = boomAng + 35 + (state.arm   / 100) * 45;
  const bktAng  = armAng  + 20 + (state.bucket/ 100) * 40;

  const boomLen = 52, armLen = 40;
  const bx = 80, by = 96;
  const bx2 = bx + boomLen * Math.cos(toRad(boomAng));
  const by2 = by + boomLen * Math.sin(toRad(boomAng));
  const ax2 = bx2 + armLen * Math.cos(toRad(armAng));
  const ay2 = by2 + armLen * Math.sin(toRad(armAng));

  const bLen = 16;
  const b1x = ax2 + bLen * Math.cos(toRad(bktAng - 30));
  const b1y = ay2 + bLen * Math.sin(toRad(bktAng - 30));
  const b2x = ax2 + bLen * Math.cos(toRad(bktAng + 30));
  const b2y = ay2 + bLen * Math.sin(toRad(bktAng + 30));

  const sb = $('svg-boom'), sa = $('svg-arm'), sk = $('svg-bucket');
  if (sb) { sb.setAttribute('x1',bx); sb.setAttribute('y1',by); sb.setAttribute('x2',bx2); sb.setAttribute('y2',by2); }
  if (sa) { sa.setAttribute('x1',bx2); sa.setAttribute('y1',by2); sa.setAttribute('x2',ax2); sa.setAttribute('y2',ay2); }
  if (sk) sk.setAttribute('d', `M${ax2} ${ay2} L${b1x} ${b1y} L${b2x} ${b2y} Z`);
}
updateMachineSvg();

/* ─── Throttle ───────────────────────────────────────────────────── */
function updateThrottleUI() {
  setRing('throttle-ring', state.throttle, 100);
  $('throttle-val').textContent       = state.throttle + '%';
  $('throttle-val-ring').textContent  = state.throttle;
}

$('thr-up').addEventListener('click', () => { state.throttle = cl(state.throttle + 5, 0, 100); updateThrottleUI(); });
$('thr-dn').addEventListener('click', () => { state.throttle = cl(state.throttle - 5, 0, 100); updateThrottleUI(); });
updateThrottleUI();

/* ─── Ignition ───────────────────────────────────────────────────── */
function setEngineState(state_str) {
  const dot  = $('ign-dot');
  const txt  = $('ign-state');
  dot.className  = 'ign-state-dot ' + state_str;
  txt.className  = 'ign-state-text ' + state_str;
  txt.textContent = state_str.toUpperCase();
}

function setTopBarStatus(label, sub, iconClass) {
  $('tb-status-main').textContent = label;
  $('tb-status-sub').textContent  = sub;
  const icon = $('tb-status-icon');
  icon.className = 'tb-status-icon ' + iconClass;
}

$('btn-ignition').addEventListener('click', () => {
  if (state.estop || state.starting) return;

  if (state.engine) {
    state.engine   = false;
    state.throttle = 0;
    updateThrottleUI();
    setEngineState('stopped');
    $('btn-ignition').classList.remove('on');
    setTopBarStatus('STOPPED', 'Engine off · Ready', 'stopped');
  } else {
    state.starting = true;
    setEngineState('starting');
    setTopBarStatus('STARTING', 'Ignition sequence…', 'starting');
    setTimeout(() => {
      state.engine   = true;
      state.starting = false;
      setEngineState('running');
      $('btn-ignition').classList.add('on');
      setTopBarStatus('RUNNING', 'All systems nominal', 'running');
    }, 2200);
  }
});

/* ─── Work Mode ──────────────────────────────────────────────────── */
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.workMode = btn.dataset.mode;
    $('tb-mode-val').textContent = state.workMode;
  });
});

/* ─── Travel Speed ───────────────────────────────────────────────── */
document.querySelectorAll('.travel-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.travel-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.travelSpeed = parseInt(btn.dataset.speed, 10);
  });
});

/* ─── Lights ─────────────────────────────────────────────────────── */
[
  ['btn-lights-work',   'lightsWork'],
  ['btn-lights-travel', 'lightsTravel'],
  ['btn-lights-cabin',  'lightsCabin'],
].forEach(([id, key]) => {
  $(id).addEventListener('click', () => {
    state[key] = !state[key];
    $(id).classList.toggle('on', state[key]);
  });
});

/* ─── Attachments ────────────────────────────────────────────────── */
document.querySelectorAll('.ab-att').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ab-att').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  });
});

/* ─── Safety Lock ────────────────────────────────────────────────── */
$('btn-safety-lock').addEventListener('click', () => {
  state.locked = !state.locked;
  $('lock-label').textContent = state.locked ? 'LOCKED' : 'UNLOCKED';
  $('btn-safety-lock').classList.toggle('off', !state.locked);
});

/* ─── Horn ───────────────────────────────────────────────────────── */
const horn = $('btn-horn');
horn.addEventListener('pointerdown', () => horn.classList.add('on'));
horn.addEventListener('pointerup',   () => horn.classList.remove('on'));

/* ─── E-Stop ─────────────────────────────────────────────────────── */
$('btn-emer-stop').addEventListener('click', () => {
  state.estop    = true;
  state.engine   = false;
  state.throttle = 0;
  updateThrottleUI();
  setEngineState('fault');
  $('btn-ignition').classList.remove('on');
  setTopBarStatus('E-STOP', 'All hydraulics suspended', 'fault');
  $('overlay-estop').hidden = false;
});

$('btn-estop-reset').addEventListener('click', () => {
  state.estop = false;
  $('overlay-estop').hidden = true;
  setEngineState('stopped');
  setTopBarStatus('STOPPED', 'Engine off · Ready', 'stopped');
});

/* ─── Alert overlay ──────────────────────────────────────────────── */
$('btn-alert-bar').addEventListener('click', () => { $('overlay-alerts').hidden = false; });
$('close-alerts').addEventListener('click',  () => { $('overlay-alerts').hidden = true; });

/* ─── Vitals ─────────────────────────────────────────────────────── */
function setVBar(id, pct, warnAt, critAt) {
  const el = $(id);
  if (!el) return;
  el.style.height = cl(pct, 0, 100) + '%';
  el.classList.remove('warn','crit');
  if (pct <= critAt) el.classList.add('crit');
  else if (pct <= warnAt) el.classList.add('warn');
}

function setTempBar(barId, value, maxVal) {
  const el = $(barId);
  if (!el) return;
  const pct = cl((value / maxVal) * 100, 0, 100);
  el.style.width = pct + '%';
  el.classList.remove('warm','hot');
  if (pct >= 90) el.classList.add('hot');
  else if (pct >= 70) el.classList.add('warm');
}

function setHBar(barId, pct, maxPct) {
  const el = $(barId);
  if (!el) return;
  el.style.width = cl((pct / maxPct) * 100, 0, 100) + '%';
}

function updateVitals() {
  setVBar('fuel-bar', state.fuel, 25, 10);
  setVBar('def-bar',  state.def,  20, 10);
  setVBar('bat-bar',  cl((state.batVolt - 20) / 10 * 100, 0, 100), 20, 10);

  $('fuel-pct').textContent = Math.round(state.fuel);
  $('def-pct').textContent  = Math.round(state.def);
  $('bat-val').textContent  = state.batVolt.toFixed(1);
  $('eng-temp-val').textContent = Math.round(state.engineTemp);

  setTempBar('eng-temp-bar', state.engineTemp, 110);
  setHBar('hyd-pres-bar', state.hydPres, 350);
  setHBar('hyd-temp-bar', state.hydTemp, 105);

  $('hyd-pres-val').textContent = Math.round(state.hydPres);
  $('hyd-temp-val').textContent = Math.round(state.hydTemp);

  // Hot color on hyd-temp bar
  const hb = $('hyd-temp-bar');
  if (hb) { hb.classList.toggle('hot', state.hydTemp > 85); }
}

/* ─── Level bubble ───────────────────────────────────────────────── */
function updateLevel() {
  const wrap   = document.querySelector('.level-bubble-wrap');
  const bubble = $('level-bubble');
  if (!wrap || !bubble) return;
  const r  = wrap.offsetWidth / 2 - 12;
  const px = cl(state.roll  / 15, -1, 1) * r;
  const py = cl(state.pitch / 15, -1, 1) * r;
  bubble.style.top  = `calc(50% + ${py}px)`;
  bubble.style.left = `calc(50% + ${px}px)`;
  $('tilt-pitch').textContent = state.pitch.toFixed(1) + '°';
  $('tilt-roll').textContent  = state.roll.toFixed(1)  + '°';
}

/* ─── Center stats ───────────────────────────────────────────────── */
function updateStats() {
  $('cs-load').textContent    = Math.round(state.load) + '%';
  $('cs-hours').textContent   = state.opHours.toFixed(1) + ' h';
  $('cs-service').textContent = (500 - (state.opHours % 500)).toFixed(0) + ' h';
}

/* ─── Simulation loop ────────────────────────────────────────────── */
let _rpm = 0, _load = 0;

function tick() {
  state.tick++;
  const t = state.tick;

  if (state.engine && !state.estop) {
    const mf = { POWER:1.0, STANDARD:.85, ECO:.70, FINE:.60 }[state.workMode] || 1.0;
    const targetRpm  = 800 + state.throttle * 32 * mf;  // 800–4000 RPM
    _rpm  += (targetRpm  - _rpm)  * 0.08;
    state.rpm = _rpm + Math.sin(t * .5) * 12;

    const hydAct = Math.abs(state.boom-50) + Math.abs(state.arm-50) + Math.abs(state.bucket-50);
    const targetLoad = cl((hydAct / 150) * 70 + state.throttle * .25, 0, 100);
    _load += (targetLoad - _load) * 0.06;
    state.load = _load + Math.sin(t * .8) * 1.5;

    state.hydPres = cl(150 + state.load * 2.2 + Math.sin(t * .6) * 8, 0, 350);

    const hr = (state.hydPres / 350) * .03 - .005;
    state.hydTemp = cl(state.hydTemp + hr + Math.sin(t * .2) * .02, 40, 105);

    const eh = state.throttle * .004 - .01;
    state.engineTemp = cl(state.engineTemp + eh, 0, 110);

    if (t % 20 === 0) state.fuel = cl(state.fuel - .004 * (state.throttle / 100 + .3), 0, 100);
    if (t % 36 === 0) state.opHours += 0.01;

  } else {
    _rpm  *= .94; _load *= .9;
    state.rpm      = _rpm;
    state.load     = _load;
    state.hydPres  = Math.max(0,   state.hydPres  * .97);
    state.hydTemp  = Math.max(40,  state.hydTemp  - .05);
    state.engineTemp = Math.max(0, state.engineTemp - .08);
  }

  if (t % 60 === 0) {
    state.pitch = cl(state.pitch + (Math.random()-.5) * .4, -8, 8);
    state.roll  = cl(state.roll  + (Math.random()-.5) * .4, -8, 8);
  }

  // ── Push to UI ──
  setRing('rpm-ring',  state.rpm,  4000);
  setRing('load-ring', state.load, 100);
  $('rpm-val-text').textContent  = Math.round(state.rpm);
  $('load-val-text').textContent = Math.round(state.load);

  updateVitals();
  updateLevel();
  updateStats();

  // HYD temp warning chip visibility
  const chip = document.querySelector('[data-code="HYD-TEMP"]');
  if (chip) chip.style.display = state.hydTemp > 82 ? '' : 'none';
}

setInterval(tick, 300);

/* ─── Touch: prevent double-tap zoom ─────────────────────────────── */
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
