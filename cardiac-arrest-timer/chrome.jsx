// chrome.jsx — fixed-top chrome: status bar, sub-timers, primary actions, phase decisions, tab bar

// ─── Flow ribbon: START CPR + next-step indicator ─────
function FlowRibbon() {
  const { s, set, setS, undo, canUndo } = useStore();

  const startCpr = () => {
    if (window.AudioEngine) AudioEngine.unlock();
    setS(prev => ({
      ...prev,
      cprStartedAt: Date.now(),
      pulseCheckResetAt: 0,
      cprEvents: [...prev.cprEvents, { label: 'CPR start', t: 0 }],
      log: [...prev.log, {
        t: 0, action: 'CPR started',
        detail: 'All timers running · pulse check in 2:00',
        kind: 'cpr',
      }],
    }));
  };

  if (s.cprStartedAt == null) {
    return (
      <div style={{ padding: '10px 12px 0' }}>
        <button onClick={startCpr} style={{
          width: '100%', padding: '18px 14px',
          background: '#1f9d55', color: '#fff',
          borderRadius: 14, fontSize: 18, fontWeight: 700, letterSpacing: '0.04em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 8px 22px rgba(31,157,85,0.45), 0 2px 4px rgba(31,157,85,0.25)',
        }}>
          <Ic.Play s={22} c="#fff" />
          <span>START CPR</span>
        </button>
        <div style={{
          fontSize: 10.5, color: 'var(--ink-3)', textAlign: 'center', marginTop: 6,
          letterSpacing: '0.02em',
        }}>
          Begins event clock, 2-min pulse check, 20-min on-scene timer
        </div>
      </div>
    );
  }

  // Compute next-step guidance
  const next = computeNextStep(s);

  return (
    <div style={{ padding: '10px 12px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 11,
        background: `${next.color}14`,
        border: `1.5px solid ${next.color}55`,
        borderLeft: `5px solid ${next.color}`,
        borderRadius: 12, padding: '11px 13px',
      }}>
        <div style={{
          width: 9, height: 9, borderRadius: 99, background: next.color, flexShrink: 0,
          boxShadow: `0 0 0 4px ${next.color}22`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9.5, fontWeight: 800, color: next.color,
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>Do next</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2, marginTop: 2 }}>
            {next.label}
          </div>
        </div>
        {canUndo && (
          <button onClick={undo} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            padding: '6px 9px', borderRadius: 9, background: 'var(--card)',
            border: '1px solid var(--line)', color: 'var(--ink-2)', flexShrink: 0,
          }}>
            <Ic.Rotate s={15} c="var(--ink-2)" />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>UNDO</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Compute next-step from state — flow-sheet sequencing per protocol
// Normalize the patient's current rhythm to an id, preferring the latest rhythm change.
function rhythmId(s) {
  const cur = (s.currentRhythm || '').toLowerCase();
  if (cur) {
    if (cur.includes('vf')) return 'vf';
    if (cur.includes('vt')) return 'pvt';
    if (cur.includes('pea')) return 'pea';
    if (cur.includes('asys')) return 'asystole';
    if (cur.includes('rosc')) return 'rosc';
    if (cur.includes('nsr')) return 'nsr';
  }
  return s.initialRhythm || null;
}
const SHOCKABLE = (id) => id === 'vf' || id === 'pvt';
const PERFUSING = (id) => id === 'rosc' || id === 'nsr';

function computeNextStep(s) {
  if (s.status === 'terminated') return { color: 'var(--ink-3)', label: 'Document & complete export' };
  if (s.status === 'arrived')    return { color: '#4338ca', label: 'Complete export · share handoff' };
  if (s.status === 'rosc')       return { color: '#2563eb', label: 'Post-ROSC: ETCO2 30–40 · 12-lead · STEMI center' };
  if (s.show20MinDecision)       return { color: '#ea580c', label: 'Decide: transport or terminate CPR' };
  if (s.onsceneWarnFired && s.status === 'cpr') return { color: '#ea580c', label: '20-min reached — decide transport or terminate' };

  // Pulse check countdown — the 2-minute cycle backbone always takes priority
  const pausedFor = s.pulseCheckPausedAt != null ? (s.pulseCheckPausedAt - s.pulseCheckResetAt) : 0;
  const pulseElapsed = s.pulseCheckOverlay ? pausedFor : (s.elapsed - s.pulseCheckResetAt);
  const pulseRemain = Math.max(0, 120 - pulseElapsed);
  if (pulseRemain <= 0) return { color: '#dc2626', label: 'Pulse check NOW — rhythm + pulse (2-min cycle)' };

  // Identify rhythm
  if (s.initialRhythm == null) return { color: '#7c3aed', label: 'Identify initial rhythm' };

  const id = rhythmId(s);

  // Adaptive: an organized/perfusing rhythm appeared → check for a pulse (possible ROSC)
  if (PERFUSING(id)) {
    return { color: '#2563eb', label: 'Organized rhythm — check pulse for ROSC' };
  }

  const hasAccess = Object.keys(s.vascular).length > 0;
  const epiSec = s.epiLastAt == null ? null : (s.elapsed - s.epiLastAt);
  const epiDue = s.epiCount === 0 || (epiSec != null && epiSec >= 180);

  // ── Shockable: VF / Pulseless VT (protocol §4) ──
  if (SHOCKABLE(id)) {
    const lastShock = s.shocks.length ? s.shocks[s.shocks.length - 1].t : null;
    const shockDue = s.shocks.length === 0 || (lastShock != null && (s.elapsed - lastShock) >= 110);
    if (shockDue) return { color: '#d97706', label: s.shocks.length === 0 ? 'Shockable — defibrillate now' : 'Defibrillate (escalate energy)' };
    if (!hasAccess) return { color: '#7c3aed', label: 'Establish IV / IO access' };
    if (s.torsades && s.magCount === 0) return { color: '#0ea5e9', label: 'Torsades — give Magnesium Sulfate 2 g' };
    if (epiDue) return { color: '#dc2626', label: s.epiCount === 0 ? 'Give Epinephrine 1 mg IV/IO' : `Epi due — next dose (${fmtMMSS(epiSec)})` };
    if (!s.torsades && s.amio300At == null && s.shocks.length >= 2) return { color: '#2563eb', label: 'Refractory VF/VT — Amiodarone 300 mg' };
    if (!s.torsades && s.amio300At != null && s.amio150At == null && (s.elapsed - s.amio300At) >= 300) return { color: '#2563eb', label: 'Still refractory — Amiodarone 150 mg' };
    if (s.airwayLog.length === 0) return { color: '#1f9d55', label: 'Secure airway · continuous ETCO2' };
    return { color: '#1f9d55', label: `Continue CPR · next shock/pulse in ${fmtMMSS(pulseRemain)}` };
  }

  // ── PEA (protocol §6): reversible causes first, then Epi, NO shock ──
  if (id === 'pea') {
    if (Object.keys(s.reversibleCauses || {}).length === 0) return { color: '#2563eb', label: 'PEA — find & treat reversible causes (H&T)' };
    if (!hasAccess) return { color: '#7c3aed', label: 'Establish IV / IO access' };
    if (epiDue) return { color: '#dc2626', label: s.epiCount === 0 ? 'Give Epinephrine 1 mg IV/IO' : `Epi due — next dose (${fmtMMSS(epiSec)})` };
    if (s.airwayLog.length === 0) return { color: '#1f9d55', label: 'Secure airway · continuous ETCO2' };
    return { color: '#1f9d55', label: `Continue CPR · reassess in ${fmtMMSS(pulseRemain)}` };
  }

  // ── Asystole (protocol §5): Epi only, NO shock ──
  if (id === 'asystole') {
    if (!hasAccess) return { color: '#7c3aed', label: 'Establish IV / IO access' };
    if (epiDue) return { color: '#dc2626', label: s.epiCount === 0 ? 'Give Epinephrine 1 mg IV/IO' : `Epi due — next dose (${fmtMMSS(epiSec)})` };
    if (Object.keys(s.reversibleCauses || {}).length === 0) return { color: '#2563eb', label: 'Consider reversible causes (H&T)' };
    if (s.airwayLog.length === 0) return { color: '#1f9d55', label: 'Secure airway · continuous ETCO2' };
    return { color: '#1f9d55', label: `Continue CPR · reassess in ${fmtMMSS(pulseRemain)}` };
  }

  // Fallback
  if (!hasAccess) return { color: '#7c3aed', label: 'Establish IV / IO access' };
  if (epiDue) return { color: '#dc2626', label: 'Give Epinephrine 1 mg IV/IO' };
  if (s.airwayLog.length === 0) return { color: '#1f9d55', label: 'Secure airway' };
  return { color: '#1f9d55', label: `Continue CPR · pulse check in ${fmtMMSS(pulseRemain)}` };
}

// ─── Initial rhythm picker (main screen) ─────────────────
function InitialRhythmCheck() {
  const { s, setS } = useStore();
  if (s.cprStartedAt == null || s.initialRhythm != null) return null;

  const RHYTHMS = [
    { id: 'vf',       label: 'VF',           color: '#dc2626' },
    { id: 'pvt',      label: 'Pulseless VT', color: '#d97706' },
    { id: 'pea',      label: 'PEA',          color: '#2563eb' },
    { id: 'asystole', label: 'Asystole',     color: '#64748b' },
  ];

  const setRhythm = (r) => setS(prev => ({
    ...prev,
    initialRhythm: r.id,
    rhythmHistory: [...prev.rhythmHistory, { rhythm: r.label, t: prev.elapsed }],
    currentRhythm: r.label,
    log: [...prev.log, {
      t: prev.elapsed,
      action: `Initial rhythm: ${r.label}`,
      detail: 'Locked — first interpretation',
      kind: 'rhythm',
    }],
  }));

  return (
    <div style={{ padding: '8px 12px 0' }}>
      <div className="card" style={{
        background: 'var(--card)', border: '1.5px solid #7c3aed', padding: '10px 12px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: '#7c3aed',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 9,
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}>
          <Ic.Heart s={13} c="#7c3aed" />
          Identify initial rhythm
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {RHYTHMS.map(r => (
            <button key={r.id} onClick={() => setRhythm(r)} style={{
              padding: '12px 6px', borderRadius: 10,
              background: 'var(--card)', color: r.color,
              border: `1.5px solid ${r.color}`,
              fontSize: 13, fontWeight: 700, minHeight: 48,
            }}>{r.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Live wall-clock — ticks independently each second
function LiveClock({ style }) {
  const [now, setNow] = React.useState(clockNow());
  React.useEffect(() => {
    const id = setInterval(() => setNow(clockNow()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="mono" style={style}>{now}</span>;
}

// ─── Status bar ──────────────────────────────────────────
function StatusBar() {
  const { s, set, phase, statusLabel, cycle } = useStore();
  const colors = PHASE_COLORS[phase];
  const modeBadge = s.patientMode === 'adult' ? 'Adult' : `Ped · ${BROSELOW[s.broselowIdx].name}`;
  const typeBadge = ARREST_TYPES.find(t => t.id === s.arrestType)?.label || 'Medical';
  const showCycle = s.cprStartedAt != null && s.status !== 'arrived' && s.status !== 'terminated';

  return (
    <div className="phase-bar" style={{
      background: colors.c, color: colors.textOn,
      padding: '14px 16px 12px', position: 'relative',
      paddingTop: 'max(14px, env(safe-area-inset-top))',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 12, justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="mono" style={{
            fontSize: 48, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.02em',
          }}>{fmtMMSS(s.elapsed)}</div>
          <div style={{
            fontSize: 12, marginTop: 4, opacity: 0.95, fontWeight: 500, letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{statusLabel}</span>
            {showCycle && (
              <span style={{
                background: 'rgba(255,255,255,0.22)', padding: '1px 7px', borderRadius: 6,
                fontWeight: 700, fontSize: 11, letterSpacing: '0.03em',
              }}>Cycle {cycle}</span>
            )}
            {showCycle && (
              <button onClick={() => set({ focusMode: true })} aria-label="Focus mode" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'rgba(255,255,255,0.16)', color: 'inherit',
                padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 10.5,
                letterSpacing: '0.04em', textTransform: 'uppercase',
                border: '1px solid rgba(255,255,255,0.25)',
              }}><Ic.Expand s={11} c="currentColor" /> Focus</button>
            )}
          </div>
        </div>
        <div style={{
          padding: '5px 9px', borderRadius: 8,
          background: 'rgba(255,255,255,0.18)',
          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em',
          textTransform: 'uppercase', textAlign: 'right',
        }}>
          <div>{modeBadge}</div>
          <div style={{ opacity: 0.85, marginTop: 2 }}>{typeBadge}</div>
          <LiveClock style={{
            display: 'block', marginTop: 4, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.02em', opacity: 0.95,
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Circular progress ring ──────────────────────────────
function ProgressRing({ size = 66, stroke = 6, fraction = 1, color = '#1f9d55', children, glow = false, breathe = false }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const off = C * (1 - Math.max(0, Math.min(1, fraction)));
  const uid = React.useMemo(() => 'rg' + Math.random().toString(36).slice(2, 8), []);
  // Lighten the stop color for a subtle gradient sweep
  const lighten = (hex) => {
    try {
      const n = parseInt(hex.slice(1), 16);
      let r2 = (n >> 16) + 50, g2 = ((n >> 8) & 255) + 40, b2 = (n & 255) + 40;
      r2 = Math.min(255, r2); g2 = Math.min(255, g2); b2 = Math.min(255, b2);
      return `#${((r2 << 16) | (g2 << 8) | b2).toString(16).padStart(6, '0')}`;
    } catch (e) { return color; }
  };
  return (
    <div className={breathe ? 'ring-breathe' : ''} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <defs>
          <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={lighten(color)} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#${uid})`} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
          style={{
            transition: 'stroke-dashoffset 0.95s linear, stroke 240ms ease',
            filter: glow ? `drop-shadow(0 0 5px ${color}aa)` : 'none',
          }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      }}>{children}</div>
    </div>
  );
}

// ─── Alert banner ────────────────────────────────────────
function AlertBanner() {
  const { s } = useStore();
  let banner = null;
  if (s.status === 'rosc') {
    banner = { tint: '#e8f6ee', deep: '#126e3b', bar: '#1f9d55', text: ROSC_ALERT.text, ref: '' };
  } else {
    const alert = SPECIAL_ALERTS[s.arrestType];
    if (alert) {
      banner = { tint: '#fff3e0', deep: '#9a4d05', bar: '#d97706', text: alert.text, ref: '' };
    }
  }
  if (!banner) return null;
  return (
    <div style={{
      background: banner.tint, color: banner.deep,
      borderLeft: `4px solid ${banner.bar}`,
      padding: '9px 14px', fontSize: 11.5, lineHeight: 1.4,
      display: 'flex', gap: 9, alignItems: 'flex-start',
    }}>
      <span style={{ marginTop: 1 }}><Ic.Warn s={13} c={banner.bar} /></span>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600 }}>{banner.text}</span>
        <span style={{ opacity: 0.7, marginLeft: 6, fontSize: 10.5, fontWeight: 500 }}>{banner.ref}</span>
      </div>
    </div>
  );
}

// ─── Sub-timers (Epi + Pulse-cycle ring) ─────────────────
function SubTimers() {
  const { s, set, setS, cycle } = useStore();

  const adminEpi = () => {
    if (s.cprStartedAt == null) return;
    // Hard gate: no drug without a route — open Access instead
    if (Object.keys(s.vascular).length === 0) {
      set({ accessOverlay: true, epiOverlay: false, pulseCheckOverlay: false, pulseCheckPausedAt: null });
      return;
    }
    set({ epiOverlay: !s.epiOverlay });
  };

  // Epi timer
  const epiSec = s.epiLastAt == null ? null : (s.elapsed - s.epiLastAt);
  let epiBg = 'var(--card)', epiFg = 'var(--ink)', epiBorder = 'var(--line)', epiCrit = false, epiWarn = false;
  if (epiSec != null) {
    if (epiSec >= 300)      { epiBg = '#dc2626'; epiFg = '#fff'; epiBorder = '#dc2626'; epiCrit = true; }
    else if (epiSec >= 180) { epiBg = '#fff3e0'; epiFg = '#9a4d05'; epiBorder = '#d97706'; epiWarn = true; }
  }
  const epiValue = epiSec == null ? '—:—' : fmtMMSS(epiSec);
  const epiSub = epiSec == null ? 'tap to give Epi' : (epiSec >= 300 ? 'OVERDUE — give now' : epiSec >= 180 ? 'due — give now' : 'since last Epi');

  // Pulse check countdown — frozen when overlay is open
  const pulseElapsed = s.pulseCheckPausedAt != null
    ? (s.pulseCheckPausedAt - s.pulseCheckResetAt)
    : (s.elapsed - s.pulseCheckResetAt);
  const pulseRemain = Math.max(0, 120 - pulseElapsed);
  const fraction = pulseRemain / 120;
  const paused = s.pulseCheckOverlay;

  let ringColor = '#1f9d55', ringText = 'var(--ink)', ringBg = 'var(--card)', ringBorder = 'var(--line)';
  let ringCrit = false, ringWarn = false;
  if (paused)                 { ringColor = '#2563eb'; ringText = '#1746a8'; ringBg = '#e6efff'; ringBorder = '#2563eb'; }
  else if (pulseRemain <= 0)  { ringColor = '#dc2626'; ringText = '#fff'; ringBg = '#dc2626'; ringBorder = '#dc2626'; ringCrit = true; }
  else if (pulseRemain <= 20) { ringColor = '#d97706'; ringText = '#9a4d05'; ringBg = '#fff3e0'; ringBorder = '#d97706'; ringWarn = true; }

  const togglePulse = () => {
    if (s.pulseCheckOverlay) set({ pulseCheckOverlay: false, pulseCheckPausedAt: null });
    else set({ pulseCheckOverlay: true, pulseCheckPausedAt: s.elapsed });
  };

  const disabledEpi = s.cprStartedAt == null;
  const disabledPulse = s.cprStartedAt == null && !s.pulseCheckOverlay;

  return (
    <div style={{ display: 'flex', gap: 8, padding: '10px 12px 0', alignItems: 'stretch' }}>
      {/* Epi timer */}
      <button onClick={disabledEpi ? null : adminEpi} disabled={disabledEpi}
        className={epiCrit ? 'critical' : (epiWarn ? 'warnpulse' : '')}
        style={{
          flex: 1, background: disabledEpi ? 'var(--line-2)' : epiBg,
          color: disabledEpi ? 'var(--ink-3)' : epiFg,
          border: `1.5px solid ${disabledEpi ? 'var(--line)' : epiBorder}`,
          borderRadius: 14, padding: '11px 12px', minHeight: 92,
          textAlign: 'left', cursor: disabledEpi ? 'default' : 'pointer',
          transition: 'background 240ms ease, color 240ms ease, border-color 240ms ease',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.78 }}>Epi timer</div>
        <div className="mono" style={{ fontSize: 30, fontWeight: 700, marginTop: 3, letterSpacing: '-0.01em' }}>{epiValue}</div>
        <div style={{ fontSize: 10.5, marginTop: 3, opacity: 0.85, fontWeight: 600 }}>{epiSub}</div>
      </button>

      {/* Pulse-cycle ring */}
      <button onClick={disabledPulse ? null : togglePulse} disabled={disabledPulse}
        className={ringCrit ? 'critical' : (ringWarn ? 'warnpulse' : '')}
        style={{
          flex: 1, background: ringBg, color: ringText,
          border: `1.5px solid ${ringBorder}`,
          borderRadius: 14, padding: '10px 10px', minHeight: 92,
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'background 240ms ease, color 240ms ease, border-color 240ms ease',
          cursor: disabledPulse ? 'default' : 'pointer',
        }}>
        <div className={(s.cprStartedAt != null && !paused && s.status !== 'terminated' && s.status !== 'arrived') ? 'cadence' : ''}
             style={{ '--cad': ringColor + '88', display: 'flex' }}>
          <ProgressRing size={68} stroke={7} fraction={paused ? 1 : fraction} color={ringColor}
            glow={ringWarn || ringCrit || (!paused && fraction < 1)} breathe={!paused && !ringCrit}>
            <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: ringText }}>
              {fmtMMSS(pulseRemain)}
            </div>
            <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {s.cprStartedAt == null ? '2:00' : `cyc ${cycle}`}
            </div>
          </ProgressRing>
        </div>
        <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.78 }}>
            Pulse check
          </div>
          <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600, opacity: 0.9, lineHeight: 1.25 }}>
            {paused ? 'paused — tap to resume'
              : pulseRemain <= 0 ? 'check now'
              : s.cprStartedAt == null ? 'starts with CPR'
              : 'tap to check now'}
          </div>
        </div>
      </button>
    </div>
  );
}

// ─── Primary action button ───────────────────────────────
function PrimaryBtn({ tint, fg, icon, label, sublabel, onClick, badge, locked }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, background: tint, color: fg,
      border: `1px solid ${fg}22`,
      borderRadius: 14, padding: '12px 8px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4, minHeight: 78, position: 'relative',
      opacity: locked ? 0.62 : 1,
    }}>
      {locked && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0.7,
        }}><Ic.Lock s={12} c={fg} /></div>
      )}
      {badge && !locked && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: fg, color: tint, fontSize: 10, fontWeight: 700,
          padding: '2px 6px', borderRadius: 99, lineHeight: 1,
        }}>{badge}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 500, marginTop: -2 }}>{sublabel}</div>
      )}
    </button>
  );
}

