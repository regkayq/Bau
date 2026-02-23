/* ══════════════════════════════════════════════════════════════════
   BAU CONTROL SYSTEM — INTERACTIVE LOGIC
══════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── State ─────────────────────────────────────────────────────── */
const state = {
  engine:    false,   // running
  starting:  false,
  estop:     false,
  locked:    true,

  throttle:  0,       // 0–100
  workMode:  'POWER',

  // Hydraulics 0–100 (50 = neutral)
  boom:   50,
  arm:    50,
  bucket: 50,
  swing:  0,          // degrees -90 to +90

  travelSpeed: 1,     // 1 | 2 | 3

  // Vitals
  fuel:      78,
  engineTemp: 0,
  def:       62,
  batVolt:   24.6,

  // Dynamic gauges
  rpm:       0,
  load:      0,
  hydPres:   0,
  hydTemp:   40,

  // Lights
  lightsWork:   false,
  lightsTravel: false,
  lightsCabin:  false,

  // Attachment
  activeAttach: 'Bucket',

  // Tilt (simulated)
  pitch: 0,
  roll:  0,

  // Op hours
  opHours: 1483.2,

  tick: 0,
};

/* ─── Helpers ────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ─── Clock ──────────────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  $('clock').textContent = `${hh}:${mm}`;
}
updateClock();
setInterval(updateClock, 10000);

/* ─── Dial Gauge helpers ─────────────────────────────────────────── */
// Arc path for a 270° dial: 0→267 dasharray, -135°→+135°
const DIAL_ARC_LEN = 267;

function buildTicks(containerId, count, majorEvery, maxVal) {
  const g = $(containerId);
  if (!g) return;
  const cx = 100, cy = 110, r = 85;
  for (let i = 0; i <= count; i++) {
    const angle = -135 + (270 / count) * i;
    const rad   = (angle * Math.PI) / 180;
    const isMajor = (i % majorEvery === 0);
    const inner = r - (isMajor ? 12 : 7);
    const outer = r - 2;
    const x1 = cx + outer * Math.cos(rad);
    const y1 = cy + outer * Math.sin(rad);
    const x2 = cx + inner * Math.cos(rad);
    const y2 = cy + inner * Math.sin(rad);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    if (isMajor) line.classList.add('major');
    g.appendChild(line);

    if (isMajor) {
      const labelR = r - 20;
      const lx = cx + labelR * Math.cos(rad);
      const ly = cy + labelR * Math.sin(rad);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', lx);
      txt.setAttribute('y', ly);
      txt.textContent = Math.round((maxVal / count) * i);
      g.appendChild(txt);
    }
  }
}

buildTicks('rpm-ticks',  20, 4, 40);   // 0–4000 RPM  (×100 → 0–40)
buildTicks('load-ticks', 10, 2, 100);  // 0–100 %

function setDial(arcId, needleId, valTextId, value, maxVal) {
  const pct    = clamp(value / maxVal, 0, 1);
  const filled = pct * DIAL_ARC_LEN;
  const angle  = -135 + pct * 270;

  const arc    = $(arcId);
  const needle = $(needleId);
  const valTxt = $(valTextId);

  if (arc)    arc.style.strokeDasharray = `${filled} ${DIAL_ARC_LEN}`;
  if (needle) needle.style.transform    = `rotate(${angle}deg)`;
  if (valTxt) valTxt.textContent        = Math.round(value);
}

/* ─── Mini arc gauge ─────────────────────────────────────────────── */
const ARC_LEN = 110;

function setMiniArc(arcId, value, maxVal) {
  const arc = $(arcId);
  if (!arc) return;
  const pct    = clamp(value / maxVal, 0, 1);
  const filled = pct * ARC_LEN;
  arc.style.strokeDasharray = `${filled} ${ARC_LEN}`;
}

