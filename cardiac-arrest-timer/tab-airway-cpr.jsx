// tab-airway-cpr.jsx — Airway and CPR tabs

function AirwayTab() {
  const { s, set, setS } = useStore();
  const ped = s.patientMode === 'pediatric';

  // Mode-aware airway ladder.
  //  • Adult: ETT first-line (ALS), then LMA → OPA; BVM ventilates 1:6.
  //  • Pediatric: supraglottic (LMA) first-line, then OPA; ETT is not a
  //    pediatric field step, so it is omitted. BVM ventilates 1:3.
  const interventions = React.useMemo(() => {
    let list = AIRWAY_INTERVENTIONS.map(it =>
      it.id === 'bvm' ? { ...it, label: ped ? 'BVM (1:3)' : 'BVM (1:6)' } : it
    );
    if (ped) {
      list = list.filter(it => it.id !== 'ett');
      const order = ['lma', 'opa', 'etco2', 'bvm', 'npa'];
      list = list.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    return list;
  }, [ped]);

  const [picker, setPicker] = React.useState(null); // 'intubation' | 'lma' | null
  const [pickerStep, setPickerStep] = React.useState('size');
  const [pickerData, setPickerData] = React.useState({});
  const [airwayMenu, setAirwayMenu] = React.useState(null); // logged item id being edited
  const [etco2Wheel, setEtco2Wheel] = React.useState(35);
  const pickerRef = React.useRef(null);
  const savedScroll = React.useRef(null);

  // Find the scrolling tab container (ancestor with overflow-y auto)
  const getScroller = (node) => {
    let el = node;
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return null;
  };

  // When picker or edit-menu opens or advances a step, lift it to the top of the visible area
  React.useEffect(() => {
    const panel = pickerRef.current;
    const open = picker || airwayMenu;
    if (open && panel) {
      const scroller = getScroller(panel);
      if (scroller) {
        if (savedScroll.current == null) savedScroll.current = scroller.scrollTop;
        // Measure after paint so the slide-in layout has settled
        requestAnimationFrame(() => {
          if (!pickerRef.current) return;
          const sRect = scroller.getBoundingClientRect();
          const pRect = pickerRef.current.getBoundingClientRect();
          // Bring the panel's top to ~16px below the scroller's top edge
          const delta = (pRect.top - sRect.top) - 16;
          scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: 'smooth' });
        });
      }
    } else if (!open && savedScroll.current != null) {
      const scroller = getScroller(document.querySelector('[data-airway-grid]'));
      if (scroller) scroller.scrollTo({ top: savedScroll.current, behavior: 'smooth' });
      savedScroll.current = null;
    }
  }, [picker, pickerStep, airwayMenu]);

  const logAirway = (it, extras = '') => {
    setS(prev => {
      if (prev.airwayLog.find(x => x.id === it.id)) return prev;
      const label = extras ? `${it.label} · ${extras}` : it.label;
      const noteAppend = it.note
        ? (prev.airwayNotes ? '\n' + it.note : it.note)
        : '';
      return {
        ...prev,
        airwayLog: [...prev.airwayLog, { id: it.id, label, t: prev.elapsed }],
        airwayNotes: prev.airwayNotes + noteAppend,
        log: [...prev.log, {
          t: prev.elapsed,
          action: `Airway: ${label}`,
          detail: extras ? extras : (it.note ? 'Template added to notes' : 'Established'),
          kind: 'airway',
        }],
      };
    });
  };

  const startPicker = (it) => {
    if (s.airwayLog.find(x => x.id === it.id)) return; // already logged
    if (it.picker === 'intubation') {
      setPicker('intubation');
      setPickerStep('size');
      setPickerData({ id: it.id, label: it.label, accent: it.accent });
    } else if (it.picker === 'lma' || it.picker === 'opa' || it.picker === 'npa') {
      setPicker(it.picker);
      setPickerStep('size');
      setPickerData({ id: it.id, label: it.label, accent: it.accent });
    } else if (it.picker === 'etco2') {
      setPicker('etco2');
      setPickerStep('value');
      setPickerData({ id: it.id, label: it.label, accent: it.accent });
    } else {
      logAirway(it);
    }
  };

  // Log ETCO2 from the airway wheel: records the reading AND marks the airway intervention
  const logEtco2Airway = (val) => {
    const v = parseInt(val, 10);
    if (Number.isNaN(v)) return;
    const it = AIRWAY_INTERVENTIONS.find(x => x.id === 'etco2');
    setS(prev => {
      const already = prev.airwayLog.find(x => x.id === 'etco2');
      const airwayLog = already
        ? prev.airwayLog.map(x => x.id === 'etco2' ? { ...x, label: `${it.label} · ${v} mmHg`, t: prev.elapsed } : x)
        : [...prev.airwayLog, { id: 'etco2', label: `${it.label} · ${v} mmHg`, t: prev.elapsed }];
      return {
        ...prev,
        airwayLog,
        etco2Readings: [...prev.etco2Readings, { v, t: prev.elapsed }],
        log: [...prev.log, {
          t: prev.elapsed,
          action: `ETCO2 ${v} mmHg`,
          detail: v < 10 ? '⚠ Below 10 — reassess CPR quality' : 'Waveform capnography',
          kind: 'etco2',
        }],
      };
    });
    setPicker(null);
    setPickerData({});
  };

  const pickSize = (size) => {
    if (picker === 'lma' || picker === 'opa' || picker === 'npa') {
      // Single-step: log immediately with size
      const it = AIRWAY_INTERVENTIONS.find(x => x.id === picker);
      logAirway(it, picker === 'npa' ? size : `Size ${size}`);
      setPicker(null);
      setPickerData({});
    } else if (picker === 'intubation') {
      setPickerData(d => ({ ...d, size }));
      setPickerStep('blade');
    }
  };

  const pickBlade = (blade) => {
    const it = AIRWAY_INTERVENTIONS.find(x => x.id === 'ett');
    const extras = `${pickerData.size} ET · ${blade}`;
    logAirway(it, extras);
    setPicker(null);
    setPickerData({});
  };

  const cancelPicker = () => {
    setPicker(null);
    setPickerData({});
    setPickerStep('size');
  };

  // ── Edit / redo / remove an already-logged airway ──
  const openPickerFor = (it) => {
    setAirwayMenu(null);
    if (it.picker === 'intubation') {
      setPicker('intubation'); setPickerStep('size'); setPickerData({ id: it.id, label: it.label, accent: it.accent });
    } else if (it.picker === 'lma' || it.picker === 'opa' || it.picker === 'npa') {
      setPicker(it.picker); setPickerStep('size'); setPickerData({ id: it.id, label: it.label, accent: it.accent });
    } else if (it.picker === 'etco2') {
      setPicker('etco2'); setPickerStep('value'); setPickerData({ id: it.id, label: it.label, accent: it.accent });
    }
  };

  const removeAirway = (it) => {
    setS(prev => ({
      ...prev,
      airwayLog: prev.airwayLog.filter(x => x.id !== it.id),
      log: [...prev.log, { t: prev.elapsed, action: `${it.label} removed`, detail: 'Entry cleared by provider', kind: 'airway' }],
    }));
    setAirwayMenu(null);
  };

  const redoAirway = (it) => {
    // Clear the existing entry, note the swap, then reopen the picker for a fresh size/blade
    setS(prev => ({
      ...prev,
      airwayLog: prev.airwayLog.filter(x => x.id !== it.id),
      log: [...prev.log, { t: prev.elapsed, action: `${it.label} re-done`, detail: 'Device exchanged / re-attempted', kind: 'airway' }],
    }));
    if (it.picker) openPickerFor(it);
    else setAirwayMenu(null);
  };

  // A done tile opens its edit menu; an undone tile opens its picker
  const tapAirway = (it) => {
    const done = s.airwayLog.find(x => x.id === it.id);
    if (done) {
      setPicker(null);
      setAirwayMenu(m => m === it.id ? null : it.id);
    } else {
      setAirwayMenu(null);
      startPicker(it);
    }
  };

  const logVascular = (kind) => {
    setS(prev => {
      if (prev.vascular[kind] != null) return prev;
      return {
        ...prev,
        vascular: { ...prev.vascular, [kind]: { t: prev.elapsed, size: '', location: '' } },
        log: [...prev.log, { t: prev.elapsed, action: `${kind.toUpperCase()} access obtained`, detail: 'Vascular', kind: 'airway' }],
      };
    });
    setVascEdit(kind);
  };

  const [vascEdit, setVascEdit] = React.useState(null); // 'iv' | 'io' | null

  const updateVasc = (kind, field, val) => {
    setS(prev => ({
      ...prev,
      vascular: { ...prev.vascular, [kind]: { ...prev.vascular[kind], [field]: val } },
    }));
  };

  // Mirror the main ACCESS overlay: pick size+location via chips; collapse when both done
  const updateVascMaybeClose = (kind, field, val) => {
    setS(prev => {
      const cur = prev.vascular[kind] || {};
      const next = { ...cur, [field]: val };
      const updated = { ...prev, vascular: { ...prev.vascular, [kind]: next } };
      if (next.size && next.location) {
        updated.log = [...prev.log, {
          t: prev.elapsed,
          action: `${kind.toUpperCase()} details: ${next.size} · ${next.location}`,
          detail: 'Access fully documented',
          kind: 'airway',
        }];
      }
      return updated;
    });
    const cur = s.vascular[kind] || {};
    if ((field === 'size' ? val : cur.size) && (field === 'location' ? val : cur.location)) {
      setVascEdit(null);
    }
  };

  const VASC_SIZES = {
    iv: IV_SIZES.map(x => x.label),
    io: IO_SIZES.map(x => x.label),
  };
  const VASC_LOCS = {
    iv: ['L AC', 'R AC', 'L hand', 'R hand', 'L forearm', 'R forearm', 'EJ'],
    io: ['L tibia', 'R tibia', 'L humerus', 'R humerus'],
  };

  const logProc = (label) => {
    setS(prev => ({
      ...prev,
      specialProcs: [...prev.specialProcs, { label, t: prev.elapsed }],
      log: [...prev.log, { t: prev.elapsed, action: label, detail: 'Procedure performed', kind: 'event' }],
    }));
  };

  const saveNotes = () => {
    setS(prev => ({
      ...prev,
      log: [...prev.log, { t: prev.elapsed, action: 'Airway notes saved', detail: prev.airwayNotes.slice(0, 60) + (prev.airwayNotes.length > 60 ? '…' : ''), kind: 'info' }],
    }));
  };

  return (
    <div style={{ padding: '4px 12px 24px' }}>
      <div className="section-title">Airway
        {s.airwayLog.length > 0 && <span className="count">{s.airwayLog.length}</span>}
      </div>
      <div style={{
        fontSize: 11, color: 'var(--ink-3)', margin: '-2px 4px 8px', lineHeight: 1.4,
      }}>
        {ped
          ? 'Supraglottic (LMA) first-line · OPA if SGA fails · ventilate 1:3'
          : 'ETT first-line · LMA, then OPA if attempts fail · ventilate 1:6'}
      </div>
      <div data-airway-grid style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {interventions.map(it => {
          const done = s.airwayLog.find(x => x.id === it.id);
          const accent = it.accent || it.dot;
          const active = (picker && pickerData.id === it.id) || airwayMenu === it.id;
          const detail = done && done.label.includes('·') ? done.label.split('·').slice(1).join('·').trim() : '';
          return (
            <button key={it.id} onClick={() => tapAirway(it)} style={{
              padding: '13px 12px', borderRadius: 14,
              background: done ? accent : (active ? `${accent}1a` : 'var(--card)'),
              border: done
                ? `2px solid ${accent}`
                : (active ? `2.5px solid ${accent}` : `2px solid ${accent}55`),
              minHeight: 78, textAlign: 'left',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8,
              color: done ? '#fff' : 'var(--ink)',
              boxShadow: done ? `0 4px 14px ${accent}44` : 'none',
              transition: 'transform 120ms ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: done ? 'rgba(255,255,255,0.22)' : it.tint,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {done
                    ? <Ic.Check s={17} c="#fff" />
                    : <div style={{ width: 11, height: 11, borderRadius: 99, background: accent }} />}
                </div>
                <span style={{
                  fontSize: 15, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em',
                }}>{it.label}</span>
              </div>
              {done ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
                  <div style={{ minWidth: 0 }}>
                    {detail && (
                      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail}</div>
                    )}
                    <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.9, marginTop: 1 }}>{fmtMMSS(done.t)}</div>
                  </div>
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                    background: 'rgba(255,255,255,0.22)', padding: '3px 7px', borderRadius: 99, flexShrink: 0,
                  }}>Edit</span>
                </div>
              ) : (
                <div style={{
                  fontSize: 11, fontWeight: 700, color: accent, opacity: 0.85,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {it.picker === 'etco2' ? 'Tap to enter' : it.picker ? 'Tap to size' : 'Tap to log'} <Ic.ChevR s={12} c={accent} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Edit menu for an already-logged airway (change / remove) */}
      {airwayMenu && (() => {
        const it = AIRWAY_INTERVENTIONS.find(x => x.id === airwayMenu);
        const done = s.airwayLog.find(x => x.id === airwayMenu);
        if (!it || !done) return null;
        const accent = it.accent || it.dot;
        return (
          <div ref={pickerRef} className="slide-in" style={{
            marginTop: 10, padding: 14, background: 'var(--card)',
            border: `2.5px solid ${accent}`, borderRadius: 16,
            boxShadow: `0 10px 30px ${accent}33`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{done.label}</div>
              <button onClick={() => setAirwayMenu(null)} style={{
                width: 30, height: 30, borderRadius: 99, background: 'var(--line-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ic.X s={14} c="var(--ink-2)" />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
              Logged at {fmtMMSS(done.t)} · was the device bad or repositioned?
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              {it.picker && (
                <button onClick={() => redoAirway(it)} style={{
                  flex: 1, padding: '15px 8px', borderRadius: 12, background: accent, color: '#fff',
                  fontSize: 14, fontWeight: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <Ic.Rotate s={20} c="#fff" />
                  Change / re-do
                </button>
              )}
              <button onClick={() => removeAirway(it)} style={{
                flex: 1, padding: '15px 8px', borderRadius: 12,
                background: 'var(--card)', color: '#dc2626', border: '2px solid #dc262655',
                fontSize: 14, fontWeight: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <Ic.X s={20} c="#dc2626" />
                Remove
              </button>
            </div>
          </div>
        );
      })()}

      {/* Chained picker for Intubation / LMA */}
      {picker && (
        <div ref={pickerRef} className="slide-in" style={{
          marginTop: 10, padding: 14, background: 'var(--card)',
          border: `2.5px solid ${pickerData.accent}`, borderRadius: 16,
          boxShadow: `0 10px 30px ${pickerData.accent}33`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <div style={{
                fontSize: 16, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap',
              }}>{pickerData.label}</div>
              <div style={{
                fontSize: 11, fontWeight: 800, color: pickerData.accent,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                background: `${pickerData.accent}1a`, padding: '4px 9px', borderRadius: 99,
              }}>
                {picker === 'intubation' && pickerStep === 'size' && 'Select ET size'}
                {picker === 'intubation' && pickerStep === 'blade' && `${pickerData.size} ET · select blade`}
                {picker === 'lma' && 'Select size'}
                {picker === 'opa' && 'Select OPA size'}
                {picker === 'npa' && 'Select NPA size'}
                {picker === 'etco2' && 'Scroll to value'}
              </div>
            </div>
            <button onClick={cancelPicker} style={{
              width: 30, height: 30, borderRadius: 99, background: 'var(--line-2)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ic.X s={14} c="var(--ink-2)" />
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {picker === 'intubation' && pickerStep === 'size' &&
              ETT_SIZES.map(sz => (
                <button key={sz} onClick={() => pickSize(sz)} style={{
                  flex: '1 1 calc(33.33% - 8px)', minWidth: 80,
                  padding: '18px 8px', borderRadius: 13,
                  background: `${pickerData.accent}12`, color: pickerData.accent,
                  border: `2px solid ${pickerData.accent}`,
                  fontSize: 20, fontWeight: 800, minHeight: 60,
                }}>{sz}</button>
              ))
            }
            {picker === 'intubation' && pickerStep === 'blade' &&
              ETT_BLADES.map(bl => (
                <button key={bl} onClick={() => pickBlade(bl)} style={{
                  flex: bl === 'Video scope' ? '1 1 100%' : '1 1 calc(33.33% - 8px)', minWidth: 80,
                  padding: '16px 8px', borderRadius: 13,
                  background: `${pickerData.accent}12`, color: pickerData.accent,
                  border: `2px solid ${pickerData.accent}`,
                  fontSize: 16, fontWeight: 800, minHeight: 56,
                }}>{bl}</button>
              ))
            }
            {picker === 'lma' &&
              LMA_SIZES.map(sz => (
                <button key={sz} onClick={() => pickSize(sz)} style={{
                  flex: 1, minWidth: 0,
                  padding: '20px 4px', borderRadius: 13,
                  background: `${pickerData.accent}12`, color: pickerData.accent,
                  border: `2px solid ${pickerData.accent}`,
                  fontSize: 22, fontWeight: 800, minHeight: 64,
                }}>{sz}</button>
              ))
            }
            {picker === 'opa' &&
              OPA_SIZES.map(sz => (
                <button key={sz} onClick={() => pickSize(sz)} style={{
                  flex: '1 1 calc(50% - 8px)', minWidth: 0,
                  padding: '16px 8px', borderRadius: 13,
                  background: `${pickerData.accent}12`, color: pickerData.accent,
                  border: `2px solid ${pickerData.accent}`,
                  fontSize: 16, fontWeight: 800, minHeight: 58,
                }}>{sz}</button>
              ))
            }
            {picker === 'npa' &&
              NPA_SIZES.map(sz => (
                <button key={sz} onClick={() => pickSize(sz)} style={{
                  flex: '1 1 calc(25% - 8px)', minWidth: 0,
                  padding: '14px 4px', borderRadius: 12,
                  background: `${pickerData.accent}12`, color: pickerData.accent,
                  border: `2px solid ${pickerData.accent}`,
                  fontSize: 15, fontWeight: 800, minHeight: 52,
                }}>{sz}</button>
              ))
            }
          </div>

          {picker === 'etco2' && (
            <div>
              <ScrollWheel
                value={etco2Wheel}
                onChange={(v) => setEtco2Wheel(v)}
                min={0} max={99} step={1} unit="mmHg"
                accent={etco2Wheel < 10 ? '#dc2626' : pickerData.accent}
              />
              {etco2Wheel < 10 && (
                <div style={{
                  marginTop: 8, padding: '7px 10px', background: '#fdecec',
                  color: '#991111', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Ic.Warn s={12} c="#dc2626" /> &lt;10 mmHg — reassess CPR quality
                </div>
              )}
              <button onClick={() => logEtco2Airway(etco2Wheel)} style={{
                width: '100%', marginTop: 10, padding: '15px 8px', borderRadius: 12,
                background: pickerData.accent, color: '#fff', fontSize: 15, fontWeight: 800,
              }}>Log ETCO2 ({etco2Wheel} mmHg)</button>
              <details style={{ marginTop: 8 }}>
                <summary style={{
                  fontSize: 11.5, color: 'var(--ink-3)', cursor: 'pointer',
                  padding: '6px 0', userSelect: 'none', textAlign: 'center', fontWeight: 600,
                }}>Manual entry</summary>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <input type="number" inputMode="numeric"
                    onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) setEtco2Wheel(Math.max(0, Math.min(99, n))); }}
                    placeholder="mmHg" style={{
                      flex: 1, padding: '11px 12px', borderRadius: 9,
                      border: '1px solid var(--line)', fontSize: 14, fontWeight: 600, outline: 'none',
                      background: 'var(--card)', color: 'var(--ink)',
                    }} />
                  <button onClick={() => logEtco2Airway(etco2Wheel)} style={{
                    padding: '11px 16px', borderRadius: 9, background: 'var(--ink)', color: 'var(--paper)',
                    fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
                  }}>Log</button>
                </div>
              </details>
            </div>
          )}

          {picker === 'intubation' && pickerStep === 'blade' && (
            <button onClick={() => setPickerStep('size')} style={{
              marginTop: 10, fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 700,
              padding: '9px 14px', borderRadius: 9, background: 'var(--line-2)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>← Back to ET size</button>
          )}
        </div>
      )}

      <div className="section-title">Vascular access</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['io', 'iv'].map(k => {
          const data = s.vascular[k];
          const done = data != null;
          const accent = k === 'iv' ? '#2563eb' : '#7c3aed';
          const editing = vascEdit === k;
          return (
            <div key={k} style={{
              borderRadius: 12,
              border: `1.5px solid ${done ? accent : '#e5e7eb'}`,
              background: done ? `${accent}0d` : '#fff',
              overflow: 'hidden',
            }}>
              <div
                role="button"
                onClick={() => { if (!done) logVascular(k); }}
                style={{
                  padding: 12, display: 'flex', alignItems: 'center', gap: 10,
                  cursor: done ? 'default' : 'pointer',
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: done ? accent : `${accent}22`,
                  color: done ? '#fff' : accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {done ? <Ic.Check s={14} c="#fff" /> : k.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: done ? accent : 'var(--ink)' }}>
                    {k === 'iv' ? 'IV — Intravenous' : 'IO — Intraosseous'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {done
                      ? `${fmtMMSS(data.t)}${data.size ? ' · ' + data.size : ''}${data.location ? ' · ' + data.location : ''}`
                      : 'Tap to log'}
                  </div>
                </div>
                {!done
                  ? <div style={{
                      fontSize: 12, fontWeight: 700, color: accent,
                      padding: '6px 12px', background: `${accent}12`, borderRadius: 8, flexShrink: 0,
                    }}>LOG</div>
                  : <button onClick={(e) => { e.stopPropagation(); setVascEdit(editing ? null : k); }} style={{
                      padding: '5px 10px', borderRadius: 6, background: 'var(--card)', border: `1px solid ${accent}44`,
                      color: accent, fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>{editing ? 'Done' : 'Edit'}</button>
                }
              </div>
              {done && editing && (
                <div style={{
                  padding: '0 12px 12px', borderTop: `1px solid ${accent}22`, paddingTop: 12,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Size</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    {VASC_SIZES[k].map(sz => {
                      const c = vascSizeColor(k, sz);
                      const on = data.size === sz;
                      return (
                        <button key={sz} onClick={() => updateVascMaybeClose(k, 'size', on ? '' : sz)} style={{
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
                    <input value={data.size || ''} onChange={e => updateVasc(k, 'size', e.target.value)}
                      placeholder="custom"
                      style={{
                        padding: '6px 8px', borderRadius: 99, fontSize: 11.5,
                        border: '1px dashed var(--line)', width: 72, outline: 'none', textAlign: 'center',
                      }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Location</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {VASC_LOCS[k].map(loc => (
                      <button key={loc} onClick={() => updateVascMaybeClose(k, 'location', data.location === loc ? '' : loc)} style={{
                        padding: '6px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600,
                        background: data.location === loc ? accent : 'var(--card)',
                        color: data.location === loc ? '#fff' : 'var(--ink-2)',
                        border: `1px solid ${data.location === loc ? accent : 'var(--line)'}`,
                      }}>{loc}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="section-title">Special procedures</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[
          'Bilateral pleural decompression (local protocol)',
          'Pelvic binding',
        ].map(p => {
          const done = s.specialProcs.find(x => x.label === p);
          return (
            <button key={p} onClick={() => done ? null : logProc(p)} style={{
              padding: '12px 14px', borderRadius: 12, textAlign: 'left',
              background: done ? '#e8f6ee' : '#fff',
              border: done ? '1.5px solid #1f9d55' : '1px solid var(--line)',
              fontSize: 13, fontWeight: 600,
              color: done ? '#126e3b' : 'var(--ink)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{p}</span>
              {done
                ? <span className="mono" style={{ fontSize: 11, color: '#126e3b' }}>{fmtMMSS(done.t)} <Ic.Check s={12} c="#1f9d55"/></span>
                : <Ic.ChevR s={14} c="#6b7280" />}
            </button>
          );
        })}
      </div>

      <div className="section-title">Details — add now or later</div>
      <div className="card" style={{ border: '1px solid var(--line)', padding: 10 }}>
        <textarea
          value={s.airwayNotes}
          onChange={(e) => set({ airwayNotes: e.target.value })}
          placeholder="Tube size, blade type, depth, attempts, confirmation method… fill during or after call"
          style={{
            width: '100%', minHeight: 90, padding: 10, borderRadius: 8,
            border: '1px solid var(--line)', fontSize: 12.5, lineHeight: 1.4,
            boxSizing: 'border-box', outline: 'none', color: 'var(--ink)',
          }}
        />
        <button onClick={saveNotes} style={{
          marginTop: 8, padding: '9px 14px', borderRadius: 8,
          background: 'var(--ink)', color: 'var(--paper)', fontSize: 12, fontWeight: 700,
        }}>Save notes</button>
      </div>
    </div>
  );
}

// ─── Team roles + compressor rotation ────────────────────
function TeamSection() {
  const { s, set, setS } = useStore();
  const onChest = s.cprStartedAt == null ? 0 : Math.max(0, s.elapsed - (s.lastRotationAt || 0));
  const fatigue = onChest >= 120;

  const rotate = () => {
    if (s.cprStartedAt == null) return;
    setS(prev => {
      const n = prev.compressorRotations.length + 1;
      const who = prev.roles.compressor || `Rescuer ${n + 1}`;
      return {
        ...prev,
        lastRotationAt: prev.elapsed,
        compressorRotations: [...prev.compressorRotations, { name: who, t: prev.elapsed }],
        log: [...prev.log, {
          t: prev.elapsed, action: 'Compressor rotated',
          detail: prev.roles.compressor ? `On chest: ${who}` : 'Fresh rescuer on chest',
          kind: 'cpr',
        }],
      };
    });
  };

  const setRole = (role, val) => set({ roles: { ...s.roles, [role]: val } });

  const ROLES = [
    { key: 'lead',       label: 'Team lead',  ph: 'Name / unit' },
    { key: 'compressor', label: 'Compressor', ph: 'Name / unit' },
    { key: 'airway',     label: 'Airway',     ph: 'Name / unit' },
    { key: 'meds',       label: 'Meds',       ph: 'Name / unit' },
  ];

  return (
    <>
      <div className="section-title">Team & compressor
        {s.compressorRotations.length > 0 && <span className="count">{s.compressorRotations.length} rotations</span>}
      </div>

      {/* Compressor rotation timer */}
      <div className={fatigue ? 'warnpulse' : ''} style={{
        background: fatigue ? '#ffedd5' : 'var(--card)',
        border: `1.5px solid ${fatigue ? '#ea580c' : 'var(--line)'}`,
        borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12,
        transition: 'background 240ms ease, border-color 240ms ease',
      }}>
        <ProgressRing size={58} stroke={5}
          fraction={s.cprStartedAt == null ? 1 : Math.max(0, 1 - onChest / 120)}
          color={fatigue ? '#ea580c' : '#1f9d55'}>
          <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: fatigue ? '#9a3412' : 'var(--ink)' }}>
            {fmtMMSS(onChest)}
          </div>
        </ProgressRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: fatigue ? '#9a3412' : 'var(--ink)' }}>
            Time on chest
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.35 }}>
            {fatigue ? 'Rotate now — fatigue reduces depth' : 'Rotate compressor every 2 min'}
          </div>
        </div>
        <button onClick={rotate} disabled={s.cprStartedAt == null} style={{
          padding: '11px 14px', borderRadius: 10, flexShrink: 0,
          background: s.cprStartedAt == null ? 'var(--line-2)' : '#1f9d55',
          color: s.cprStartedAt == null ? 'var(--ink-3)' : '#fff',
          fontSize: 12.5, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Ic.Rotate s={15} c={s.cprStartedAt == null ? 'var(--ink-3)' : '#fff'} /> Rotate
        </button>
      </div>

      {/* Role assignment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }}>
        {ROLES.map(r => (
          <div key={r.key} style={{
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px',
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.label}</div>
            <input value={s.roles[r.key]} onChange={e => setRole(r.key, e.target.value)} placeholder={r.ph}
              style={{
                width: '100%', marginTop: 4, padding: '6px 0', border: 'none', outline: 'none',
                background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--ink)',
              }} />
          </div>
        ))}
      </div>
    </>
  );
}

// ─── CPR tab ─────────────────────────────────────────────
function MetronomeBeat({ on, bpm }) {
  React.useEffect(() => {
    if (!on) return;
    let ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const interval = 60000 / bpm;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      } catch (e) {}
    };
    tick();
    const id = setInterval(tick, interval);
    return () => { alive = false; clearInterval(id); try { ctx.close(); } catch(e){} };
  }, [on, bpm]);
  return null;
}

function CPRTab() {
  const { s, set, setS } = useStore();

  const onsceneRemain = Math.max(0, 1200 - s.elapsed);
  const onsceneOver = s.elapsed >= 1200;

  const logCpr = (label) => {
    setS(prev => ({
      ...prev,
      cprEvents: [...prev.cprEvents, { label, t: prev.elapsed }],
      log: [...prev.log, { t: prev.elapsed, action: label, detail: 'CPR event', kind: 'cpr' }],
    }));
  };

  return (
    <div style={{ padding: '4px 12px 24px' }}>
      <div className="section-title">CPR events
        {s.cprEvents.length > 0 && <span className="count">{s.cprEvents.length}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
        {[
          { label: 'CPR start', color: '#1f9d55' },
          { label: 'CPR pause', color: '#eab308' },
          { label: 'Lucas',     color: '#2563eb' },
        ].map(({ label, color }) => {
          const dim = label === 'Lucas' && s.arrestType === 'traumatic';
          const done = s.cprEvents.filter(e => e.label === label).length;
          return (
            <button key={label} onClick={dim ? null : () => logCpr(label)}
                    className={dim ? 'dim' : ''}
                    style={{
              padding: '13px 6px', borderRadius: 12, minHeight: 58,
              background: done > 0 ? color : '#fff',
              color: done > 0 ? '#fff' : color,
              border: `1.5px solid ${color}`,
              fontSize: 12, fontWeight: 700,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            }}>
              <span>{label}</span>
              {done > 0 && <span style={{ fontSize: 10, opacity: 0.9, fontWeight: 600 }}>×{done}</span>}
            </button>
          );
        })}
      </div>
      {s.arrestType === 'traumatic' && (
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: '#fff3e0', borderLeft: '4px solid #d97706', borderRadius: 8,
          fontSize: 11.5, color: '#9a4d05',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <Ic.Warn s={13} c="#d97706" />
          <span><b>Lucas / mechanical CPR prohibited</b> in traumatic arrest (local protocol)</span>
        </div>
      )}

      <TeamSection />

      <div className="section-title">On-scene resuscitation timer</div>
      <div className="card" style={{
        border: '1px solid var(--line)',
        background: onsceneOver ? '#ffedd5' : '#fff',
        borderColor: onsceneOver ? '#ea580c' : 'var(--line)',
      }}>
        <div className="mono" style={{
          fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em',
          color: onsceneOver ? '#9a3412' : 'var(--ink)',
        }}>{fmtMMSS(s.elapsed)}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, fontWeight: 500 }}>
          On-scene resuscitation
        </div>
        <div style={{ fontSize: 10.5, color: onsceneOver ? '#9a3412' : 'var(--ink-3)', marginTop: 4 }}>
          {onsceneOver
            ? '⚠ Threshold passed — decide transport or terminate (local protocol)'
            : `${fmtMMSS(onsceneRemain)} until 20-min decision point`}
        </div>
        {onsceneOver && (
          <button onClick={() => set({ show20MinDecision: true })} style={{
            marginTop: 10, padding: '9px 14px', borderRadius: 8,
            background: '#ea580c', color: '#fff', fontSize: 12, fontWeight: 700,
          }}>Reopen decision</button>
        )}
      </div>

      {onsceneOver && (
        <div style={{
          marginTop: 10, padding: '11px 12px',
          background: '#ffedd5', borderLeft: '4px solid #ea580c', borderRadius: 8,
          fontSize: 12, color: '#9a3412', fontWeight: 600,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <Ic.Warn s={14} c="#ea580c" />
          <span>20 min reached — decide transport or terminate (local protocol)</span>
        </div>
      )}
    </div>
  );
}

function BeatDot({ on }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 99,
      background: on ? '#e8f6ee' : '#eef0f3',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className={on ? 'beat-dot on' : 'beat-dot'} style={{
        width: 18, height: 18, borderRadius: 99,
        background: on ? '#1f9d55' : '#cbd0d8',
      }} />
    </div>
  );
}

Object.assign(window, { AirwayTab, CPRTab, BeatDot });