// ─── Primary actions row (Epi / Shock / Pulse / Airway / Access) ──
function PrimaryActions() {
  const { s, set, setS, logEvent } = useStore();

  const doEpi = () => {
    if (s.cprStartedAt == null) return;
    // Hard gate: no drug without a route — open Access instead
    if (Object.keys(s.vascular).length === 0) {
      set({ accessOverlay: true, epiOverlay: false, pulseCheckOverlay: false, pulseCheckPausedAt: null });
      return;
    }
    set({ epiOverlay: !s.epiOverlay, pulseCheckOverlay: false, pulseCheckPausedAt: null, accessOverlay: false });
  };
  const confirmEpi = () => {
    setS(prev => {
      const newCount = prev.epiCount + 1;
      const dose = prev.patientMode === 'pediatric'
        ? BROSELOW[prev.broselowIdx].epi
        : '1 mg IV/IO (1:10,000)';
      return {
        ...prev,
        epiLastAt: prev.elapsed,
        epiCount: newCount,
        showTraumaticEpiConfirm: false,
        medsLog: [...prev.medsLog, { name: 'Epinephrine', dose, t: prev.elapsed, type: 'epi' }],
        log: [...prev.log, {
          t: prev.elapsed,
          action: `Epinephrine #${newCount} given`,
          detail: dose,
          kind: 'med',
        }],
      };
    });
  };

  const doShock = () => set({ activeTab: 'rhythm', flashTab: 'rhythm' });
  const doPulse = () => {
    if (s.pulseCheckOverlay) {
      set({ pulseCheckOverlay: false, pulseCheckPausedAt: null });
    } else {
      set({ pulseCheckOverlay: true, pulseCheckPausedAt: s.elapsed, accessOverlay: false });
    }
  };
  const doAirway = () => set({ activeTab: 'airway', flashTab: 'airway' });
  const doAccess = () => set({ accessOverlay: !s.accessOverlay, pulseCheckOverlay: false, pulseCheckPausedAt: null });

  const airwayDone = s.airwayLog.length > 0;
  const accessDone = Object.keys(s.vascular).length > 0;

  // Smaller button variant for the 3-col row
  const SmallBtn = ({ tint, fg, icon, label, sublabel, onClick, badge }) => (
    <button onClick={onClick} style={{
      flex: 1, background: tint, color: fg,
      border: `1px solid ${fg}22`,
      borderRadius: 12, padding: '10px 6px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 3, minHeight: 70, position: 'relative',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: 5, right: 5,
          background: fg, color: tint, fontSize: 9, fontWeight: 700,
          padding: '2px 5px', borderRadius: 99, lineHeight: 1,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>{badge}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em' }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 9.5, opacity: 0.7, fontWeight: 500, marginTop: -1 }}>{sublabel}</div>
      )}
    </button>
  );

  return (
    <>
      {/* Row 1 — the two most urgent push-button interventions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, padding: '8px 12px 0' }}>
        <PrimaryBtn
          tint={s.cprStartedAt == null ? '#f1f3f6' : '#fdecec'} fg={s.cprStartedAt == null ? '#9ca3af' : '#991111'}
          icon={<Ic.Pill s={26} c={s.cprStartedAt == null ? '#9ca3af' : '#dc2626'} />}
          label={s.epiCount === 0 ? 'EPI' : `EPI ${s.epiCount}`}
          sublabel={
            s.cprStartedAt == null ? 'start CPR first'
            : Object.keys(s.vascular).length === 0 ? 'needs IV/IO access'
            : (s.epiCount === 0 ? 'first dose' : `${s.epiCount} given`)
          }
          locked={s.cprStartedAt != null && Object.keys(s.vascular).length === 0}
          onClick={doEpi}
        />
        <PrimaryBtn
          tint="#fff3e0" fg="#9a4d05"
          icon={<Ic.Bolt s={26} c="#d97706" />}
          label="SHOCK"
          sublabel={s.shocks.length > 0 ? `${s.shocks.length} delivered` : 'select joules'}
          onClick={doShock}
        />
      </div>
      {/* Row 2 — check + secure */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, padding: '7px 12px 0' }}>
        <SmallBtn
          tint="#e6efff" fg="#1746a8"
          icon={<Ic.Heart s={22} c="#2563eb" />}
          label="PULSE"
          sublabel="check"
          onClick={doPulse}
        />
        <SmallBtn
          tint="#e8f6ee" fg="#126e3b"
          icon={<Ic.Lungs s={22} c="#1f9d55" />}
          label="AIRWAY"
          sublabel={airwayDone ? `${s.airwayLog.length} logged` : 'tap to log'}
          onClick={doAirway}
          badge={airwayDone ? <Ic.Check s={10} c="#e8f6ee" /> : null}
        />
        <SmallBtn
          tint="#f3ecff" fg="#5b21b6"
          icon={<Ic.Drop s={22} c="#7c3aed" />}
          label="ACCESS"
          sublabel={accessDone ? Object.keys(s.vascular).map(k => k.toUpperCase()).join('·') : 'IV / IO'}
          onClick={doAccess}
          badge={accessDone ? <Ic.Check s={10} c="#f3ecff" /> : null}
        />
      </div>
      {s.showTraumaticEpiConfirm && <TraumaticEpiConfirm onConfirm={confirmEpi} onCancel={() => set({ showTraumaticEpiConfirm: false })} />}
    </>
  );
}