/* ─── Hydraulic sliders ──────────────────────────────────────────── */
function updateHydSlider(axis) {
  const val  = state[axis];           // 0–100
  const fill = $(axis + '-fill');
  const thumb= $(axis + '-thumb');
  const lbl  = $(axis + '-val');
  const pct  = (val / 100) * 100;

  if (fill)  fill.style.height  = pct + '%';
  if (thumb) thumb.style.bottom = pct + '%';
  if (lbl)   lbl.textContent    = Math.round(val) + '%';
}

['boom', 'arm', 'bucket'].forEach(axis => {
  document.querySelectorAll(`[data-axis="${axis}"]`).forEach(btn => {
    let interval = null;
    const step = () => {
      const dir = parseInt(btn.dataset.dir, 10);
      state[axis] = clamp(state[axis] + dir * 4, 0, 100);
      updateHydSlider(axis);
      updateMachineSvg();
    };
    btn.addEventListener('pointerdown', () => { step(); interval = setInterval(step, 120); });
    const stop = () => { clearInterval(interval); interval = null; };
    btn.addEventListener('pointerup',   stop);
    btn.addEventListener('pointerleave',stop);
  });
  updateHydSlider(axis);
});

/* ─── Swing ──────────────────────────────────────────────────────── */
function updateSwing() {
  const needle = $('swing-needle');
  const deg    = $('swing-deg');
  if (needle) needle.style.transform = `translateX(-50%) rotate(${state.swing}deg)`;
  if (deg)    deg.textContent        = (state.swing > 0 ? '+' : '') + state.swing + '°';
}

let swingInterval = null;
function startSwing(dir) {
  swingInterval = setInterval(() => {
    state.swing = clamp(state.swing + dir * 3, -90, 90);
    updateSwing();
  }, 80);
}
function stopSwing() { clearInterval(swingInterval); swingInterval = null; }

$('swing-left') .addEventListener('pointerdown', () => startSwing(-1));
$('swing-right').addEventListener('pointerdown', () => startSwing( 1));
['swing-left', 'swing-right'].forEach(id => {
  $( id).addEventListener('pointerup',    stopSwing);
  $(id).addEventListener('pointerleave', stopSwing);
});
updateSwing();

/* ─── Machine SVG schematic (simple kinematic) ───────────────────── */
function updateMachineSvg() {
  const boomAngle   = -90 + (state.boom   / 100) * 70;  // -90 to -20
  const armAngle    = boomAngle + 30 + (state.arm   / 100) * 50;
  const bucketAngle = armAngle  + 20 + (state.bucket/ 100) * 40;

  const toRad = a => a * Math.PI / 180;
  const boomLen = 55, armLen = 42;
  const bx = 80, by = 98;

  const boomX2 = bx + boomLen * Math.cos(toRad(boomAngle));
  const boomY2 = by + boomLen * Math.sin(toRad(boomAngle));

  const armX2  = boomX2 + armLen * Math.cos(toRad(armAngle));
  const armY2  = boomY2 + armLen * Math.sin(toRad(armAngle));

  const bLen = 18;
  const b1x = armX2 + bLen * Math.cos(toRad(bucketAngle - 30));
  const b1y = armY2 + bLen * Math.sin(toRad(bucketAngle - 30));
  const b2x = armX2 + bLen * Math.cos(toRad(bucketAngle + 30));
  const b2y = armY2 + bLen * Math.sin(toRad(bucketAngle + 30));

  const svgBoom   = $('svg-boom');
  const svgArm    = $('svg-arm');
  const svgBucket = $('svg-bucket');

  if (svgBoom) {
    svgBoom.setAttribute('x1', bx);
    svgBoom.setAttribute('y1', by);
    svgBoom.setAttribute('x2', boomX2);
    svgBoom.setAttribute('y2', boomY2);
  }
  if (svgArm) {
    svgArm.setAttribute('x1', boomX2);
    svgArm.setAttribute('y1', boomY2);
    svgArm.setAttribute('x2', armX2);
    svgArm.setAttribute('y2', armY2);
  }
  if (svgBucket) {
    svgBucket.setAttribute('d',
      `M${armX2} ${armY2} L${b1x} ${b1y} L${b2x} ${b2y} Z`
    );
  }
}
updateMachineSvg();

