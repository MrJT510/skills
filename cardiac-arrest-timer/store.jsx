// store.jsx — central state, helpers, broselow data, drug catalog

const { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } = React;

const fmtMMSS = (s) => {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

// Real wall-clock time of day for a given event. base = ms epoch at elapsed 0
// (CPR start), t = elapsed seconds. Falls back gracefully when base is null.
const clockAt = (base, t) => {
  if (base == null) return '';
  const d = new Date(base + t * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const clockNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const BROSELOW = [
  { name: 'Grey',   color: '#9aa3ad', kg: '3–5 kg',   wt: 4,    epi: '0.03–0.05 mg', amio: '15–25 mg' },
  { name: 'Pink',   color: '#f7a4c1', kg: '6–7 kg',   wt: 6.5,  epi: '0.06–0.07 mg', amio: '30–35 mg' },
  { name: 'Red',    color: '#dc2626', kg: '8–9 kg',   wt: 8.5,  epi: '0.08–0.09 mg', amio: '40–45 mg' },
  { name: 'Purple', color: '#8b5cf6', kg: '10–11 kg', wt: 10.5, epi: '0.10–0.11 mg', amio: '50–55 mg' },
  { name: 'Yellow', color: '#eab308', kg: '12–14 kg', wt: 13,   epi: '0.12–0.14 mg', amio: '60–70 mg' },
  { name: 'White',  color: '#e6e8ec', kg: '15–18 kg', wt: 16.5, epi: '0.15–0.18 mg', amio: '75–90 mg' },
  { name: 'Blue',   color: '#2563eb', kg: '19–22 kg', wt: 20.5, epi: '0.19–0.22 mg', amio: '95–110 mg' },
  { name: 'Orange', color: '#ea580c', kg: '24–28 kg', wt: 26,   epi: '0.24–0.28 mg', amio: '120–140 mg' },
  { name: 'Green',  color: '#1f9d55', kg: '30–36 kg', wt: 33,   epi: '0.30–0.36 mg', amio: '150–180 mg' },
];

// Compute pediatric defib options for a Broselow weight.
// Protocol 700-P07 §4.1: 2 J/kg first dose, then 4 J/kg subsequent shocks.
function pedJoules(weightKg) {
  const r = (n) => Math.round(n);
  return [
    { jPerKg: 2, j: Math.min(360, r(2 * weightKg)), label: '2 J/kg · 1st' },
    { jPerKg: 4, j: Math.min(360, r(4 * weightKg)), label: '4 J/kg · next' },
  ];
}

const ARREST_TYPES = [
  { id: 'medical',     label: 'Medical' },
  { id: 'traumatic',   label: 'Traumatic' },
  { id: 'hypothermic', label: 'Hypothermic' },
  { id: 'drowning',    label: 'Drowning' },
  { id: 'vad',         label: 'VAD' },
  { id: 'pregnant',    label: 'Pregnant >20wk' },
];

const SPECIAL_ALERTS = {
  traumatic:   { text: 'Immediate transport to trauma center — all care en route. Do not resuscitate if initial ECG is asystole, PEA <40, or trauma center >20 min away. Epi only if NOT exsanguinating.', ref: '§11' },
  hypothermic: { text: 'Assess pulse 45 seconds. Limit to 1 shock until warm. Withhold IV meds until temp >86°F.', ref: '§7' },
  vad:         { text: 'No mechanical CPR. No compressions if rotor hum present. Transport to nearest VAD-capable center.', ref: '§8' },
  drowning:    { text: 'Transport to trauma center if spinal injury suspected.', ref: '§10' },
  pregnant:    { text: 'Transport to nearest facility for resuscitative hysterotomy.', ref: '§9' },
};

const ROSC_ALERT = {
  text: 'ETCO2 target 30–40 mmHg · 12-lead ECG · STEMI center · SBP <90: fluid bolus + Dopamine · Wide complex: Sync cardio',
  ref: '§12',
};

const DRUGS = [
  { id: 'epi',     name: 'Epinephrine',           adult: '1 mg IV/IO (1:10,000)', accent: 'red' },
  { id: 'amio300', name: 'Amiodarone',            adult: '300 mg IV/IO — first dose', accent: 'blue' },
  { id: 'amio150', name: 'Amiodarone',            adult: '150 mg IV/IO — 2nd dose · refractory >5 min · max 450 mg', accent: 'blue' },
  { id: 'cal',     name: 'Calcium Chloride',      adult: '10 mg/kg IV/IO · max 1 g · flush line after', accent: 'gray' },
  { id: 'bicarb',  name: 'Sodium Bicarbonate',    adult: '1 mEq/kg IV/IO · max 50 mEq', accent: 'gray' },
  { id: 'fluid',   name: 'Fluid Bolus',           adult: '500 mL IV/IO', accent: 'gray' },
  { id: 'dop',     name: 'Dopamine',              adult: '10–20 mcg/kg/min IV · titrate SBP >90 mmHg', accent: 'gray' },
  { id: 'txa',     name: 'TXA',                   adult: 'Post-ROSC traumatic arrest · hemorrhagic shock per local protocol', accent: 'gray' },
  { id: 'd50',     name: 'D50',                   adult: '25 g IV/IO', accent: 'gray' },
];

const AIRWAY_INTERVENTIONS = [
  { id: 'ett',    label: 'Intubation',         tint: '#fff3e0', dot: '#d97706', accent: '#d97706',
    picker: 'intubation' },
  { id: 'lma',    label: 'LMA',                tint: '#e6efff', dot: '#2563eb', accent: '#2563eb',
    picker: 'lma' },
  { id: 'opa',    label: 'OPA',                tint: '#f3ecff', dot: '#7c3aed', accent: '#7c3aed',
    picker: 'opa' },
  { id: 'bvm',    label: 'BVM (1:6)',          tint: '#e8f6ee', dot: '#1f9d55', accent: '#1f9d55' },
  { id: 'etco2',  label: 'ETCO2 monitoring',   tint: '#fdecec', dot: '#dc2626', accent: '#dc2626',
    picker: 'etco2' },
  { id: 'npa',    label: 'NPA',                tint: '#fef9c3', dot: '#a16207', accent: '#a16207',
    picker: 'npa' },
];

const ETT_SIZES   = ['6.0', '6.5', '7.0', '7.5', '8.0'];
const ETT_BLADES  = ['MAC 1', 'MAC 2', 'MAC 3', 'MAC 4', 'MIL 1', 'MIL 2', 'MIL 3', 'MIL 4', 'Video scope'];
const LMA_SIZES   = ['1', '2', '3', '4', '5'];
const OPA_SIZES   = ['Extra-large', 'Large', 'Medium', 'Small', 'Child', 'Infant'];
const NPA_SIZES   = ['12 Fr', '14 Fr', '16 Fr', '18 Fr', '20 Fr', '22 Fr', '24 Fr', '26 Fr', '28 Fr', '30 Fr', '32 Fr', '34 Fr', '36 Fr'];

// Vascular size catalogs with real-world standard color codes.
// IO = EZ-IO needle set colors; IV = international gauge color standard.
const IO_SIZES = [
  { label: 'Pink 15mm',   color: '#ec4899' },
  { label: 'Blue 25mm',   color: '#2563eb' },
  { label: 'Yellow 45mm', color: '#eab308' },
];
const IV_SIZES = [
  { label: '14g', color: '#ea580c' },  // orange
  { label: '16g', color: '#6b7280' },  // grey
  { label: '18g', color: '#1f9d55' },  // green
  { label: '20g', color: '#ec4899' },  // pink
  { label: '22g', color: '#2563eb' },  // blue
  { label: '24g', color: '#eab308' },  // yellow
];
function vascSizeColor(kind, label) {
  const list = kind === 'io' ? IO_SIZES : IV_SIZES;
  const hit = list.find(x => x.label === label);
  return hit ? hit.color : '#6b7280';
}

const HT_CAUSES = [
  'Hypoxia', 'Hypovolemia', 'Hypothermia',
  'Hyper/Hypokalemia', 'Tension PTX', 'Toxins',
];

const ETIOLOGIES = [
  'Cardiac (presumed)', 'Respiratory', 'Traumatic', 'Drowning',
  'Overdose/Toxin', 'Hypothermia', 'Unknown',
];

const CYCLE_SECONDS = 120;
const cycleNum = (elapsed) => Math.floor(Math.max(0, elapsed) / CYCLE_SECONDS) + 1;

// ─── Persistence ─────────────────────────────────────────
const SESSION_KEY = 'codeblue_session_v1';

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || saved.screen !== 'active') return null;
    // Nothing worth resuming if CPR was never started — show the launch screen fresh
    if (saved.cprStartedAt == null) return null;
    // Clear volatile UI flags so we never resume into a stuck overlay/dialog
    return {
      ...initialState(),
      ...saved,
      pulseCheckOverlay: false,
      epiOverlay: false,
      accessOverlay: false,
      pulseCheckPausedAt: null,
      show20MinDecision: false,
      showTerminateConfirm: false,
      showTraumaticEpiConfirm: false,
      flashTab: null,
      _resumed: true,
    };
  } catch (e) { return null; }
}

