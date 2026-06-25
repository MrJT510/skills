// tab-meds.jsx — Meds tab

function DrugCard({ accent, name, dose, lastT, count, onClick, disabled, sublabel, maxedNote, due }) {
  const accentColor = accent === 'red' ? '#dc2626' : accent === 'blue' ? '#2563eb' : '#9ca3af';
  return (
    <button onClick={disabled ? null : onClick} className={disabled ? 'dim' : ''} style={{
      width: '100%', textAlign: 'left',
      background: 'var(--card)', borderRadius: 12,
      borderLeft: `4px solid ${accentColor}`, border: '1px solid var(--line)',
      borderLeftWidth: 4, borderLeftColor: accentColor,
      padding: '11px 12px', minHeight: 60,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2,
        }}>{name}</div>
        <div style={{
          fontSize: 11, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.35,
        }}>{dose}</div>
        {sublabel && (
          <div style={{
            fontSize: 10.5, color: '#9a4d05', marginTop: 3, fontWeight: 500,
          }}>{sublabel}</div>
        )}
        {maxedNote && (
          <div style={{
            fontSize: 10.5, color: '#991111', marginTop: 3, fontWeight: 600,
          }}>{maxedNote}</div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        {due && lastT != null ? (
          <div className="warnpulse" style={{
            fontSize: 11, fontWeight: 800, color: '#9a4d05', background: '#fff3e0',
            border: '1px solid #d97706', padding: '5px 9px', borderRadius: 8,
            letterSpacing: '0.04em',
          }}>DUE NOW</div>
        ) : lastT != null ? (
          <div className="mono" style={{
            fontSize: 11.5, fontWeight: 700, color: '#1f9d55',
            display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end',
          }}>
            <Ic.Check s={11} c="#1f9d55" /> {fmtMMSS(lastT)}
          </div>
        ) : (
          <div style={{
            fontSize: 12, fontWeight: 700, color: accentColor,
            padding: '6px 10px', background: `${accentColor}11`, borderRadius: 8,
          }}>LOG</div>
        )}
        {count != null && count > 0 && (
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>×{count}</div>
        )}
      </div>
    </button>
  );
}

function MedsTab() {
  const { s, set, setS } = useStore();

  const logDrug = (name, dose, type) => {
    setS(prev => ({
      ...prev,
      medsLog: [...prev.medsLog, { name, dose, t: prev.elapsed, type }],
      log: [...prev.log, { t: prev.elapsed, action: `${name} given`, detail: dose, kind: 'med' }],
    }));
  };

  const logEpi = () => {
    // Hard gate: no drug without a route
    if (Object.keys(s.vascular).length === 0) {
      set({ accessOverlay: true });
      return;
    }
    if (s.arrestType === 'traumatic') {
      set({ showTraumaticEpiConfirm: true });
      return;
    }
    // Hypothermic + cold: protocol holds meds — confirm (give-anyway) like the main screen
    if (s.arrestType === 'hypothermic' && !s.coreWarm) {
      set({ showHypoEpiConfirm: true });
      return;
    }
    confirmEpi();
  };
  const confirmEpi = () => {
    setS(prev => {
      const n = prev.epiCount + 1;
      const dose = prev.patientMode === 'pediatric'
        ? BROSELOW[prev.broselowIdx].epi
        : '1 mg IV/IO (1:10,000)';
      return {
        ...prev,
        epiLastAt: prev.elapsed, epiCount: n,
        showTraumaticEpiConfirm: false,
        medsLog: [...prev.medsLog, { name: 'Epinephrine', dose, t: prev.elapsed, type: 'epi' }],
        log: [...prev.log, { t: prev.elapsed, action: `Epinephrine #${n} given`, detail: dose, kind: 'med' }],
      };
    });
  };

  const logAmio300 = () => {
    if (s.amio300At != null) return;
    setS(prev => {
      const ped = prev.patientMode === 'pediatric';
      const dose = ped ? `${BROSELOW[prev.broselowIdx].amio} (5 mg/kg)` : '300 mg IV/IO';
      return {
        ...prev,
        amio300At: prev.elapsed,
        medsLog: [...prev.medsLog, { name: ped ? 'Amiodarone (5 mg/kg)' : 'Amiodarone 300 mg', dose, t: prev.elapsed, type: 'amio' }],
        log: [...prev.log, { t: prev.elapsed, action: `Amiodarone given${ped ? ' (5 mg/kg)' : ' 300 mg'}`, detail: ped ? dose + ' · single dose' : 'First dose · IV/IO', kind: 'med' }],
      };
    });
  };
  const logAmio150 = () => {
    if (s.amio150At != null || s.amio300At == null) return;
    setS(prev => ({
      ...prev,
      amio150At: prev.elapsed,
      medsLog: [...prev.medsLog, { name: 'Amiodarone 150 mg', dose: '150 mg IV/IO · refractory', t: prev.elapsed, type: 'amio' }],
      log: [...prev.log, { t: prev.elapsed, action: 'Amiodarone 150 mg given', detail: '2nd dose · max 450 mg reached', kind: 'med' }],
    }));
  };

  const pedDose = s.patientMode === 'pediatric' ? BROSELOW[s.broselowIdx] : null;
  const epiDose = pedDose ? pedDose.epi : '1 mg IV/IO (1:10,000)';
  const epiSec = s.epiLastAt == null ? null : (s.elapsed - s.epiLastAt);
  const epiDue = epiSec != null && epiSec >= 180;   // next Epi due ~every 3-5 min

  // Last given time for non-Epi single-shot drugs
  const lastTimeOf = (name) => {
    const e = [...s.medsLog].reverse().find(m => m.name === name);
    return e ? e.t : null;
  };

  return (
    <div style={{ padding: '4px 12px 24px' }}>
      {/* Traumatic banner */}
      {s.arrestType === 'traumatic' && (
        <div style={{
          padding: '9px 12px', background: '#fff3e0',
          borderLeft: '4px solid #d97706', borderRadius: 8,
          fontSize: 11.5, color: '#9a4d05', display: 'flex', gap: 8, marginTop: 4,
        }}>
          <Ic.Warn s={13} c="#d97706" />
          <span><b>Epi withheld if exsanguination suspected</b> (local protocol)</span>
        </div>
      )}

      {/* Pediatric band display */}
      {pedDose && (
        <div className="card" style={{
          marginTop: 10, border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: pedDose.color,
            border: '1px solid rgba(0,0,0,0.08)',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{pedDose.name} band — {pedDose.kg}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>
              Epi {pedDose.epi} · Amio {pedDose.amio}
            </div>
          </div>
        </div>
      )}

      {/* Drugs */}
      <div className="section-title">Resuscitation drugs
        {s.medsLog.length > 0 && <span className="count">{s.medsLog.length} given</span>}
      </div>
      {Object.keys(s.vascular).length === 0 && (
        <button onClick={() => set({ accessOverlay: true })} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 12px', marginBottom: 7, borderRadius: 10,
          background: '#f3ecff', border: '1.5px solid #7c3aed', textAlign: 'left',
        }}>
          <Ic.Lock s={14} c="#7c3aed" />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#5b21b6', lineHeight: 1.3 }}>
            Establish IV / IO access before giving medications
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>Open ›</span>
        </button>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <DrugCard
          accent="red"
          name="Epinephrine"
          dose={epiDose}
          lastT={s.epiLastAt}
          count={s.epiCount}
          due={epiDue}
          onClick={logEpi}
        />
        {pedDose ? (
          <DrugCard
            accent="blue"
            name="Amiodarone (5 mg/kg)"
            dose={`${pedDose.amio} IV/IO · single dose only`}
            sublabel={s.torsades ? 'Not indicated for Torsades' : 'BASE CONTACT for re-dosing'}
            lastT={s.amio300At}
            onClick={logAmio300}
            disabled={s.amio300At != null || s.torsades}
          />
        ) : (
          <>
            <DrugCard
              accent="blue"
              name="Amiodarone 300 mg"
              dose="First dose · IV/IO"
              sublabel={s.torsades ? 'Not indicated for Torsades' : null}
              lastT={s.amio300At}
              onClick={logAmio300}
              disabled={s.amio300At != null || s.torsades}
            />
            <DrugCard
              accent="blue"
              name="Amiodarone 150 mg"
              dose="IV/IO"
              sublabel={s.torsades ? 'Not indicated for Torsades' : (s.amio300At == null ? 'Locked until 300 mg given' : null)}
              maxedNote={s.amio150At != null ? 'Max dose reached (450 mg)' : null}
              lastT={s.amio150At}
              onClick={logAmio150}
              disabled={s.amio300At == null || s.amio150At != null || s.torsades}
            />
          </>
        )}
        <DrugCard accent="blue" name="Magnesium Sulfate 2 g"
                  dose="2 g IV/IO in 10 mL NS over 2 min · Torsades · may repeat ×1"
                  sublabel={s.torsades ? 'Indicated — Torsades flagged' : null}
                  lastT={s.magAt}
                  count={s.magCount}
                  onClick={() => setS(prev => ({ ...prev,
                    magAt: prev.elapsed, magCount: prev.magCount + 1,
                    medsLog: [...prev.medsLog, { name: 'Magnesium Sulfate', dose: '2 g IV/IO over 2 min', t: prev.elapsed, type: 'mag' }],
                    log: [...prev.log, { t: prev.elapsed, action: `Magnesium Sulfate 2 g given (#${prev.magCount + 1})`, detail: 'Torsades · over 2 min in 10 mL NS', kind: 'med' }],
                  }))} />
        <DrugCard accent="gray" name="Calcium Chloride"
                  dose="10 mg/kg IV/IO · max 1 g · flush line after"
                  lastT={lastTimeOf('Calcium Chloride')}
                  onClick={() => logDrug('Calcium Chloride', '10 mg/kg IV/IO · max 1 g', 'other')} />
        <DrugCard accent="gray" name="Sodium Bicarbonate"
                  dose="1 mEq/kg IV/IO · max 50 mEq"
                  lastT={lastTimeOf('Sodium Bicarbonate')}
                  onClick={() => logDrug('Sodium Bicarbonate', '1 mEq/kg IV/IO · max 50 mEq', 'other')} />
        <DrugCard accent="gray" name="Fluid Bolus"
                  dose={pedDose ? '20 mL/kg IV/IO · repeat once (max 40 mL/kg)' : '500 mL IV/IO'}
                  lastT={lastTimeOf('Fluid Bolus')}
                  onClick={() => logDrug('Fluid Bolus', pedDose ? '20 mL/kg IV/IO' : '500 mL IV/IO', 'other')} />
        <DrugCard accent="gray" name="Dopamine"
                  dose="10–20 mcg/kg/min IV · titrate SBP >90 mmHg"
                  lastT={lastTimeOf('Dopamine')}
                  onClick={() => logDrug('Dopamine', '10–20 mcg/kg/min IV', 'other')} />
        <DrugCard accent="gray" name="TXA"
                  dose="Post-ROSC traumatic arrest · hemorrhagic shock per local protocol"
                  lastT={lastTimeOf('TXA')}
                  onClick={() => logDrug('TXA', 'Per local protocol', 'other')} />
        <DrugCard accent="gray" name="D50"
                  dose="25 g IV/IO"
                  lastT={lastTimeOf('D50')}
                  onClick={() => logDrug('D50', '25 g IV/IO', 'other')} />
      </div>

      {/* Custom medication */}
      <button onClick={() => {
        const name = window.prompt('Medication name?');
        if (!name) return;
        const dose = window.prompt('Dose / route?') || '';
        logDrug(name, dose, 'custom');
      }} style={{
        width: '100%', marginTop: 8, padding: '13px 12px', borderRadius: 12,
        background: 'var(--card)', border: '1.5px dashed #cbd0d8',
        color: 'var(--ink-2)', fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <Ic.Plus s={16} c="#3a4252" /> Other medication — tap to log
      </button>
    </div>
  );
}

Object.assign(window, { MedsTab });