/* ─── Throttle ───────────────────────────────────────────────────── */
function updateThrottleUI() {
  const pct  = state.throttle;
  $('throttle-fill').style.height  = pct + '%';
  $('throttle-thumb').style.bottom = pct + '%';
  $('throttle-val').textContent    = pct + '%';
}

$('thr-up').addEventListener('click', () => {
  state.throttle = clamp(state.throttle + 5, 0, 100);
  updateThrottleUI();
});
$('thr-dn').addEventListener('click', () => {
  state.throttle = clamp(state.throttle - 5, 0, 100);
  updateThrottleUI();
});

// Drag/touch on throttle track
const throttleTrack = $('throttle-track');
let throttleDragging = false;

function setThrottleFromY(e) {
  const rect = throttleTrack.getBoundingClientRect();
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const ratio = clamp((rect.bottom - clientY) / rect.height, 0, 1);
  state.throttle = Math.round(ratio * 100);
  updateThrottleUI();
}

throttleTrack.addEventListener('pointerdown', e => { throttleDragging = true; setThrottleFromY(e); });
document.addEventListener('pointermove', e => { if (throttleDragging) setThrottleFromY(e); });
document.addEventListener('pointerup',   () => { throttleDragging = false; });

/* ─── Ignition ───────────────────────────────────────────────────── */
$('btn-ignition').addEventListener('click', () => {
  if (state.estop) return;
  if (state.starting) return;

  if (state.engine) {
    // Stop
    state.engine   = false;
    state.throttle = 0;
    updateThrottleUI();
    $('ign-state').textContent = 'OFF';
    $('ign-state').className   = 'ign-state';
    $('btn-ignition').classList.remove('on');
    document.querySelector('.status-pill').textContent = 'OPERATIONAL';
    document.querySelector('.status-pill').className   = 'status-pill active';
  } else {
    // Start sequence
    state.starting = true;
    $('ign-state').textContent = 'STARTING';
    $('ign-state').className   = 'ign-state starting';
    setTimeout(() => {
      state.engine   = true;
      state.starting = false;
      $('ign-state').textContent = 'RUNNING';
      $('ign-state').className   = 'ign-state running';
      $('btn-ignition').classList.add('on');
    }, 2200);
  }
});

/* ─── Work Mode ──────────────────────────────────────────────────── */
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.workMode = btn.dataset.mode;
    updateWorkModeDisplay();
  });
});

const modeIcons = {
  POWER:    '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  STANDARD: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  ECO:      '<svg viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
  FINE:     '<svg viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
};

function updateWorkModeDisplay() {
  const display = $('work-mode-display');
  const icon    = display.querySelector('.wmd-icon');
  const text    = display.querySelector('.wmd-text');
  icon.innerHTML = modeIcons[state.workMode] || modeIcons.POWER;
  icon.querySelector('svg').style.cssText = 'width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;';
  text.textContent = state.workMode;
  display.className = `work-mode-display mode-${state.workMode.toLowerCase()}`;
}
updateWorkModeDisplay();

/* ─── Travel speed ───────────────────────────────────────────────── */
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
document.querySelectorAll('[id^="btn-attach-"]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[id^="btn-attach-"]').forEach(b => b.classList.remove('on'));
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
$('btn-horn').addEventListener('pointerdown', () => $('btn-horn').style.opacity = '.6');
$('btn-horn').addEventListener('pointerup',   () => $('btn-horn').style.opacity = '');

