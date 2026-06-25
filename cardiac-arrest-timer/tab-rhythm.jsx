// tab-rhythm.jsx — Rhythm tab

function RhythmGridBtn({ label, color, active, locked, onClick, dim }) {
  return (
    <button onClick={dim ? null : onClick} className={dim ? 'dim' : ''} style={{
      background: active ? color : 'var(--card)',
      color: active ? '#fff' : color,
      border: `1.5px solid ${color}`,
      borderRadius: 12, padding: '14px 8px',
      fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
      minHeight: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      {label}
      {locked && (
        <span style={{ position: 'absolute', top: 6, right: 6 }}>
          <Ic.Lock s={11} c={active ? '#fff' : color} />
        </span>
      )}
    </button>
  );
}

const RHYTHMS = [
  { id: 'vf',       label: 'VF',           color: '#dc2626' },
  { id: 'pvt',      label: 'Pulseless VT', color: '#d97706' },
  { id: 'pea',      label: 'PEA',          color: '#2563eb' },
  { id: 'asystole', label: 'Asystole',     color: '#64748b' },
];

// ─── ETCO2 scroll wheel ──────────────────────────────────
// ─── Reusable value scroll wheel ─────────────────────────
function ScrollWheel({ value, onChange, min = 0, max = 99, step = 1, unit = '', accent = '#2563eb' }) {
  const ref = React.useRef(null);
  const itemH = 40;
  const items = React.useMemo(() => {
    const arr = [];
    for (let v = min; v <= max; v += step) arr.push(v);
    return arr;
  }, [min, max, step]);
  const idxOf = (v) => Math.round((v - min) / step);
  const settling = React.useRef(false);
  const settleTimer = React.useRef(null);

  React.useEffect(() => {
    if (ref.current && value != null && !settling.current) {
      ref.current.scrollTop = idxOf(value) * itemH;
    }
  }, [value]);

  React.useEffect(() => {
    if (ref.current && value != null) {
      ref.current.scrollTop = idxOf(value) * itemH;
    }
  }, []);

  const onScroll = () => {
    settling.current = true;
    clearTimeout(settleTimer.current);
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / itemH);
    const v = Math.max(min, Math.min(max, min + idx * step));
    if (v !== value) onChange(v);
    settleTimer.current = setTimeout(() => { settling.current = false; }, 100);
  };

  return (
    <div style={{
      position: 'relative', height: itemH * 5, borderRadius: 14,
      background: 'var(--paper)', overflow: 'hidden',
      border: '1px solid var(--line)',
    }}>
      {/* Filled selection band behind the centered value */}
      <div style={{
        position: 'absolute', top: itemH * 2, left: 8, right: 8,
        height: itemH, pointerEvents: 'none', borderRadius: 10,
        background: `${accent}1f`, border: `2px solid ${accent}`,
        zIndex: 0,
      }} />
      <div ref={ref} onScroll={onScroll} className="etco2-wheel" style={{
        position: 'relative', zIndex: 1,
        height: '100%', overflowY: 'scroll',
        scrollSnapType: 'y mandatory', scrollBehavior: 'smooth',
        paddingTop: itemH * 2, paddingBottom: itemH * 2,
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 28%, #000 72%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0%, #000 28%, #000 72%, transparent 100%)',
      }}>
        {items.map(n => {
          const sel = value === n;
          return (
            <div key={n} style={{
              height: itemH, lineHeight: itemH + 'px',
              scrollSnapAlign: 'center', textAlign: 'center',
              fontSize: sel ? 30 : 22, fontWeight: sel ? 800 : 600,
              fontFamily: "'JetBrains Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              color: sel ? accent : 'var(--ink-3)',
              opacity: sel ? 1 : 0.55,
              transition: 'color 120ms ease, font-size 120ms ease, opacity 120ms ease',
            }}>{n}</div>
          );
        })}
      </div>
      <div style={{
        position: 'absolute', right: 14, top: itemH * 2, zIndex: 2,
        height: itemH, lineHeight: itemH + 'px',
        fontSize: 11, fontWeight: 800, color: accent,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        pointerEvents: 'none',
      }}>{unit}</div>
    </div>
  );
}

// Backwards-compatible ETCO2 wheel
function Etco2Wheel({ value, onChange }) {
  return <ScrollWheel value={value} onChange={onChange} min={0} max={99} step={1} unit="mmHg" accent="#2563eb" />;
}

const RHYTHM_CHANGE = [
  { label: 'VF',           color: '#dc2626' },
  { label: 'Pulseless VT', color: '#d97706' },
  { label: 'PEA',          color: '#2563eb' },
  { label: 'Asystole',     color: 'var(--ink-3)' },
  { label: 'ROSC',         color: '#1f9d55' },
  { label: 'NSR',          color: '#0ea5e9' },
];

function RhythmTab() {
  const { s, set, setS, logEvent } = useStore();
  const [etco2Val, setEtco2Val] = React.useState('');
  const [bglVal, setBglVal] = React.useState('');

  const setInitial = (r) => {
    if (s.initialRhythm) return;
    setS(prev => ({
      ...prev,
      initialRhythm: r.id,
      rhythmHistory: [...prev.rhythmHistory, { rhythm: r.label, t: prev.elapsed }],
      log: [...prev.log, {
        t: prev.elapsed,
        action: `Initial rhythm: ${r.label}`,
        detail: 'Locked — first interpretation',
        kind: 'rhythm',
      }],
    }));
  };

  const logChange = (label) => {
    setS(prev => ({
      ...prev,
      currentRhythm: label,
      rhythmHistory: [...prev.rhythmHistory, { rhythm: label, t: prev.elapsed }],
      log: [...prev.log, {
        t: prev.elapsed,
        action: `Rhythm change: ${label}`,
        detail: 'Reassess Q2 min',
        kind: 'rhythm',
      }],
    }));
  };

  const toggleCause = (cause) => {
    setS(prev => {
      const cur = { ...prev.reversibleCauses };
      let action;
      if (cur[cause] != null) {
        delete cur[cause];
        action = `Cause un-checked: ${cause}`;
      } else {
        cur[cause] = prev.elapsed;
        action = `Cause addressed: ${cause}`;
      }
      return {
        ...prev,
        reversibleCauses: cur,
        log: [...prev.log, { t: prev.elapsed, action, detail: 'Reversible cause (H&T)', kind: 'event' }],
      };
    });
  };

  const logShock = (j) => {
    setS(prev => {
      const n = prev.shocks.length + 1;
      return {
        ...prev,
        shocks: [...prev.shocks, { j, t: prev.elapsed, n }],
        lastJoules: j,
        log: [...prev.log, {
          t: prev.elapsed,
          action: `Shock #${n} delivered`,
          detail: j === 'Sync' ? 'Synchronized cardioversion' : `${j} J · biphasic`,
          kind: 'shock',
        }],
      };
    });
  };

  const logBgl = (val) => {
    const v = parseFloat(val != null ? val : bglVal);
    if (Number.isNaN(v)) return;
    const low = v < 60;
    setS(prev => ({
      ...prev,
      glucoseReadings: [...prev.glucoseReadings, { v, t: prev.elapsed }],
      log: [...prev.log, {
        t: prev.elapsed,
        action: `Blood glucose ${v} mg/dL`,
        detail: low ? '⚠ Hypoglycemia — give D50 / dextrose'
          : v > 250 ? 'Hyperglycemia noted' : 'Within range',
        kind: 'glucose',
      }],
    }));
    setBglVal('');
  };

  const logEtco2 = () => {
    const v = parseFloat(etco2Val);
    if (Number.isNaN(v)) return;
    setS(prev => ({
      ...prev,
      etco2Readings: [...prev.etco2Readings, { v, t: prev.elapsed }],
      log: [...prev.log, {
        t: prev.elapsed,
        action: `ETCO2 ${v} mmHg`,
        detail: v < 10 ? '⚠ Below 10 — reassess CPR quality' : 'Recorded',
        kind: 'etco2',
      }],
    }));
    setEtco2Val('');
  };

  const showRev = s.initialRhythm === 'pea' || s.initialRhythm === 'asystole';
  const showEscalation = s.initialRhythm === 'vf' || s.initialRhythm === 'pvt';
  const etco2Float = parseFloat(etco2Val);
  const etco2Low = !Number.isNaN(etco2Float) && etco2Float < 10;
  const locked = s.initialRhythm != null;

  // ── Sections as variables so we can reorder ───────
  const initialRhythmSection = (
    <React.Fragment key="init">
      <div className="section-title">Initial rhythm
        {s.initialRhythm && (
          <span className="count" style={{ background: '#e8f6ee', color: '#126e3b' }}>
            <Ic.Lock s={10} c="#126e3b" /> locked: {RHYTHMS.find(r => r.id === s.initialRhythm)?.label}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        {RHYTHMS.map(r => (
          <RhythmGridBtn key={r.id} label={r.label} color={r.color}
                         active={s.initialRhythm === r.id}
                         locked={s.initialRhythm != null}
                         dim={s.initialRhythm != null && s.initialRhythm !== r.id}
                         onClick={() => setInitial(r)} />
        ))}
      </div>
    </React.Fragment>
  );

  const reversibleCausesSection = showRev && (
    <React.Fragment key="rev">
      <div className="section-title">Reversible causes (H&T)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {HT_CAUSES.map(cause => {
          const on = s.reversibleCauses[cause] != null;
          return (
            <button key={cause} onClick={() => toggleCause(cause)} style={{
              padding: '11px 6px', borderRadius: 10, fontSize: 11.5, fontWeight: 600, lineHeight: 1.2,
              background: on ? '#1f9d55' : 'var(--card)',
              color: on ? '#fff' : 'var(--ink-2)',
              border: `1px solid ${on ? '#1f9d55' : 'var(--line)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              minHeight: 44,
            }}>
              {on && <Ic.Check s={12} c="#fff" />}
              {cause}
            </button>
          );
        })}
      </div>
    </React.Fragment>
  );

  const shockEscalationSection = showEscalation && (
    <div key="esc" style={{ marginTop: 12 }}>
      <div style={{
        padding: '9px 12px',
        background: '#fff3e0', border: '1px solid #d9770644',
        borderLeft: '4px solid #d97706', borderRadius: 8,
        fontSize: 12, color: '#9a4d05', display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <Ic.Warn s={14} c="#d97706" />
        <span><b>Escalate energy each shock</b> · start lowest (AHA)</span>
      </div>
      <button onClick={() => setS(prev => ({
        ...prev, torsades: !prev.torsades,
        log: [...prev.log, { t: prev.elapsed, action: prev.torsades ? 'Torsades unflagged' : 'Torsades (polymorphic VT) flagged',
          detail: prev.torsades ? '' : 'Magnesium Sulfate 2 g · Amiodarone NOT indicated', kind: 'rhythm' }],
      }))} style={{
        width: '100%', marginTop: 7, padding: '11px 12px', borderRadius: 10,
        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        background: s.torsades ? '#0ea5e9' : 'var(--card)',
        border: `1.5px solid ${s.torsades ? '#0ea5e9' : 'var(--line)'}`,
        color: s.torsades ? '#fff' : 'var(--ink)',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          border: `2px solid ${s.torsades ? '#fff' : 'var(--ink-3)'}`,
          background: s.torsades ? 'rgba(255,255,255,0.25)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{s.torsades && <Ic.Check s={13} c="#fff" />}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Torsades (polymorphic VT)</div>
          <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 1 }}>
            Magnesium Sulfate 2 g IV/IO · Amiodarone not indicated
          </div>
        </div>
      </button>
    </div>
  );

  const rhythmChangeSection = (
    <React.Fragment key="change">
      <div className="section-title">Rhythm change
        {s.rhythmHistory.length > 0 && (
          <span className="count">{s.rhythmHistory.length}</span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {RHYTHM_CHANGE.map(r => {
          const active = s.currentRhythm === r.label;
          return (
            <button key={r.label} onClick={() => logChange(r.label)} style={{
              padding: '12px 4px', borderRadius: 10,
              background: active ? r.color : 'var(--card)',
              color: active ? '#fff' : r.color,
              border: `1.5px solid ${active ? r.color : r.color + '55'}`,
              fontSize: 12, fontWeight: 700, minHeight: 44,
            }}>{r.label}</button>
          );
        })}
      </div>
      {s.currentRhythm && (
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6, paddingLeft: 4 }}>
          Current: <b style={{ color: RHYTHM_CHANGE.find(r => r.label === s.currentRhythm)?.color }}>{s.currentRhythm}</b> · tap any button to update
        </div>
      )}
    </React.Fragment>
  );

  const defibSection = (
    <React.Fragment key="defib">
      <div className="section-title">Defibrillation
        {s.shocks.length > 0 && <span className="count">{s.shocks.length} shocks</span>}
      </div>
      {s.patientMode === 'pediatric' ? (
        <>
          <div className="card" style={{
            marginBottom: 7, padding: '8px 10px',
            background: '#e6efff', borderLeft: '4px solid #2563eb',
            fontSize: 11, color: '#1746a8', lineHeight: 1.4,
          }}>
            <b>Pediatric defib (700-P07):</b> {BROSELOW[s.broselowIdx].name} band · {BROSELOW[s.broselowIdx].wt} kg ref ·
            2 J/kg first shock, then 4 J/kg for subsequent shocks.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {pedJoules(BROSELOW[s.broselowIdx].wt).map(opt => {
              const active = s.lastJoules === opt.j;
              return (
                <button key={opt.jPerKg} onClick={() => logShock(opt.j)} style={{
                  padding: '10px 4px', borderRadius: 10,
                  background: active ? '#d97706' : '#fff',
                  color: active ? '#fff' : '#9a4d05',
                  border: `1.5px solid ${active ? '#d97706' : '#d9770655'}`,
                  fontSize: 12, fontWeight: 700, minHeight: 52,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 11, opacity: 0.85 }}>{opt.label}</span>
                  <span style={{ fontSize: 14, marginTop: 2 }}>{opt.j} J</span>
                </button>
              );
            })}
            <button onClick={() => logShock('Sync')} style={{
              padding: '10px 4px', borderRadius: 10,
              background: s.lastJoules === 'Sync' ? '#d97706' : '#fff',
              color: s.lastJoules === 'Sync' ? '#fff' : '#9a4d05',
              border: `1.5px solid ${s.lastJoules === 'Sync' ? '#d97706' : '#d9770655'}`,
              fontSize: 13, fontWeight: 700, minHeight: 52,
            }}>Sync</button>
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[100, 150, 200, 300, 360, 'Sync'].map(j => {
            const active = s.lastJoules === j;
            return (
              <button key={j} onClick={() => logShock(j)} style={{
                padding: '13px 4px', borderRadius: 10,
                background: active ? '#d97706' : '#fff',
                color: active ? '#fff' : '#9a4d05',
                border: `1.5px solid ${active ? '#d97706' : '#d9770655'}`,
                fontSize: 13, fontWeight: 700, minHeight: 48,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                {j === 'Sync' ? 'Sync' : `${j} J`}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6, paddingLeft: 4 }}>
        Start lowest. Escalate each subsequent shock.
      </div>
    </React.Fragment>
  );

  const etco2Section = (
    <React.Fragment key="etco2">
      <div className="section-title">ETCO2 entry
        {s.etco2Readings.length > 0 && <span className="count">{s.etco2Readings.length}</span>}
      </div>
      <div className="card" style={{ border: '1px solid var(--line)' }}>
        <Etco2Wheel
          value={etco2Val === '' ? 30 : (parseInt(etco2Val) || 0)}
          onChange={(v) => setEtco2Val(String(v))}
        />
        <button onClick={logEtco2} style={{
          width: '100%', marginTop: 8, padding: '11px 18px', borderRadius: 10,
          background: 'var(--ink)', color: 'var(--paper)', fontSize: 13, fontWeight: 700,
        }}>Log ETCO2 {etco2Val !== '' ? `(${etco2Val} mmHg)` : ''}</button>
        <details style={{ marginTop: 8 }}>
          <summary style={{
            fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer',
            padding: '4px 0', userSelect: 'none', textAlign: 'center',
          }}>Manual entry</summary>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <input type="number" inputMode="numeric" value={etco2Val} onChange={(e) => setEtco2Val(e.target.value)}
                   placeholder="mmHg" style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--line)', fontSize: 13, fontWeight: 500, outline: 'none',
            }} />
            <button onClick={logEtco2} style={{
              padding: '10px 14px', borderRadius: 8, background: 'var(--ink-2)', color: 'var(--paper)',
              fontSize: 12, fontWeight: 700,
            }}>Log</button>
          </div>
        </details>
        {etco2Low && (
          <div style={{
            marginTop: 8, padding: '7px 10px', background: '#fdecec',
            color: '#991111', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Ic.Warn s={12} c="#dc2626" /> &lt;10 mmHg — reassess CPR quality
          </div>
        )}
        {s.etco2Readings.length > 0 && (
          <div style={{
            marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 5,
          }}>
            {s.etco2Readings.slice(-6).map((r, i) => (
              <div key={i} className="mono" style={{
                fontSize: 11, padding: '3px 7px', borderRadius: 6,
                background: r.v < 10 ? '#fdecec' : '#eef0f3',
                color: r.v < 10 ? '#991111' : '#3a4252', fontWeight: 600,
              }}>{r.v} @ {fmtMMSS(r.t)}</div>
            ))}
          </div>
        )}
      </div>
    </React.Fragment>
  );

  const bglFloat = parseFloat(bglVal);
  const bglLow = !Number.isNaN(bglFloat) && bglFloat < 60;
  const lastBgl = s.glucoseReadings[s.glucoseReadings.length - 1];

  const glucoseSection = (
    <React.Fragment key="glucose">
      <div className="section-title">Blood glucose
        {s.glucoseReadings.length > 0 && <span className="count">{s.glucoseReadings.length}</span>}
      </div>
      <div className="card" style={{ border: '1px solid var(--line)' }}>
        <ScrollWheel
          value={bglVal === '' ? 100 : (parseInt(bglVal) || 0)}
          onChange={(v) => setBglVal(String(v))}
          min={0} max={600} step={5}
          unit="mg/dL"
          accent={bglLow ? '#dc2626' : '#7c3aed'}
        />
        <button onClick={() => logBgl(bglVal === '' ? 100 : bglVal)} style={{
          width: '100%', marginTop: 8, padding: '11px 18px', borderRadius: 10,
          background: bglLow ? '#dc2626' : 'var(--ink)', color: 'var(--paper)', fontSize: 13, fontWeight: 700,
        }}>Log glucose ({bglVal === '' ? 100 : bglVal} mg/dL)</button>
        <details style={{ marginTop: 8 }}>
          <summary style={{
            fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer',
            padding: '4px 0', userSelect: 'none', textAlign: 'center',
          }}>Manual entry</summary>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <input type="number" inputMode="numeric" value={bglVal} onChange={(e) => setBglVal(e.target.value)}
                   placeholder="mg/dL" style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--line)', fontSize: 13, fontWeight: 500, outline: 'none',
              background: 'var(--card)', color: 'var(--ink)',
            }} />
            <button onClick={() => logBgl()} style={{
              padding: '10px 14px', borderRadius: 8, background: '#3a4252', color: '#fff',
              fontSize: 12, fontWeight: 700,
            }}>Log</button>
          </div>
        </details>
        {bglLow && (
          <div style={{
            marginTop: 8, padding: '7px 10px', background: '#fdecec',
            color: '#991111', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Ic.Warn s={12} c="#dc2626" /> &lt;60 mg/dL — hypoglycemia, give D50 / dextrose
          </div>
        )}
        {s.glucoseReadings.length > 0 && (
          <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {s.glucoseReadings.slice(-6).map((r, i) => (
              <div key={i} className="mono" style={{
                fontSize: 11, padding: '3px 7px', borderRadius: 6,
                background: r.v < 60 ? '#fdecec' : 'var(--line-2)',
                color: r.v < 60 ? '#991111' : 'var(--ink-2)', fontWeight: 600,
              }}>{r.v} @ {fmtMMSS(r.t)}</div>
            ))}
          </div>
        )}
      </div>
    </React.Fragment>
  );

  const etiologySection = (
    <React.Fragment key="etiology">
      <div className="section-title">Arrest etiology</div>
      <select value={s.etiology} onChange={(e) => {
        const v = e.target.value;
        setS(prev => ({
          ...prev, etiology: v,
          log: [...prev.log, { t: prev.elapsed, action: `Etiology: ${v}`, detail: 'Presumed cause', kind: 'info' }],
        }));
      }} style={{
        width: '100%', padding: '12px 12px', borderRadius: 10,
        border: '1px solid var(--line)', background: 'var(--card)', fontSize: 13,
        color: s.etiology ? 'var(--ink)' : 'var(--ink-3)',
      }}>
        <option value="">Select…</option>
        {ETIOLOGIES.map(e => <option key={e} value={e}>{e}</option>)}
      </select>
    </React.Fragment>
  );

  // ── Render order: when locked, rhythm change leads; initial rhythm sinks ──
  const sections = locked ? [
    rhythmChangeSection,
    shockEscalationSection,
    defibSection,
    reversibleCausesSection,
    etco2Section,
    glucoseSection,
    etiologySection,
    initialRhythmSection,
  ] : [
    initialRhythmSection,
    rhythmChangeSection,
    defibSection,
    etco2Section,
    glucoseSection,
    etiologySection,
  ];

  return (
    <div style={{ padding: '4px 12px 24px' }}>
      {sections.filter(Boolean)}
    </div>
  );
}

Object.assign(window, { RhythmTab, ScrollWheel });
