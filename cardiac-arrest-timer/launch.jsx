// launch.jsx — launch screen with patient setup cards

function PillRow({ options, value, onChange, equal = true }) {
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap',
    }}>
      {options.map(o => {
        const active = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            flex: equal ? 1 : undefined, minWidth: equal ? 0 : undefined,
            padding: '9px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
            background: active ? 'var(--ink)' : 'var(--card)',
            color: active ? 'var(--paper)' : 'var(--ink-2)',
            border: active ? '1px solid var(--ink)' : '1px solid var(--line)',
            whiteSpace: 'nowrap',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function BroselowBand({ band, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, width: 116, padding: 9,
      borderRadius: 10, background: 'var(--card)',
      border: active ? '2px solid #0b0f17' : '1px solid var(--line)',
      textAlign: 'left',
      boxShadow: active ? '0 4px 14px rgba(0,0,0,0.08)' : 'none',
    }}>
      <div style={{
        height: 8, borderRadius: 4, background: band.color,
        marginBottom: 7,
      }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{band.name}</div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>{band.kg}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.35 }}>
        <div><span style={{ color: 'var(--ink-3)' }}>Epi </span>{band.epi}</div>
        <div><span style={{ color: 'var(--ink-3)' }}>Amio </span>{band.amio}</div>
      </div>
    </button>
  );
}