/* ─── E-Stop ─────────────────────────────────────────────────────── */
$('btn-emer-stop').addEventListener('click', () => {
  state.estop   = true;
  state.engine  = false;
  state.throttle = 0;
  updateThrottleUI();
  $('ign-state').textContent = 'E-STOP';
  $('ign-state').className   = 'ign-state fault';
  $('btn-ignition').classList.remove('on');
  $('overlay-estop').hidden = false;

  document.querySelector('.status-pill').textContent = 'FAULT';
  document.querySelector('.status-pill').className   = 'status-pill fault';
});

$('btn-estop-reset').addEventListener('click', () => {
  state.estop = false;
  $('overlay-estop').hidden = true;
  $('ign-state').textContent = 'OFF';
  $('ign-state').className   = 'ign-state';
  document.querySelector('.status-pill').textContent = 'OPERATIONAL';
  document.querySelector('.status-pill').className   = 'status-pill active';
});

/* ─── Alert overlay ──────────────────────────────────────────────── */
$('btn-alert-bar').addEventListener('click', () => {
  $('overlay-alerts').hidden = false;
});
$('close-alerts').addEventListener('click', () => {
  $('overlay-alerts').hidden = true;
});

/* ─── Vitals bars ────────────────────────────────────────────────── */
function setVitalBar(barId, pct, warnThresh, critThresh) {
  const bar = $(barId);
  if (!bar) return;
  bar.style.width = clamp(pct, 0, 100) + '%';
  bar.classList.remove('warn', 'crit');
  if (pct <= critThresh) bar.classList.add('crit');
  else if (pct <= warnThresh) bar.classList.add('warn');
}

function updateVitals() {
  setVitalBar('fuel-bar',     state.fuel,       25, 10);
  setVitalBar('eng-temp-bar', (state.engineTemp / 110) * 100, 70, 90);
  setVitalBar('def-bar',      state.def,        20, 10);
  setVitalBar('bat-bar',      ((state.batVolt - 20) / 10) * 100, 20, 10);

  $('fuel-pct').textContent   = Math.round(state.fuel);
  $('eng-temp-val').textContent = Math.round(state.engineTemp);
  $('def-pct').textContent    = Math.round(state.def);
  $('bat-val').textContent    = state.batVolt.toFixed(1);
}

/* ─── Status indicators ──────────────────────────────────────────── */
function updateStatusIndicators() {
  ['ind-gps', 'ind-can', 'ind-telematics'].forEach(id => {
    $(id).classList.add('ok');
  });
}
updateStatusIndicators();

/* ─── Level bubble ───────────────────────────────────────────────── */
function updateLevelBubble() {
  const bubble = $('level-bubble');
  const wrap   = document.querySelector('.level-bubble-wrap');
  if (!bubble || !wrap) return;
  const radius = (wrap.offsetWidth / 2) - 12;
  const px = clamp(state.roll  / 15, -1, 1) * radius;
  const py = clamp(state.pitch / 15, -1, 1) * radius;
  bubble.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
  $('tilt-pitch').textContent = state.pitch.toFixed(1) + '°';
  $('tilt-roll').textContent  = state.roll.toFixed(1)  + '°';
}

/* ─── Center stats ───────────────────────────────────────────────── */
function updateCenterStats() {
  const loadFactor = state.engine ? Math.round(state.load) : 0;
  $('cs-load').textContent    = loadFactor + '%';
  $('cs-hours').textContent   = state.opHours.toFixed(1) + 'h';
  $('cs-service').textContent = (500 - (state.opHours % 500)).toFixed(0) + 'h';
}

/* ─── Simulation loop ────────────────────────────────────────────── */
// Smoothly simulates engine dynamics based on state
let prevRpm  = 0;
let prevLoad = 0;