function TraumaticEpiConfirm({ onConfirm, onCancel }) {
  return (
    <div style={{
      margin: '8px 12px 0', padding: 12, background: '#fff3e0',
      borderLeft: '4px solid #d97706', borderRadius: 10, fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: '#9a4d05', marginBottom: 4 }}>
        Traumatic arrest — confirm Epi?
      </div>
      <div style={{ color: '#9a4d05', marginBottom: 9, lineHeight: 1.4 }}>
        Epi withheld if exsanguination suspected (local protocol).
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '9px', borderRadius: 8, background: 'var(--card)', color: '#9a4d05',
          border: '1px solid #d9770655', fontWeight: 600, fontSize: 13,
        }}>Cancel</button>
        <button onClick={onConfirm} style={{
          flex: 1, padding: '9px', borderRadius: 8, background: '#d97706', color: '#fff',
          fontWeight: 700, fontSize: 13,
        }}>Confirm dose</button>
      </div>
    </div>
  );
}

// ─── Pulse check overlay ─────────────────────────────────
function PulseCheckOverlay() {
  const { s, set, setS, logEvent } = useStore();

  const pauseDuration = '10s'; // illustrative — modelled as quick check

  if (!s.pulseCheckOverlay) return null;

  const present = () => {
    setS(prev => ({
      ...prev,
      pulseCheckOverlay: false,
      pulseCheckPausedAt: null,
      status: 'rosc',
      roscAt: prev.elapsed,
      pulseCheckResetAt: prev.elapsed,
      log: [...prev.log, {
        t: prev.elapsed,
        action: 'Pulse check — PULSE PRESENT',
        detail: `Paused ${pauseDuration} · ROSC achieved`,
        kind: 'rosc',
      }],
    }));
  };

  const absent = () => {
    setS(prev => ({
      ...prev,
      pulseCheckOverlay: false,
      pulseCheckPausedAt: null,
      pulseCheckResetAt: prev.elapsed,
      log: [...prev.log, {
        t: prev.elapsed,
        action: 'Pulse check — no pulse',
        detail: `Paused ${pauseDuration} · CPR resumed`,
        kind: 'event',
      }],
    }));
  };

  return (
    <div className="slide-in" style={{
      margin: '8px 12px 0', padding: 14, background: 'var(--card)',
      border: '2px solid #2563eb', borderRadius: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 9,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#1746a8',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Ic.Heart s={16} c="#2563eb" />
          CPR paused — checking pulse
        </div>
        <button onClick={() => set({ pulseCheckOverlay: false, pulseCheckPausedAt: null })}
          style={{
            width: 28, height: 28, borderRadius: 99, background: 'var(--line-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Ic.X s={13} c="#3a4252" />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={present} style={{
          background: '#1f9d55', color: '#fff', padding: '16px 8px',
          borderRadius: 12, fontSize: 14, fontWeight: 700, lineHeight: 1.2,
        }}>
          Pulse<br />present
        </button>
        <button onClick={absent} style={{
          background: '#dc2626', color: '#fff', padding: '16px 8px',
          borderRadius: 12, fontSize: 14, fontWeight: 700, lineHeight: 1.2,
        }}>
          No<br />pulse
        </button>
      </div>
    </div>
  );
}

// ─── Epi decision overlay (Given vs Withheld) ────────────
function EpiOverlay() {
  const { s, set, setS } = useStore();
  if (!s.epiOverlay) return null;

  const dose = s.patientMode === 'pediatric'
    ? BROSELOW[s.broselowIdx].epi
    : '1 mg IV/IO (1:10,000)';

  const isTraumatic = s.arrestType === 'traumatic';

  const give = () => {
    setS(prev => {
      const n = prev.epiCount + 1;
      return {
        ...prev,
        epiOverlay: false,
        epiLastAt: prev.elapsed,
        epiCount: n,
        medsLog: [...prev.medsLog, { name: 'Epinephrine', dose, t: prev.elapsed, type: 'epi' }],
        log: [...prev.log, { t: prev.elapsed, action: `Epinephrine #${n} given`, detail: dose, kind: 'med' }],
      };
    });
  };

  const withhold = () => {
    setS(prev => ({
      ...prev,
      epiOverlay: false,
      epiLastAt: prev.elapsed, // reset cycle so timer doesn't stay red
      log: [...prev.log, {
        t: prev.elapsed,
        action: 'Epi withheld this cycle',
        detail: isTraumatic
          ? 'Traumatic arrest — exsanguination concern (local protocol)'
          : 'Provider decision · cycle reset',
        kind: 'med',
      }],
    }));
  };

  return (
    <div className="slide-in" style={{
      margin: '8px 12px 0', padding: 14, background: 'var(--card)',
      border: '2px solid #dc2626', borderRadius: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 9,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#991111',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Ic.Pill s={16} c="#dc2626" />
          Epinephrine — {dose}
        </div>
        <button onClick={() => set({ epiOverlay: false })} style={{
          width: 28, height: 28, borderRadius: 99, background: 'var(--line-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ic.X s={13} c="#3a4252" />
        </button>
      </div>
      {isTraumatic && (
        <div style={{
          fontSize: 11.5, color: '#9a4d05', background: '#fff3e0',
          padding: '7px 10px', borderRadius: 8, marginBottom: 9,
          display: 'flex', gap: 6, alignItems: 'flex-start',
        }}>
          <Ic.Warn s={12} c="#d97706" />
          <span>Withhold if exsanguination suspected · local protocol</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={give} style={{
          background: '#1f9d55', color: '#fff', padding: '16px 8px',
          borderRadius: 12, fontSize: 14, fontWeight: 700, lineHeight: 1.2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <Ic.Check s={20} c="#fff" />
          Epi given
        </button>
        <button onClick={withhold} style={{
          background: '#dc2626', color: '#fff', padding: '16px 8px',
          borderRadius: 12, fontSize: 14, fontWeight: 700, lineHeight: 1.2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <Ic.X s={20} c="#fff" />
          No Epi
        </button>
      </div>
      <div style={{
        fontSize: 10.5, color: 'var(--ink-3)', marginTop: 8, textAlign: 'center',
      }}>
        {s.epiCount > 0 && `Doses given: ${s.epiCount} · `}Cycle resets either way
      </div>
    </div>
  );
}

// ─── Access overlay (IV / IO) ────────────────────────────
function AccessOverlay() {
  const { s, set, setS } = useStore();
  const [editing, setEditing] = React.useState(null); // 'iv' | 'io' | null

  if (!s.accessOverlay) return null;

  const startAccess = (kind) => {
    setS(prev => ({
      ...prev,
      vascular: {
        ...prev.vascular,
        [kind]: prev.vascular[kind] || { t: prev.elapsed, size: '', location: '' },
      },
      log: prev.vascular[kind] ? prev.log : [...prev.log, {
        t: prev.elapsed,
        action: `${kind.toUpperCase()} access obtained`,
        detail: kind === 'io' ? 'Intraosseous' : 'Intravenous',
        kind: 'airway',
      }],
    }));
    setEditing(kind);
  };

  const updateField = (kind, field, val) => {
    setS(prev => {
      const cur = prev.vascular[kind] || {};
      const next = { ...cur, [field]: val };
      return {
        ...prev,
        vascular: { ...prev.vascular, [kind]: next },
      };
    });
  };

  const updateFieldMaybeClose = (kind, field, val) => {
    setS(prev => {
      const cur = prev.vascular[kind] || {};
      const next = { ...cur, [field]: val };
      const both = !!(next.size && next.location);
      const updated = {
        ...prev,
        vascular: { ...prev.vascular, [kind]: next },
      };
      if (both) {
        updated.accessOverlay = false;
        updated.log = [...prev.log, {
          t: prev.elapsed,
          action: `${kind.toUpperCase()} details: ${next.size} · ${next.location}`,
          detail: 'Access fully documented',
          kind: 'airway',
        }];
      }
      return updated;
    });
  };

  const close = () => set({ accessOverlay: false });

  const ivData = s.vascular.iv;
  const ioData = s.vascular.io;

  const sizes = {
    iv: IV_SIZES.map(x => x.label),
    io: IO_SIZES.map(x => x.label),
  };
  const locations = {
    iv: ['L AC', 'R AC', 'L hand', 'R hand', 'L forearm', 'R forearm', 'EJ'],
    io: ['L tibia', 'R tibia', 'L humerus', 'R humerus'],
  };

  const AccessChoice = ({ kind, label, data, accent }) => {
    const active = data != null;
    const expanded = editing === kind || (active && editing !== null && editing !== (kind === 'iv' ? 'io' : 'iv'));
    return (
      <div style={{
        borderRadius: 12, border: `1.5px solid ${active ? accent : 'var(--line)'}`,
        background: active ? `${accent}0d` : 'var(--card)',
        overflow: 'hidden',
      }}>
        <button onClick={() => { if (!active) startAccess(kind); }} style={{
          width: '100%', padding: '14px', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: active ? 'default' : 'pointer',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: active ? accent : `${accent}22`,
            color: active ? '#fff' : accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
          }}>{active ? <Ic.Check s={16} c="#fff" /> : label}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? accent : 'var(--ink)' }}>
              {kind === 'iv' ? 'IV — Intravenous' : 'IO — Intraosseous'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              {active
                ? `${fmtMMSS(data.t)}${data.size ? ' · ' + data.size : ''}${data.location ? ' · ' + data.location : ''}`
                : 'Tap to log access now'}
            </div>
          </div>
          {active
            ? <button onClick={(e) => { e.stopPropagation(); setEditing(editing === kind ? null : kind); }} style={{
                padding: '5px 10px', borderRadius: 6, background: 'var(--card)', border: `1px solid ${accent}44`,
                color: accent, fontSize: 11, fontWeight: 700,
              }}>{editing === kind ? 'Done' : 'Edit'}</button>
            : <Ic.ChevR s={14} c="#6b7280" />}
        </button>
        {active && editing === kind && (
          <div style={{
            padding: '0 14px 14px', borderTop: `1px solid ${accent}22`,
            paddingTop: 12, background: 'var(--card)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Size</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {sizes[kind].map(sz => {
                const c = vascSizeColor(kind, sz);
                const on = data.size === sz;
                return (
                  <button key={sz} onClick={() => updateFieldMaybeClose(kind, 'size', on ? '' : sz)} style={{
                    padding: '6px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
                    background: on ? c : `${c}14`,
                    color: on ? '#fff' : 'var(--ink-2)',
                    border: `1.5px solid ${on ? c : c + '66'}`,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 99, flexShrink: 0,
                      background: c, border: on ? '1px solid rgba(255,255,255,0.7)' : '1px solid rgba(0,0,0,0.12)',
                    }} />
                    {sz}
                  </button>
                );
              })}
              <input value={data.size || ''} onChange={e => updateField(kind, 'size', e.target.value)}
                placeholder="custom"
                style={{
                  padding: '6px 8px', borderRadius: 99, fontSize: 11.5,
                  border: '1px dashed var(--line)', width: 70, outline: 'none', textAlign: 'center',
                }} />
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Location</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
              {locations[kind].map(loc => (
                <button key={loc} onClick={() => updateFieldMaybeClose(kind, 'location', data.location === loc ? '' : loc)} style={{
                  padding: '6px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600,
                  background: data.location === loc ? accent : 'var(--card)',
                  color: data.location === loc ? '#fff' : 'var(--ink-2)',
                  border: `1px solid ${data.location === loc ? accent : 'var(--line)'}`,
                }}>{loc}</button>
              ))}
            </div>
            <input value={data.location || ''} onChange={e => updateField(kind, 'location', e.target.value)}
              placeholder="Other location…"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12,
                border: '1px solid var(--line)', outline: 'none', boxSizing: 'border-box',
              }} />
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6 }}>
              You can come back later — these details are optional at time of access.
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="slide-in" style={{
      margin: '8px 12px 0', padding: 14, background: '#f6f4ff',
      border: '2px solid #7c3aed', borderRadius: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#5b21b6',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Ic.Drop s={15} c="#7c3aed" />
          Vascular access
        </div>
        <button onClick={close} style={{
          width: 28, height: 28, borderRadius: 99, background: 'var(--card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ic.X s={13} c="#3a4252" />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AccessChoice kind="io" label="IO" data={ioData} accent="#7c3aed" />
        <AccessChoice kind="iv" label="IV" data={ivData} accent="#2563eb" />
      </div>
    </div>
  );
}

// ─── Phase decision row (ROSC / Transport / Terminate) ──
function PhaseDecision() {
  const { s, set, setS } = useStore();

  const doRosc = () => setS(prev => ({
    ...prev, status: 'rosc', roscAt: prev.elapsed,
    log: [...prev.log, { t: prev.elapsed, action: 'ROSC declared', detail: 'See post-ROSC checklist', kind: 'rosc' }],
  }));

  const doTransport = () => setS(prev => ({
    ...prev, status: 'transport', transportAt: prev.elapsed,
    log: [...prev.log, { t: prev.elapsed, action: 'Transport initiated', detail: 'Care continued en route', kind: 'event' }],
  }));

  const doArrive = () => setS(prev => ({
    ...prev,
    status: 'arrived',
    arrivedAt: prev.elapsed,
    activeTab: 'export',
    log: [...prev.log, {
      t: prev.elapsed,
      action: 'Arrived at hospital',
      detail: 'Resuscitation handed off · case closed',
      kind: 'event',
    }],
  }));

  const doTerminate = () => { setSheet(false); set({ showTerminateConfirm: true }); };

  const [sheet, setSheet] = React.useState(false);

  const terminated = s.status === 'terminated';
  const arrived = s.status === 'arrived';
  const rosc = s.status === 'rosc';
  const ended = terminated || arrived;

  const wrap = (fn) => () => { setSheet(false); fn(); };

  const SB = ({ bg, fg, label, sub, icon, onClick, dim }) => (
    <button onClick={dim ? null : onClick} className={dim ? 'dim' : ''} style={{
      background: bg, color: fg, borderRadius: 14,
      padding: '15px 12px', minHeight: 60, width: '100%',
      display: 'flex', alignItems: 'center', gap: 12,
      fontSize: 15, fontWeight: 800, letterSpacing: '0.02em', textAlign: 'left',
      boxShadow: dim ? 'none' : `0 6px 16px -6px ${bg}`,
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}
        {sub && <span style={{ display: 'block', fontSize: 11, fontWeight: 600, opacity: 0.85, marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );

  // Current outcome chip for the collapsed trigger
  const outcomeColor =
    rosc ? '#2563eb' : arrived ? '#4338ca' : terminated ? '#dc2626' :
    s.status === 'transport' ? '#eab308' : 'var(--ink)';

  return (
    <>
      <div style={{ padding: '7px 12px 0' }}>
        <button onClick={() => setSheet(true)} style={{
          width: '100%', minHeight: 44, borderRadius: 12,
          background: 'var(--card)', border: '1.5px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
          boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 4px 14px -8px rgba(16,24,40,0.10)',
        }}>
          <span style={{
            width: 9, height: 9, borderRadius: 99, background: outcomeColor, flexShrink: 0,
            boxShadow: `0 0 0 4px ${outcomeColor}22`,
          }} />
          <span style={{ flex: 1, textAlign: 'left', fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>
            {ended ? `Outcome: ${statusLabelShort(s)}` : 'Resuscitation outcome'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {ended ? 'View' : 'ROSC · Transport · End'}
          </span>
          <Ic.ChevR s={15} c="var(--ink-3)" />
        </button>
      </div>

      {sheet && (
        <div onClick={() => setSheet(false)} style={{
          position: 'absolute', inset: 0, zIndex: 90,
          background: 'rgba(8,11,18,0.5)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={(e) => e.stopPropagation()} className="sheet-rise" style={{
            width: '100%', background: 'var(--paper)',
            borderRadius: '20px 20px 0 0', padding: '10px 14px 22px',
            boxShadow: '0 -12px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--line)' }} />
            </div>
            <div style={{
              fontSize: 11, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase',
              letterSpacing: '0.08em', margin: '2px 4px 12px',
            }}>Resuscitation outcome</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <SB bg="#1f9d55" fg="#fff" label="ROSC" sub="Return of spontaneous circulation"
                  icon={<Ic.Heart s={18} c="#fff" />} onClick={wrap(doRosc)} dim={rosc || ended} />
              <SB bg="#eab308" fg="#1a1100" label="Transport" sub="Begin transport, care en route"
                  icon={<Ic.Truck s={18} c="#1a1100" />} onClick={wrap(doTransport)} dim={ended} />
              <SB bg="#4338ca" fg="#fff" label="Arrive at hospital" sub="Hand off · close case"
                  icon={<Ic.Hospital s={18} c="#fff" />} onClick={wrap(doArrive)} dim={ended} />
              <SB bg="#dc2626" fg="#fff" label="Terminate CPR" sub="End resuscitation efforts"
                  icon={<Ic.X s={15} c="#fff" />} onClick={doTerminate} dim={ended} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function statusLabelShort(s) {
  if (s.status === 'terminated') return 'Terminated';
  if (s.status === 'arrived')    return 'Arrived';
  if (s.status === 'rosc')       return 'ROSC';
  if (s.status === 'transport')  return 'Transporting';
  return 'Active';
}

// ─── Terminate confirmation ──────────────────────────────
function TerminateConfirm() {
  const { s, set, setS } = useStore();
  if (!s.showTerminateConfirm) return null;

  const confirm = () => {
    setS(prev => ({
      ...prev,
      status: 'terminated',
      terminatedAt: prev.elapsed,
      showTerminateConfirm: false,
      metronomeOn: false,
      log: [...prev.log, {
        t: prev.elapsed,
        action: 'Resuscitation terminated',
        detail: 'Per local protocol termination criteria',
        kind: 'terminate',
      }],
    }));
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, padding: 18, width: '100%',
        boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 99, background: '#fdecec',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Ic.Warn s={16} c="#dc2626" /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Terminate resuscitation?</div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 12 }}>
          Confirm all criteria met per local protocol:
        </div>
        <ul style={{
          margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.7,
        }}>
          <li>≥20 min EMS resuscitation</li>
          <li>Unwitnessed arrest</li>
          <li>No ROSC prior to transport</li>
        </ul>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => set({ showTerminateConfirm: false })} style={{
            flex: 1, padding: 12, borderRadius: 10, fontSize: 13.5, fontWeight: 600,
            background: 'var(--line-2)', color: 'var(--ink)',
          }}>Cancel</button>
          <button onClick={confirm} style={{
            flex: 1.3, padding: 12, borderRadius: 10, fontSize: 13.5, fontWeight: 700,
            background: '#dc2626', color: '#fff',
          }}>Terminate</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────
function TabBar() {
  const { s, set } = useStore();
  const tabs = ['cpr', 'airway', 'rhythm', 'meds', 'log', 'export'];
  const labels = { rhythm: 'Rhythm', meds: 'Meds', airway: 'Airway', cpr: 'CPR', log: 'Log', export: 'Export' };
  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid var(--line)',
      background: 'var(--card)', marginTop: 10,
      paddingLeft: 4, paddingRight: 4,
    }}>
      {tabs.map(t => {
        const active = s.activeTab === t;
        return (
          <button key={t} onClick={() => set({ activeTab: t })} style={{
            flex: 1, padding: '10px 4px 9px',
            borderBottom: active ? '2px solid #1f9d55' : '2px solid transparent',
            color: active ? 'var(--ink)' : 'var(--ink-3)',
            fontWeight: active ? 700 : 500, fontSize: 12, letterSpacing: '0.02em',
            transition: 'color 160ms ease, border-color 160ms ease',
          }}>{labels[t]}</button>
        );
      })}
    </div>
  );
}

// ─── 20-minute decision modal ────────────────────────────
function TwentyMinDecision() {
  const { s, set, setS } = useStore();
  if (!s.show20MinDecision) return null;

  const doTransport = () => setS(prev => ({
    ...prev,
    show20MinDecision: false,
    status: 'transport',
    transportAt: prev.elapsed,
    log: [...prev.log, { t: prev.elapsed, action: 'Transport initiated', detail: '20-min decision — transport chosen', kind: 'event' }],
  }));

  const doTerminate = () => setS(prev => ({
    ...prev,
    show20MinDecision: false,
    showTerminateConfirm: true,
  }));

  const doContinue = () => set({ show20MinDecision: false });

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, padding: 18, width: '100%',
        boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 99, background: '#ffedd5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Ic.Warn s={18} c="#ea580c" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#9a3412' }}>20 minutes on scene</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>local protocol · decision required</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 14 }}>
          On-scene resuscitation threshold reached. Choose the next action.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={doTransport} style={{
            padding: '14px', borderRadius: 12, background: '#eab308', color: '#1a1100',
            fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 10px rgba(234,179,8,0.35)',
          }}>
            <Ic.Truck s={18} c="#1a1100" /> Transport to hospital
          </button>
          <button onClick={doTerminate} style={{
            padding: '14px', borderRadius: 12, background: '#dc2626', color: '#fff',
            fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 10px rgba(220,38,38,0.35)',
          }}>
            <Ic.X s={14} c="#fff" /> Terminate CPR
          </button>
          <button onClick={doContinue} style={{
            padding: '11px', borderRadius: 12, background: 'var(--line-2)', color: 'var(--ink-2)',
            fontSize: 12.5, fontWeight: 600,
          }}>
            Continue CPR — decide later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Focus mode — arm's-length, giant-target view during compressions ──
function FocusEnterButton() {
  const { s, set } = useStore();
  if (s.cprStartedAt == null || s.status === 'terminated' || s.status === 'arrived') return null;
  return (
    <button onClick={() => set({ focusMode: true })} aria-label="Focus mode" style={{
      position: 'absolute', top: 'max(12px, env(safe-area-inset-top))', left: 12, zIndex: 5,
      width: 34, height: 34, borderRadius: 9,
      background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <Ic.Expand s={17} c="#fff" />
    </button>
  );
}

function FocusMode() {
  const { s, set, setS, cycle, phase } = useStore();
  const [pulsePanel, setPulsePanel] = React.useState(false);
  if (!s.focusMode) return null;

  const colors = PHASE_COLORS[phase] || PHASE_COLORS.green;
  const hasAccess = Object.keys(s.vascular).length > 0;

  // Pulse-cycle ring
  const pulseElapsed = s.elapsed - s.pulseCheckResetAt;
  const pulseRemain = Math.max(0, 120 - pulseElapsed);
  const fraction = pulseRemain / 120;
  let ringColor = '#1f9d55';
  if (pulseRemain <= 0) ringColor = '#dc2626';
  else if (pulseRemain <= 20) ringColor = '#d97706';

  const epiSec = s.epiLastAt == null ? null : (s.elapsed - s.epiLastAt);

  // Actions (direct, fast, fully logged)
  const giveEpi = () => {
    if (!hasAccess) { set({ focusMode: false, accessOverlay: true }); return; }
    if (s.arrestType === 'traumatic') { set({ focusMode: false, showTraumaticEpiConfirm: true }); return; }
    setS(prev => {
      const n = prev.epiCount + 1;
      const dose = prev.patientMode === 'pediatric' ? BROSELOW[prev.broselowIdx].epi : '1 mg IV/IO (1:10,000)';
      return { ...prev, epiLastAt: prev.elapsed, epiCount: n,
        medsLog: [...prev.medsLog, { name: 'Epinephrine', dose, t: prev.elapsed, type: 'epi' }],
        log: [...prev.log, { t: prev.elapsed, action: `Epinephrine #${n} given`, detail: dose, kind: 'med' }] };
    });
  };
  const giveShock = () => {
    setS(prev => {
      const n = prev.shocks.length + 1;
      const j = prev.lastJoules || 200;
      return { ...prev, shocks: [...prev.shocks, { j, t: prev.elapsed, n }],
        log: [...prev.log, { t: prev.elapsed, action: `Shock #${n} delivered`, detail: j === 'Sync' ? 'Synchronized' : `${j} J`, kind: 'shock' }] };
    });
  };
  const rotate = () => {
    setS(prev => ({ ...prev, lastRotationAt: prev.elapsed,
      compressorRotations: [...prev.compressorRotations, { name: prev.roles.compressor || `Rescuer ${prev.compressorRotations.length + 2}`, t: prev.elapsed }],
      log: [...prev.log, { t: prev.elapsed, action: 'Compressor rotated', detail: 'Focus mode', kind: 'cpr' }] }));
  };
  const pulsePresent = () => {
    setS(prev => ({ ...prev, status: 'rosc', roscAt: prev.elapsed, pulseCheckResetAt: prev.elapsed, focusMode: false,
      log: [...prev.log, { t: prev.elapsed, action: 'Pulse check — PULSE PRESENT', detail: 'ROSC achieved', kind: 'rosc' }] }));
  };
  const pulseAbsent = () => {
    setS(prev => ({ ...prev, pulseCheckResetAt: prev.elapsed,
      log: [...prev.log, { t: prev.elapsed, action: 'Pulse check — no pulse', detail: 'CPR resumed', kind: 'event' }] }));
    setPulsePanel(false);
  };

  const BigBtn = ({ bg, fg, icon, label, sub, onClick, locked }) => (
    <button onClick={onClick} style={{
      background: bg, color: fg, border: 'none', borderRadius: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 6, position: 'relative', opacity: locked ? 0.6 : 1,
      boxShadow: '0 8px 22px -8px rgba(0,0,0,0.6)',
    }}>
      {locked && <div style={{ position: 'absolute', top: 12, right: 12 }}><Ic.Lock s={18} c={fg} /></div>}
      {icon}
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.02em' }}>{label}</div>
      {sub && <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>{sub}</div>}
    </button>
  );

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80, background: '#070a0f',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'max(10px, env(safe-area-inset-top))',
      paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
    }}>
      {/* Top: elapsed + cycle + exit */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px 4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div className="mono" style={{ fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{fmtMMSS(s.elapsed)}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.c, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cycle {cycle}</div>
        </div>
        <button onClick={() => set({ focusMode: false })} style={{
          padding: '9px 14px', borderRadius: 11, background: 'rgba(255,255,255,0.14)',
          color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid rgba(255,255,255,0.2)',
        }}><Ic.Collapse s={15} c="#fff" /> Exit</button>
      </div>

      {/* Hero pulse ring */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
        <div className={pulseRemain > 0 ? 'cadence' : ''} style={{ '--cad': ringColor + '88', display: 'flex' }}>
          <ProgressRing size={150} stroke={12} fraction={fraction} color={ringColor} glow breathe={pulseRemain > 20}>
            <div className="mono" style={{ fontSize: 40, fontWeight: 800, color: '#fff' }}>{fmtMMSS(pulseRemain)}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa6b6', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
              {pulseRemain <= 0 ? 'check pulse' : 'to pulse check'}
            </div>
          </ProgressRing>
        </div>
      </div>

      {/* Action grid OR pulse-check panel */}
      {pulsePanel ? (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '6px 12px 12px' }}>
          <BigBtn bg="#1f9d55" fg="#fff" label="Pulse" sub="present → ROSC" icon={<Ic.Heart s={40} c="#fff" />} onClick={pulsePresent} />
          <BigBtn bg="#dc2626" fg="#fff" label="No pulse" sub="resume CPR" icon={<Ic.X s={38} c="#fff" />} onClick={pulseAbsent} />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10, padding: '6px 12px 12px' }}>
          <BigBtn bg="#7a1620" fg="#fff" label={s.epiCount === 0 ? 'EPI' : `EPI ${s.epiCount}`}
            sub={!hasAccess ? 'needs IV/IO' : (epiSec != null ? `last ${fmtMMSS(epiSec)}` : 'give 1 mg')}
            icon={<Ic.Pill s={40} c="#fff" />} onClick={giveEpi} locked={!hasAccess} />
          <BigBtn bg="#7a4a06" fg="#fff" label="SHOCK"
            sub={`${s.lastJoules || 200} J${s.shocks.length ? ` · ${s.shocks.length} given` : ''}`}
            icon={<Ic.Bolt s={40} c="#fff" />} onClick={giveShock} />
          <BigBtn bg="#123a6e" fg="#fff" label="PULSE" sub="check now"
            icon={<Ic.Heart s={38} c="#fff" />} onClick={() => setPulsePanel(true)} />
          <BigBtn bg="#0e5a3a" fg="#fff" label="ROTATE" sub="new compressor"
            icon={<Ic.Rotate s={36} c="#fff" />} onClick={rotate} />
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  StatusBar, AlertBanner, SubTimers, PrimaryActions, PulseCheckOverlay, AccessOverlay, EpiOverlay,
  PhaseDecision, TerminateConfirm, TwentyMinDecision, TabBar, FlowRibbon, InitialRhythmCheck,
  ProgressRing, FocusMode, FocusEnterButton,
});