function saveSession(s) {
  try {
    if (s.screen !== 'active') { localStorage.removeItem(SESSION_KEY); return; }
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch (e) {}
}

// ─── Store ───────────────────────────────────────────────
const StoreCtx = createContext(null);
const useStore = () => useContext(StoreCtx);

function initialState() {
  return {
    screen: 'launch',                    // 'launch' | 'active'
    patientMode: 'adult',                // 'adult' | 'pediatric'
    broselowIdx: 0,
    arrestType: 'medical',
    witnessed: 'witnessed',              // 'witnessed' | 'unwitnessed'
    bystanderCpr: 'yes',                 // 'yes' | 'no'
    codeStatus: 'full',                  // 'full' | 'dnr' | 'obvious-death'

    startTime: null,
    cprStartedAt: null,                  // null = CPR not yet started; timers paused at 0
    elapsed: 0,                          // seconds since CPR start

    status: 'cpr',                       // cpr | transport | rosc | terminated

    epiLastAt: null,
    epiCount: 0,

    pulseCheckResetAt: 0,
    pulseCheckOverlay: false,

    initialRhythm: null,
    rhythmHistory: [],                   // [{rhythm, t}]
    reversibleCauses: {},                // {[id]: t}

    shocks: [],                          // [{j, t, n}]
    lastJoules: 200,                     // last tapped joules (sticky highlight)
    currentRhythm: null,                 // last-tapped rhythm change (id) for highlight

    etco2Readings: [],                   // [{v, t}]
    glucoseReadings: [],                 // [{v, t}]  point-of-care blood glucose
    etiology: '',

    medsLog: [],                         // chronological
    amio300At: null,
    amio150At: null,
    torsades: false,                     // polymorphic VT → Magnesium, not Amiodarone
    magCount: 0,                         // Magnesium Sulfate doses
    magAt: null,
    nsBolusCount: 0,                     // Normal Saline boluses
    tourniquetAt: null,
    aedAt: null,

    airwayLog: [],                       // [{id, label, t}]
    vascular: {},                        // { iv?: { t, size, location }, io?: { t, size, location } }
    specialProcs: [],                    // [{label, t}]
    airwayNotes: '',

    epiOverlay: false,
    accessOverlay: false,
    pulseCheckPausedAt: null,            // if non-null, pulseCheck countdown is frozen
    showFrame: false,
    metronomeOn: false,
    cprEvents: [],                       // [{label, t}]
    onsceneWarnFired: false,

    // Settings
    audioEnabled: true,
    theme: 'system',                     // 'system' | 'light' | 'dark'
    _sysDark: false,

    // Team roles + compressor tracking
    roles: { lead: '', compressor: '', airway: '', meds: '' },
    compressorRotations: [],             // [{name, t}]
    lastRotationAt: null,                // elapsed at last compressor rotation

    transportAt: null,
    roscAt: null,
    arrivedAt: null,
    terminatedAt: null,

    log: [],                             // [{t, action, detail, kind}]
    activeTab: 'cpr',

    postCallNotes: '',

    show20MinDecision: false,
    showTerminateConfirm: false,
    showTraumaticEpiConfirm: false,
    flashTab: null,
    focusMode: false,
  };
}

function StoreProvider({ children }) {
  const [s, setS] = useState(() => loadSession() || initialState());
  const sRef = useRef(s);
  sRef.current = s;

  // ─── Crash-safe persistence (debounced — not every tick) ───
  const saveTimer = useRef(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSession(sRef.current), 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [s]);
  // Flush immediately before the page is hidden/unloaded so nothing is lost
  useEffect(() => {
    const flush = () => saveSession(sRef.current);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, []);

  // ─── Follow the device light/dark setting when theme = 'system' ───
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { return; }
    const onChange = () => setS(prev => ({ ...prev, _sysDark: mq.matches }));
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []);

  // ─── Screen wake lock — keep display on during an active code ───
  useEffect(() => {
    let lock = null, released = false;
    const active = s.screen === 'active' && s.cprStartedAt != null && s.status !== 'terminated' && s.status !== 'arrived';
    async function acquire() {
      try {
        if (active && 'wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch (e) {}
    }
    acquire();
    const onVis = () => { if (!released && active && document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVis);
      try { if (lock) lock.release(); } catch (e) {}
    };
  }, [s.screen, s.cprStartedAt, s.status]);

  // ─── Undo stack (auto-captures every logged action) ───
  const undoRef = useRef([]);
  const prevRef = useRef(s);
  const skipCapture = useRef(false);
  const [undoDepth, setUndoDepth] = useState(0);

  useEffect(() => {
    const prev = prevRef.current;
    if (skipCapture.current) { skipCapture.current = false; prevRef.current = s; return; }
    if (s.log.length > prev.log.length) {
      undoRef.current.push(prev);
      if (undoRef.current.length > 100) undoRef.current.shift();
      setUndoDepth(undoRef.current.length);
    }
    prevRef.current = s;
  }, [s]);

  const undo = useCallback(() => {
    if (!undoRef.current.length) return;
    const restored = undoRef.current.pop();
    skipCapture.current = true;
    setUndoDepth(undoRef.current.length);
    setS(restored);
  }, []);

  // Start a brand-new case — clears the saved session and resets to launch
  const newCase = useCallback(() => {
    undoRef.current = [];
    setUndoDepth(0);
    skipCapture.current = true;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    setS(initialState());
  }, []);

  // Ticker — drives elapsed time
  useEffect(() => {
    if (s.screen !== 'active' || s.status === 'terminated' || s.status === 'arrived' || s.cprStartedAt == null) return;
    const id = setInterval(() => {
      setS(prev => {
        if (prev.screen !== 'active' || prev.status === 'terminated' || prev.status === 'arrived' || prev.cprStartedAt == null) return prev;
        const elapsed = Math.floor((Date.now() - prev.cprStartedAt) / 1000);
        if (elapsed === prev.elapsed) return prev;
        // Check 20-min onscene warning
        let next = { ...prev, elapsed };
        if (!prev.onsceneWarnFired && elapsed >= 1200 && prev.status === 'cpr') {
          next.onsceneWarnFired = true;
          next.show20MinDecision = true;
          next.log = [...prev.log, {
            t: elapsed,
            action: '20-minute on-scene threshold reached',
            detail: 'Decision required: transport or terminate (local protocol)',
            kind: 'alert',
          }];
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [s.screen, s.status, s.cprStartedAt]);

  // Helpers
  const set = useCallback((patch) => {
    setS(prev => typeof patch === 'function' ? patch(prev) : { ...prev, ...patch });
  }, []);

  const logEvent = useCallback((action, detail, kind = 'event') => {
    setS(prev => {
      const t = prev.elapsed;
      return { ...prev, log: [...prev.log, { t, action, detail, kind }] };
    });
  }, []);

  // Back-date / edit a log entry's timestamp; keeps the log sorted by time
  const editLogTime = useCallback((index, newT) => {
    setS(prev => {
      const log = prev.log.map((e, i) => i === index ? { ...e, t: Math.max(0, newT), edited: true } : e);
      log.sort((a, b) => a.t - b.t);
      return { ...prev, log };
    });
  }, []);

  // Derived phase color
  const phase = useMemo(() => {
    if (s.status === 'terminated') return 'red';
    if (s.status === 'arrived')    return 'arrived';
    if (s.status === 'rosc')       return 'blue';
    if (s.status === 'transport')  return 'amber';
    if (s.onsceneWarnFired)        return 'warning';
    if (s.cprStartedAt == null)    return 'idle';
    return 'green';
  }, [s.status, s.onsceneWarnFired, s.cprStartedAt]);

  const statusLabel = useMemo(() => {
    if (s.status === 'terminated') return 'CPR terminated';
    if (s.status === 'arrived')    return 'Arrived · case closed';
    if (s.status === 'rosc')       return 'ROSC';
    if (s.status === 'transport')  return 'Transporting';
    if (s.onsceneWarnFired)        return '20-min reached — decide';
    if (s.cprStartedAt == null)    return 'Ready — start CPR';
    return 'CPR in progress';
  }, [s.status, s.onsceneWarnFired, s.cprStartedAt]);

  const cycle = useMemo(() => (s.cprStartedAt == null ? 0 : cycleNum(s.elapsed)), [s.cprStartedAt, s.elapsed]);

  // Resolve theme: 'system' follows the device (prefers-color-scheme); 'light'/'dark' force it.
  const darkMode = useMemo(() => {
    if (s.theme === 'dark') return true;
    if (s.theme === 'light') return false;
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  }, [s.theme, s.elapsed, s._sysDark]);

  const ctx = useMemo(() => ({
    s, set, setS, logEvent, phase, statusLabel,
    undo, canUndo: undoDepth > 0, editLogTime, cycle, darkMode, newCase,
  }), [s, set, logEvent, phase, statusLabel, undo, undoDepth, editLogTime, cycle, darkMode, newCase]);

  return <StoreCtx.Provider value={ctx}>{children}</StoreCtx.Provider>;
}

// ─── Color tokens ────────────────────────────────────────
const PHASE_COLORS = {
  idle:    { c: '#475569', tint: '#e2e8f0', deep: '#1e293b', textOn: '#ffffff' },
  green:   { c: '#1f9d55', tint: '#e8f6ee', deep: '#126e3b', textOn: '#ffffff' },
  amber:   { c: '#eab308', tint: '#fef9c3', deep: '#854d0e', textOn: '#1a1100' },
  warning: { c: '#ea580c', tint: '#ffedd5', deep: '#9a3412', textOn: '#ffffff' },
  red:     { c: '#dc2626', tint: '#fdecec', deep: '#991111', textOn: '#ffffff' },
  blue:    { c: '#2563eb', tint: '#e6efff', deep: '#1746a8', textOn: '#ffffff' },
  arrived: { c: '#4338ca', tint: '#e0e7ff', deep: '#312e81', textOn: '#ffffff' },
};

Object.assign(window, {
  fmtMMSS, clockAt, clockNow, BROSELOW, pedJoules, ARREST_TYPES, SPECIAL_ALERTS, ROSC_ALERT, DRUGS,
  AIRWAY_INTERVENTIONS, ETT_SIZES, ETT_BLADES, LMA_SIZES, OPA_SIZES, NPA_SIZES,
  IO_SIZES, IV_SIZES, vascSizeColor, CYCLE_SECONDS, cycleNum,
  HT_CAUSES, ETIOLOGIES, PHASE_COLORS,
  StoreCtx, StoreProvider, useStore, initialState,
});