function simulationTick() {
  state.tick++;
  const t = state.tick;

  if (state.engine && !state.estop) {
    // RPM follows throttle with some lag + idle
    const modeFactor = { POWER: 1.0, STANDARD: 0.85, ECO: 0.70, FINE: 0.60 }[state.workMode] || 1.0;
    const targetRpm  = 8 + state.throttle * 0.32 * modeFactor; // 0–40 range (×100)
    prevRpm  = prevRpm + (targetRpm - prevRpm) * 0.08;
    state.rpm = prevRpm + Math.sin(t * 0.5) * 0.3;  // slight vibration

    // Load based on hydraulic activity
    const hydActivity = Math.abs(state.boom - 50) + Math.abs(state.arm - 50) + Math.abs(state.bucket - 50);
    const targetLoad  = clamp((hydActivity / 150) * 70 + state.throttle * 0.25, 0, 100);
    prevLoad = prevLoad + (targetLoad - prevLoad) * 0.06;
    state.load = prevLoad + Math.sin(t * 0.8) * 1.5;

    // Hydraulic pressure tracks load
    state.hydPres = clamp(150 + state.load * 2.2 + Math.sin(t * 0.6) * 8, 0, 350);

    // Hydraulic temp rises with load
    const heatRate = (state.hydPres / 350) * 0.03 - 0.005;
    state.hydTemp  = clamp(state.hydTemp + heatRate + Math.sin(t * 0.2) * 0.02, 40, 105);

    // Engine temp
    const engHeat = state.throttle * 0.004 - 0.01;
    state.engineTemp = clamp(state.engineTemp + engHeat, 0, 110);

    // Fuel consumption
    if (t % 20 === 0) {
      state.fuel = clamp(state.fuel - 0.004 * (state.throttle / 100 + 0.3), 0, 100);
    }

    // Op hours
    if (t % 36 === 0) {
      state.opHours += 0.01;  // approx real-time scaling
    }
  } else {
    // Cool down
    prevRpm  = prevRpm * 0.94;
    prevLoad = prevLoad * 0.9;
    state.rpm      = prevRpm;
    state.load     = prevLoad;
    state.hydPres  = Math.max(0, state.hydPres * 0.97);
    state.hydTemp  = Math.max(40, state.hydTemp - 0.05);
    state.engineTemp = Math.max(0, state.engineTemp - 0.08);
  }

  // Simulate slight tilt variation (terrain)
  if (t % 60 === 0) {
    state.pitch += (Math.random() - 0.5) * 0.4;
    state.roll  += (Math.random() - 0.5) * 0.4;
    state.pitch  = clamp(state.pitch, -8, 8);
    state.roll   = clamp(state.roll,  -8, 8);
  }

  // Update all outputs
  setDial('rpm-arc',  'rpm-needle',  'rpm-val-text',  state.rpm,  40);
  setDial('load-arc', 'load-needle', 'load-val-text', state.load, 100);
  setMiniArc('hyd-arc',      state.hydPres, 350);
  setMiniArc('hyd-temp-arc', state.hydTemp, 105);

  $('hyd-pres-val').textContent = Math.round(state.hydPres);
  $('hyd-temp-val').textContent = Math.round(state.hydTemp);

  updateVitals();
  updateLevelBubble();
  updateCenterStats();

  // Hydraulic temp warning
  const hydTempAlert = document.querySelector('[data-code="HYD-TEMP"]');
  if (hydTempAlert) {
    hydTempAlert.style.display = state.hydTemp > 82 ? '' : 'none';
  }
}

// Initialise gauges at zero
setDial('rpm-arc',  'rpm-needle',  'rpm-val-text',  0, 40);
setDial('load-arc', 'load-needle', 'load-val-text', 0, 100);
setMiniArc('hyd-arc',      0, 350);
setMiniArc('hyd-temp-arc', 40, 105);

// Set initial vitals display
updateVitals();
updateLevelBubble();
updateCenterStats();

setInterval(simulationTick, 300);

/* ─── Touch & pointer accessibility ─────────────────────────────── */
// Prevent accidental double-tap zoom on touch screens
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

// Visual feedback for all interactive elements on touch
document.querySelectorAll('button, .hyd-btn, .mode-btn, .travel-btn, .bb-btn').forEach(el => {
  el.addEventListener('touchstart', () => {}, { passive: true });
});
