// tab-log-export.jsx — Log and Export tabs

function LogTab() {
  const { s, editLogTime } = useStore();
  const ref = React.useRef(null);
  const [editIdx, setEditIdx] = React.useState(null);
  const [mm, setMm] = React.useState(0);
  const [ss, setSs] = React.useState(0);

  React.useEffect(() => {
    if (ref.current && editIdx == null) ref.current.scrollTop = ref.current.scrollHeight;
  }, [s.log.length]);

  const kindColor = (k) => {
    if (k === 'shock')     return '#d97706';
    if (k === 'med')       return '#dc2626';
    if (k === 'rhythm')    return '#7c3aed';
    if (k === 'rosc')      return '#1f9d55';
    if (k === 'terminate') return '#991111';
    if (k === 'airway')    return '#0ea5e9';
    if (k === 'glucose')   return '#7c3aed';
    if (k === 'alert')     return '#d97706';
    return '#2563eb';
  };

  const openEdit = (i, t) => {
    setEditIdx(i); setMm(Math.floor(t / 60)); setSs(t % 60);
  };
  const saveEdit = () => {
    editLogTime(editIdx, mm * 60 + ss);
    setEditIdx(null);
  };
  const Step = ({ val, set, max, unit }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => set(Math.max(0, val - 1))} style={stepBtn}>−</button>
      <div className="mono" style={{ minWidth: 38, textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
        {String(val).padStart(2, '0')}<span style={{ fontSize: 9, color: 'var(--ink-3)' }}>{unit}</span>
      </div>
      <button onClick={() => set(Math.min(max, val + 1))} style={stepBtn}>+</button>
    </div>
  );

  if (s.log.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13,
      }}>
        Events will appear here as you log them.
      </div>
    );
  }

  const base = s.cprStartedAt != null ? s.cprStartedAt : s.startTime;

  return (
    <div ref={ref} className="scroll" style={{
      padding: '8px 12px 24px',
      display: 'flex', flexDirection: 'column', gap: 7,
    }}>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', padding: '0 2px 2px', lineHeight: 1.4 }}>
        Tap any entry to back-date its time if it was logged late.
      </div>
      {s.log.map((e, i) => (
        <div key={i}>
          <div onClick={() => openEdit(i, e.t)} style={{
            display: 'flex', gap: 10, padding: '8px 10px',
            background: 'var(--card)', borderRadius: 9,
            border: editIdx === i ? '1.5px solid #2563eb' : '1px solid var(--line-2)',
            cursor: 'pointer',
          }}>
            <div style={{ minWidth: 52, paddingTop: 1 }}>
              <div className="mono" style={{
                fontSize: 11, fontWeight: 700, color: kindColor(e.kind),
              }}>[{fmtMMSS(e.t)}]</div>
              {base != null && (
                <div className="mono" style={{
                  fontSize: 9.5, color: 'var(--ink-3)', marginTop: 1, fontWeight: 600,
                }}>{clockAt(base, e.t)}</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.35 }}>
                {e.action}
                {e.edited && <span style={{ fontSize: 9.5, color: 'var(--ink-3)', marginLeft: 6, fontWeight: 600 }}>· edited</span>}
              </div>
              {e.detail && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1, lineHeight: 1.35 }}>{e.detail}</div>
              )}
            </div>
          </div>
          {editIdx === i && (
            <div className="slide-in" style={{
              background: 'var(--card)', border: '1.5px solid #2563eb', borderTop: 'none',
              borderRadius: '0 0 10px 10px', padding: '10px 12px', marginTop: -2,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Adjust event time (mm:ss)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                <Step val={mm} set={setMm} max={120} unit="m" />
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-3)' }}>:</span>
                <Step val={ss} set={setSs} max={59} unit="s" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setEditIdx(null)} style={{
                  flex: 1, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  background: 'var(--line-2)', color: 'var(--ink)',
                }}>Cancel</button>
                <button onClick={saveEdit} style={{
                  flex: 1.3, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                  background: '#2563eb', color: '#fff',
                }}>Save time</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const stepBtn = {
  width: 34, height: 34, borderRadius: 8, background: 'var(--line-2)',
  color: 'var(--ink)', fontSize: 20, fontWeight: 700, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// ─── Export tab ──────────────────────────────────────────
function buildExportText(s, statusLabel) {
  const lines = [];
  lines.push('════════════════════════════════════════');
  lines.push('Resuscribe · Prehospital Cardiac Arrest Timer');
  lines.push('────────────────────────────────────────');
  lines.push('CARDIAC ARREST RESUSCITATION RECORD');
  lines.push('EMS resuscitation protocol');
  lines.push('Zero patient identifiers · HIPAA compliant');
  lines.push('────────────────────────────────────────');
  lines.push('');
  lines.push('CASE SUMMARY');
  lines.push(`  Mode:           ${s.patientMode === 'adult' ? 'Adult' : 'Pediatric (' + BROSELOW[s.broselowIdx].name + ' band, ' + BROSELOW[s.broselowIdx].kg + ')'}`);
  lines.push(`  Arrest type:    ${ARREST_TYPES.find(t => t.id === s.arrestType)?.label}`);
  lines.push(`  Witnessed:      ${s.witnessed === 'witnessed' ? 'Yes (EMS-witnessed)' : 'No'}`);
  lines.push(`  Bystander CPR:  ${s.bystanderCpr === 'yes' ? 'Yes' : 'No'}`);
  if (s.codeStatus && s.codeStatus !== 'full') {
    lines.push(`  Resus status:   ${s.codeStatus === 'dnr' ? 'DNR / POLST noted' : 'Obvious signs of death noted'}`);
  }
  if (s.cprStartedAt != null) {
    lines.push(`  CPR started:    ${clockAt(s.cprStartedAt, 0)}`);
  }
  lines.push(`  Report time:    ${clockNow()}`);
  lines.push(`  Elapsed time:   ${fmtMMSS(s.elapsed)}`);
  lines.push(`  Initial rhythm: ${s.initialRhythm ? s.initialRhythm.toUpperCase() : 'Not specified'}`);
  const last = s.rhythmHistory[s.rhythmHistory.length - 1];
  lines.push(`  Current rhythm: ${last ? last.rhythm : 'Not specified'}`);
  lines.push(`  Shocks:         ${s.shocks.length} delivered${s.shocks.length ? ' (last ' + s.shocks[s.shocks.length-1].j + (s.shocks[s.shocks.length-1].j === 'Sync' ? '' : ' J') + ')' : ''}`);
  lines.push(`  Epi doses:      ${s.epiCount}`);
  const amio = (s.amio300At != null ? 1 : 0) + (s.amio150At != null ? 1 : 0);
  lines.push(`  Amiodarone:     ${amio} dose${amio !== 1 ? 's' : ''}`);
  lines.push(`  Airway:         ${s.airwayLog.map(a => a.label).join(', ') || 'None logged'}`);
  const vascSummary = Object.entries(s.vascular).map(([k, d]) => {
    const extras = [d.size, d.location].filter(Boolean).join(' ');
    return k.toUpperCase() + (extras ? ` (${extras})` : '') + ` @ ${fmtMMSS(d.t)}`;
  });
  lines.push(`  Vascular:       ${vascSummary.join(', ') || 'None'}`);
  if (s.etco2Readings.length) {
    lines.push(`  ETCO2:          ${s.etco2Readings.map(r => r.v + '@' + fmtMMSS(r.t)).join(', ')}`);
  }
  if (s.glucoseReadings.length) {
    lines.push(`  Blood glucose:  ${s.glucoseReadings.map(r => r.v + '@' + fmtMMSS(r.t)).join(', ')} mg/dL`);
  }
  const causes = Object.keys(s.reversibleCauses);
  if (causes.length) lines.push(`  H&T addressed:  ${causes.join(', ')}`);
  if (s.etiology) lines.push(`  Etiology:       ${s.etiology}`);
  lines.push(`  Outcome:        ${statusLabel}`);
  lines.push('');
  lines.push('TEAM');
  lines.push(`  Lead:           ${s.roles.lead || '—'}`);
  lines.push(`  Compressor:     ${s.roles.compressor || '—'}`);
  lines.push(`  Airway:         ${s.roles.airway || '—'}`);
  lines.push(`  Meds:           ${s.roles.meds || '—'}`);
  lines.push(`  Compressor rotations: ${s.compressorRotations.length}`);
  lines.push('');
  lines.push('TIMELINE');
  const base = s.cprStartedAt != null ? s.cprStartedAt : s.startTime;
  s.log.forEach(e => {
    const clk = base != null ? clockAt(base, e.t) : '';
    lines.push(`  [${fmtMMSS(e.t)}]${clk ? ' ' + clk : ''} ${e.action}` + (e.detail ? ` — ${e.detail}` : ''));
  });
  lines.push('');
  if (s.airwayNotes) {
    lines.push('AIRWAY NOTES');
    lines.push('  ' + s.airwayNotes.split('\n').join('\n  '));
    lines.push('');
  }
  if (s.postCallNotes) {
    lines.push('POST-CALL NOTES');
    lines.push('  ' + s.postCallNotes.split('\n').join('\n  '));
    lines.push('');
  }
  lines.push('────────────────────────────────────────');
  lines.push('EMS resuscitation protocol');
  lines.push('────────────────────────────────────────');
  return lines.join('\n');
}

function ExportTab() {
  const { s, set, setS, statusLabel, newCase } = useStore();
  const [copied, setCopied] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [confirmNew, setConfirmNew] = React.useState(false);
  const [exported, setExported] = React.useState(false);

  const text = buildExportText(s, statusLabel);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setExported(true); setTimeout(() => setCopied(false), 1800); } catch(e) {}
  };

  const share = async () => {
    // Native share sheet (iOS/Android/desktop) when available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Cardiac Arrest Record',
          text,
        });
        setExported(true);
        return;
      } catch (e) {
        // user cancelled or share failed — fall through to clipboard fallback
        if (e && e.name === 'AbortError') return;
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setExported(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      alert('Sharing is not supported on this device. The record was not copied.');
    }
  };

  const InfoRow = ({ label, val }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12,
      fontSize: 12, padding: '5px 0',
      borderBottom: '1px dashed #eef0f3',
    }}>
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: 500, textAlign: 'right' }}>{val}</span>
    </div>
  );

  const last = s.rhythmHistory[s.rhythmHistory.length - 1];
  const amio = (s.amio300At != null ? 1 : 0) + (s.amio150At != null ? 1 : 0);

  return (
    <div style={{ padding: '4px 12px 24px' }}>
      {/* Export actions — first */}
      <div className="section-title" style={{ marginTop: 10 }}>Export actions</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <ExportBtn icon={<Ic.Chat s={18} c="#0b0f17" />} title="Share"
                   sub="Open device share sheet — Messages, Mail, AirDrop"
                   onClick={share} />
        <ExportBtn icon={<Ic.Copy s={18} c="#0b0f17" />}
                   title={copied ? '✓ Copied to clipboard' : 'Copy to clipboard'}
                   sub="Paste into ImageTrend or AirDrop"
                   onClick={copy} highlight={copied} />
      </div>

      {/* New case */}
      <div className="section-title" style={{ marginTop: 16 }}>New code</div>
      {!confirmNew ? (
        <button onClick={() => setConfirmNew(true)} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: exported ? '#1f9d55' : 'var(--card)',
          border: exported ? '1.5px solid #1f9d55' : '1.5px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
          boxShadow: exported ? '0 8px 22px -8px rgba(31,157,85,0.6)' : 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: exported ? 'rgba(255,255,255,0.22)' : 'var(--line-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}><Ic.Plus s={18} c={exported ? '#fff' : 'var(--ink-2)'} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: exported ? '#fff' : 'var(--ink)' }}>Start new code</div>
            <div style={{ fontSize: 11, color: exported ? 'rgba(255,255,255,0.85)' : 'var(--ink-3)', marginTop: 1 }}>
              {exported ? 'Record saved — ready for the next patient' : 'Clears this record — export first'}
            </div>
          </div>
          <Ic.ChevR s={16} c={exported ? '#fff' : 'var(--ink-3)'} />
        </button>
      ) : (
        <div style={{
          background: 'var(--card)', border: '1.5px solid #dc2626', borderRadius: 12, padding: 13,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Clear this case and start over?</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.4 }}>
            This permanently erases the current timeline. Make sure you've shared or copied the record first.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setConfirmNew(false)} style={{
              flex: 1, padding: 11, borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: 'var(--line-2)', color: 'var(--ink)',
            }}>Cancel</button>
            <button onClick={() => { setConfirmNew(false); setExported(false); newCase(); }} style={{
              flex: 1.3, padding: 11, borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: '#dc2626', color: '#fff',
            }}>Erase & start new</button>
          </div>
        </div>
      )}

      {/* HIPAA banner */}
      <div style={{
        marginTop: 12,
        padding: '9px 12px', background: '#e6efff',
        borderLeft: '4px solid #2563eb', borderRadius: 8,
        fontSize: 11, color: '#1746a8', fontWeight: 500, lineHeight: 1.4,
      }}>
        Zero patient identifiers · HIPAA compliant · EMS resuscitation protocol
      </div>

      <div className="section-title">Case summary</div>
      <div className="card" style={{ border: '1px solid var(--line)' }}>
        <InfoRow label="Mode"            val={s.patientMode === 'adult' ? 'Adult' : 'Ped · ' + BROSELOW[s.broselowIdx].name} />
        <InfoRow label="Arrest type"     val={ARREST_TYPES.find(t => t.id === s.arrestType)?.label} />
        <InfoRow label="Elapsed"         val={<span className="mono" style={{ fontWeight: 600 }}>{fmtMMSS(s.elapsed)}</span>} />
        <InfoRow label="Initial rhythm"  val={s.initialRhythm ? s.initialRhythm.toUpperCase() : '—'} />
        <InfoRow label="Current rhythm"  val={last ? last.rhythm : '—'} />
        <InfoRow label="Shocks"          val={s.shocks.length === 0 ? '0' : `${s.shocks.length} · last ${s.shocks[s.shocks.length-1].j}${s.shocks[s.shocks.length-1].j === 'Sync' ? '' : ' J'}`} />
        <InfoRow label="Epi doses"       val={s.epiCount} />
        <InfoRow label="Amiodarone"      val={amio === 0 ? '0' : amio === 1 ? '300 mg' : '300 + 150 mg (max 450)'} />
        <InfoRow label="Airway"          val={s.airwayLog.map(a => a.label).join(', ') || '—'} />
        <InfoRow label="Vascular"        val={Object.entries(s.vascular).map(([k, d]) => k.toUpperCase() + (d.size ? ' ' + d.size : '') + (d.location ? ' ' + d.location : '')).join(', ') || '—'} />
        <InfoRow label="ETCO2"           val={s.etco2Readings.length ? s.etco2Readings.length + ' readings' : '—'} />
        <InfoRow label="Blood glucose"   val={s.glucoseReadings.length ? (s.glucoseReadings[s.glucoseReadings.length-1].v + ' mg/dL') : '—'} />
        <InfoRow label="H&T addressed"   val={Object.keys(s.reversibleCauses).join(', ') || '—'} />
        <InfoRow label="Etiology"        val={s.etiology || '—'} />
        <InfoRow label="Witnessed"       val={s.witnessed === 'witnessed' ? 'Yes (EMS)' : 'No'} />
        <InfoRow label="Bystander CPR"   val={s.bystanderCpr === 'yes' ? 'Yes' : 'No'} />
        {s.codeStatus && s.codeStatus !== 'full' && (
          <InfoRow label="Resus status" val={s.codeStatus === 'dnr' ? 'DNR / POLST noted' : 'Obvious signs of death'} />
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 12.5, padding: '8px 0 0',
        }}>
          <span style={{ color: 'var(--ink-3)' }}>Outcome</span>
          <span style={{
            color: '#fff', fontWeight: 700, padding: '4px 10px', borderRadius: 99,
            background:
              s.status === 'rosc' ? '#2563eb' :
              s.status === 'terminated' ? '#dc2626' :
              s.status === 'arrived' ? '#4338ca' :
              s.status === 'transport' ? '#d97706' : '#1f9d55',
            fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>{statusLabel}</span>
        </div>
      </div>

      <div className="section-title">Preview</div>
      <button onClick={() => setShowPreview(p => !p)} style={{
        width: '100%', padding: '10px 12px', background: 'var(--card)',
        border: '1px solid var(--line)', borderRadius: 10,
        fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{showPreview ? 'Hide ePCR preview' : 'Show ePCR preview'}</span>
        <Ic.ChevR s={13} c="#6b7280" />
      </button>
      {showPreview && (
        <pre className="mono" style={{
          marginTop: 8, padding: 12, background: '#0b0f17', color: '#cbd0d8',
          borderRadius: 10, fontSize: 10.5, lineHeight: 1.55,
          whiteSpace: 'pre-wrap', overflowX: 'auto', maxHeight: 320,
          overflowY: 'auto',
        }}>{text}</pre>
      )}

      <div className="section-title">Post-call notes</div>
      <textarea
        value={s.postCallNotes}
        onChange={(e) => set({ postCallNotes: e.target.value })}
        placeholder="Hospital handoff, outcome, additional notes…"
        style={{
          width: '100%', minHeight: 92, padding: 11, borderRadius: 10,
          border: '1px solid var(--line)', fontSize: 12.5, lineHeight: 1.4,
          boxSizing: 'border-box', outline: 'none', background: 'var(--card)',
        }}
      />
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 5, paddingLeft: 4 }}>
        Included in all exports
      </div>
    </div>
  );
}

function ExportBtn({ icon, title, sub, onClick, highlight }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '13px 14px', borderRadius: 12,
      background: highlight ? '#e8f6ee' : '#fff',
      border: `1px solid ${highlight ? '#1f9d55' : 'var(--line)'}`,
      textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
      minHeight: 56,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: 'var(--line-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{sub}</div>
      </div>
      <Ic.ChevR s={14} c="#6b7280" />
    </button>
  );
}

Object.assign(window, { LogTab, ExportTab });