function SetupCard({ title, children }) {
  return (
    <div className="card" style={{
      border: '1px solid var(--line)',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  );
}

function LaunchScreen() {
  const { s, set, setS } = useStore();

  const startEvent = () => {
    setS(prev => ({
      ...prev,
      screen: 'active',
      startTime: Date.now(),
      cprStartedAt: null,
      elapsed: 0,
      log: [
        { t: 0, action: 'Event opened', detail:
          `${prev.patientMode === 'adult' ? 'Adult' : 'Pediatric · ' + BROSELOW[prev.broselowIdx].name + ' band'} · ${ARREST_TYPES.find(x=>x.id===prev.arrestType).label}`,
          kind: 'start' },
        { t: 0, action: 'Scene info', detail:
          `${prev.witnessed === 'witnessed' ? 'Witnessed by EMS' : 'Unwitnessed'} · Bystander CPR: ${prev.bystanderCpr === 'yes' ? 'yes' : 'no'}`,
          kind: 'info' },
        ...(prev.codeStatus !== 'full' ? [{
          t: 0,
          action: prev.codeStatus === 'dnr' ? 'DNR / POLST noted' : 'Obvious signs of death noted',
          detail: prev.codeStatus === 'dnr'
            ? 'Confirm valid directive — do not delay care while confirming'
            : 'Resuscitation not indicated — document findings',
          kind: 'alert',
        }] : []),
      ],
    }));
  };

  const CODE_STATUSES = [
    { id: 'full',          label: 'Full resuscitation' },
    { id: 'dnr',           label: 'DNR / POLST' },
    { id: 'obvious-death', label: 'Obvious death' },
  ];
  const codeNote = s.codeStatus === 'dnr'
    ? 'Honor a valid DNR / POLST / advance directive. Confirm validity — but do not delay care or CPR while confirming.'
    : s.codeStatus === 'obvious-death'
    ? 'Obvious signs of death present — resuscitation not indicated. Document findings.'
    : null;

  return (
    <div style={{
      flex: 1, background: 'var(--paper)',
      display: 'flex', flexDirection: 'column',
      minHeight: 0,
    }}>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '14px 14px 8px' }}>
      {/* Header — Resuscribe brand hero */}
      <div style={{
        margin: '-14px -14px 14px', padding: '26px 14px 20px',
        background: 'radial-gradient(125% 95% at 50% 5%, #1a3557 0%, #0c1c30 55%, #0a1424 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        borderBottom: '1px solid rgba(201,162,39,0.18)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 200, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(201,162,39,0.22) 0%, rgba(255,255,255,0.06) 38%, transparent 68%)',
        }} />
        <img src={(window.__resources && window.__resources.fieldstatLogo) || 'assets/fieldstat-emblem.png'} alt="Resuscribe"
          style={{ width: 132, height: 132, objectFit: 'contain', position: 'relative',
            filter: 'drop-shadow(0 8px 22px rgba(0,0,0,0.5))' }} />
        <div style={{
          position: 'relative', marginTop: 10, fontSize: 29, fontWeight: 800,
          letterSpacing: '0.01em', lineHeight: 1,
        }}>
          <span style={{ color: '#f4f7fb' }}>Resus</span><span style={{ color: '#c9a227' }}>cribe</span>
        </div>
        <div style={{
          position: 'relative', fontSize: 10, color: '#c9a227', marginTop: 7,
          letterSpacing: '0.22em', textAlign: 'center', textTransform: 'uppercase', fontWeight: 700,
          opacity: 0.92,
        }}>
          Prehospital Cardiac Arrest Timer
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Card 1 — Patient mode */}
        <SetupCard title="Patient mode">
          <PillRow
            options={[{ id: 'adult', label: 'Adult' }, { id: 'pediatric', label: 'Pediatric' }]}
            value={s.patientMode}
            onChange={(v) => set({ patientMode: v })}
          />
          {s.patientMode === 'pediatric' && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7,
              }}>Broselow band</div>
              <div style={{
                display: 'flex', gap: 7, overflowX: 'auto',
                paddingBottom: 4, marginLeft: -2, paddingLeft: 2,
                marginRight: -14, paddingRight: 14,
              }}>
                {BROSELOW.map((b, i) => (
                  <BroselowBand key={i} band={b} active={s.broselowIdx === i}
                                onClick={() => set({ broselowIdx: i })} />
                ))}
              </div>
            </div>
          )}
        </SetupCard>

        {/* Card 2 — Arrest type */}
        <SetupCard title="Arrest type">
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
          }}>
            {ARREST_TYPES.map(t => {
              const active = s.arrestType === t.id;
              return (
                <button key={t.id} onClick={() => set({ arrestType: t.id })} style={{
                  padding: '9px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  background: active ? 'var(--ink)' : 'var(--card)',
                  color: active ? 'var(--paper)' : 'var(--ink-2)',
                  border: active ? '1px solid var(--ink)' : '1px solid var(--line)',
                  whiteSpace: 'nowrap',
                }}>{t.label}</button>
              );
            })}
          </div>
        </SetupCard>

        {/* Card 3 — Scene info */}
        <SetupCard title="Scene info">
          <div style={{ marginBottom: 9 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, fontWeight: 500 }}>Witnessed by EMS</div>
            <PillRow
              options={[
                { id: 'witnessed', label: 'Witnessed' },
                { id: 'unwitnessed', label: 'Unwitnessed' },
              ]}
              value={s.witnessed}
              onChange={(v) => set({ witnessed: v })}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, fontWeight: 500 }}>Bystander CPR</div>
            <PillRow
              options={[
                { id: 'yes', label: 'Yes' },
                { id: 'no',  label: 'No' },
              ]}
              value={s.bystanderCpr}
              onChange={(v) => set({ bystanderCpr: v })}
            />
          </div>
        </SetupCard>

        {/* Card 4 — Resuscitation status (obvious death / DNR / POLST) */}
        <SetupCard title="Resuscitation status">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CODE_STATUSES.map(c => {
              const active = s.codeStatus === c.id;
              const danger = c.id !== 'full';
              const onColor = danger ? '#b91c1c' : 'var(--ink)';
              return (
                <button key={c.id} onClick={() => set({ codeStatus: c.id })} style={{
                  padding: '9px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  background: active ? onColor : 'var(--card)',
                  color: active ? '#fff' : (danger ? '#b91c1c' : 'var(--ink-2)'),
                  border: `1px solid ${active ? onColor : (danger ? '#b91c1c55' : 'var(--line)')}`,
                  whiteSpace: 'nowrap',
                }}>{c.label}</button>
              );
            })}
          </div>
          {codeNote && (
            <div style={{
              marginTop: 10, padding: '9px 11px', borderRadius: 10,
              background: '#fdecec', borderLeft: '4px solid #dc2626',
              fontSize: 11.5, color: '#991111', lineHeight: 1.4,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ marginTop: 1, flexShrink: 0 }}><Ic.Warn s={13} c="#dc2626" /></span>
              <span>{codeNote}</span>
            </div>
          )}
        </SetupCard>

        <div style={{
          fontSize: 11, color: 'var(--ink-3)', textAlign: 'center',
          marginTop: 2, fontStyle: 'italic',
        }}>
          All fields optional. Start with defaults — refine later.
        </div>
      </div>

      {/* Start event — pinned bottom third, thumb-reachable */}
      </div>
      <div style={{
        flexShrink: 0, padding: '10px 14px 16px',
        borderTop: '1px solid rgba(0,0,0,0.03)',
      }}>
        <button onClick={startEvent} style={{
          width: '100%', padding: '22px 16px',
          background: '#1f9d55', color: '#fff',
          borderRadius: 18, fontSize: 22, fontWeight: 700, letterSpacing: '0.04em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 12px 28px rgba(31,157,85,0.45), 0 2px 6px rgba(31,157,85,0.3)',
        }}>
          <Ic.Play s={26} c="#fff" />
          <span>OPEN EVENT</span>
        </button>
        <div style={{
          fontSize: 10.5, color: 'var(--ink-3)', textAlign: 'center', marginTop: 7,
          letterSpacing: '0.03em',
        }}>
          Timers begin when you tap START CPR · One-tap setup
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LaunchScreen, PillRow, SetupCard });
