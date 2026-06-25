// app.jsx — root composition

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "showFrame": true,
  "darkLockScreen": false,
  "fastTimers": false,
  "skipLaunch": false
}/*EDITMODE-END*/;

function ActiveScreen() {
  const { s, set, statusLabel, phase } = useStore();
  const scrollRef = React.useRef(null);

  // Reset tab content to top whenever the active tab changes
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [s.activeTab]);

  let TabComp = RhythmTab;
  if (s.activeTab === 'meds')   TabComp = MedsTab;
  if (s.activeTab === 'airway') TabComp = AirwayTab;
  if (s.activeTab === 'cpr')    TabComp = CPRTab;
  if (s.activeTab === 'log')    TabComp = LogTab;
  if (s.activeTab === 'export') TabComp = ExportTab;

  const ambColor = (PHASE_COLORS[phase] || {}).c || '#1f9d55';
  const ambColor2 = '#2563eb';

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
      background: 'var(--paper)', position: 'relative',
    }}>
      <div className="phase-ambient" style={{ '--phase-amb': ambColor + '40', '--phase-amb2': ambColor2 + '22' }} />
      {/* Fixed top chrome */}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <StatusBar />
        <AlertBanner />
        <FlowRibbon />
        <InitialRhythmCheck />
        <SubTimers />
        <PrimaryActions />
        <PulseCheckOverlay />
        <AccessOverlay />
        <EpiOverlay />
        <PhaseDecision />
        <TabBar />
      </div>
      {/* Scrolling tab content */}
      <div ref={scrollRef} className="scroll" style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1 }}>
        <div key={s.activeTab} className="tab-enter">
          <TabComp />
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  const { s, darkMode } = useStore();
  return (
    <div className={`app app-safe-top app-safe-bottom${darkMode ? ' dark' : ''}`}>
      {s.screen === 'launch' ? <LaunchScreen /> : <ActiveScreen />}
      {s.screen === 'active' && <AudioCues />}
      {s.screen === 'active' && <FocusMode />}
      <TwentyMinDecision />
      <TerminateConfirm />
    </div>
  );
}

// ─── Phase tweak panel ───────────────────────────────────
function PhaseTweaksContent() {
  const { s, set, setS } = useStore();

  // Tweaks panel content — re-renders on each phase change for live testing
  const jumpTo = (newStatus) => {
    setS(prev => {
      const updates = { ...prev };
      if (newStatus === 'cpr')        { updates.status = 'cpr'; updates.roscAt = null; updates.transportAt = null; updates.terminatedAt = null; updates.onsceneWarnFired = false; }
      if (newStatus === 'transport')  { updates.status = 'transport'; updates.transportAt = prev.elapsed; }
      if (newStatus === 'rosc')       { updates.status = 'rosc'; updates.roscAt = prev.elapsed; }
      if (newStatus === 'terminated') { updates.status = 'terminated'; updates.terminatedAt = prev.elapsed; }
      if (newStatus === 'onscene20')  { updates.onsceneWarnFired = true; }
      return updates;
    });
  };

  const seedDemo = () => {
    setS(prev => {
      const e = prev.elapsed;
      const t1 = Math.max(0, e - 240), t2 = Math.max(0, e - 180), t3 = Math.max(0, e - 120), t4 = Math.max(0, e - 60);
      return {
        ...prev,
        initialRhythm: 'vf',
        rhythmHistory: [{ rhythm: 'VF', t: t1 }, { rhythm: 'Pulseless VT', t: t3 }],
        shocks: [{ j: 200, t: t1, n: 1 }, { j: 200, t: t2, n: 2 }, { j: 360, t: t3, n: 3 }],
        lastJoules: 360,
        epiCount: 2,
        epiLastAt: t3,
        amio300At: t2,
        medsLog: [
          { name: 'Epinephrine', dose: '1 mg IV/IO (1:10,000)', t: t1, type: 'epi' },
          { name: 'Amiodarone 300 mg', dose: '300 mg IV/IO', t: t2, type: 'amio' },
          { name: 'Epinephrine', dose: '1 mg IV/IO (1:10,000)', t: t3, type: 'epi' },
        ],
        airwayLog: [{ id: 'ett', label: 'ETT with Bougie', t: t2 }, { id: 'etco2', label: 'ETCO2 monitoring', t: t2 }],
        vascular: { io: { t: t1, size: '15mm', location: 'L tibia' } },
        etco2Readings: [{ v: 18, t: t2 }, { v: 24, t: t4 }],
        log: [
          ...prev.log,
          { t: t1, action: 'Initial rhythm: VF', detail: 'Locked', kind: 'rhythm' },
          { t: t1, action: 'IO access obtained', detail: 'L tibia', kind: 'airway' },
          { t: t1, action: 'Shock #1 delivered', detail: '200 J', kind: 'shock' },
          { t: t1, action: 'Epinephrine #1 given', detail: '1 mg IV/IO', kind: 'med' },
          { t: t2, action: 'Shock #2 delivered', detail: '200 J', kind: 'shock' },
          { t: t2, action: 'Amiodarone 300 mg given', detail: 'First dose', kind: 'med' },
          { t: t2, action: 'Airway: ETT with Bougie', detail: 'Confirmed', kind: 'airway' },
          { t: t3, action: 'Shock #3 delivered', detail: '360 J · escalated', kind: 'shock' },
          { t: t3, action: 'Epinephrine #2 given', detail: '1 mg IV/IO', kind: 'med' },
          { t: t4, action: 'ETCO2 24 mmHg', detail: 'Recorded', kind: 'etco2' },
        ],
      };
    });
  };

  const reset = () => {
    if (window.confirm('Reset to launch screen?')) {
      setS(initialState());
    }
  };

  const PhaseBtn = ({ label, color, onClick, active }) => (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 6px', borderRadius: 8,
      background: active ? color : '#fff',
      color: active ? '#fff' : color,
      border: `1.5px solid ${color}`,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    }}>{label}</button>
  );

  // Re-derive: cprPhase / transportPhase / etc., to compute "active" without phase tinkering
  const isCpr   = s.status === 'cpr' && !s.onsceneWarnFired;
  const is20    = s.onsceneWarnFired && s.status === 'cpr';
  const isTrans = s.status === 'transport';
  const isRosc  = s.status === 'rosc';
  const isTerm  = s.status === 'terminated';

  return (
    <>
      <TweakSection label="Phase">
        <div style={{ padding: '4px 0 6px' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            <PhaseBtn label="CPR"     color="#1f9d55" active={isCpr}   onClick={() => jumpTo('cpr')} />
            <PhaseBtn label="20-MIN"  color="#ea580c" active={is20}    onClick={() => jumpTo('onscene20')} />
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            <PhaseBtn label="TRANS"   color="#eab308" active={isTrans} onClick={() => jumpTo('transport')} />
            <PhaseBtn label="ROSC"    color="#2563eb" active={isRosc}  onClick={() => jumpTo('rosc')} />
          </div>
          <PhaseBtn label="TERMINATED" color="#dc2626" active={isTerm} onClick={() => jumpTo('terminated')} />
          <div style={{ fontSize: 10.5, color: '#9aa3ad', marginTop: 7, lineHeight: 1.45 }}>
            Force status bar color. Useful for design review.
          </div>
        </div>
      </TweakSection>

      <TweakSection label="Arrest type">
        <TweakSelect label="Type" value={s.arrestType} onChange={(v) => set({ arrestType: v })}
                     options={ARREST_TYPES.map(t => ({ value: t.id, label: t.label }))} />
        <div style={{ fontSize: 10.5, color: '#9aa3ad', padding: '0 0 4px', lineHeight: 1.45 }}>
          Switch to Traumatic / Hypothermic etc. to see the persistent amber alert banner change.
        </div>
      </TweakSection>

      <TweakSection label="Patient mode">
        <TweakRadio label="Mode" value={s.patientMode} onChange={(v) => set({ patientMode: v })}
                     options={[{ value: 'adult', label: 'Adult' }, { value: 'pediatric', label: 'Ped' }]} />
        {s.patientMode === 'pediatric' && (
          <TweakSelect label="Broselow band" value={String(s.broselowIdx)}
                       onChange={(v) => set({ broselowIdx: parseInt(v) })}
                       options={BROSELOW.map((b, i) => ({ value: String(i), label: `${b.name} · ${b.kg}` }))} />
        )}
      </TweakSection>

      <TweakSection label="Quick actions">
        <TweakButton label="Seed demo data" onClick={seedDemo} />
        <TweakButton label="Reset to launch" onClick={reset} secondary />
      </TweakSection>

      <TweakSection label="Display & sound">
        <TweakRadio label="Theme" value={s.theme} onChange={(v) => set({ theme: v })}
                     options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <TweakToggle label="Audio + haptic cues" value={!!s.audioEnabled}
                     onChange={(v) => set({ audioEnabled: v })} />
        <div style={{ fontSize: 10.5, color: '#9aa3ad', padding: '2px 0 4px', lineHeight: 1.45 }}>
          System follows your device's light/dark setting. Soft chimes count down the last 20s before each pulse check.
        </div>
      </TweakSection>

      <TweakSection label="Frame">
        <TweakToggle label="iPhone bezel" value={!!s.showFrame}
                     onChange={(v) => set({ showFrame: v })} />
      </TweakSection>
    </>
  );
}

function Tweaks() {
  const { s, set } = useStore();
  return (
    <TweaksPanel title="Tweaks">
      <PhaseTweaksContent />
    </TweaksPanel>
  );
}

// ─── Root ────────────────────────────────────────────────
function App() {
  const [showFrame, setShowFrame] = React.useState(true);

  return (
    <StoreProvider>
      <FrameWrapper>
        <AppInner />
      </FrameWrapper>
      <Tweaks />
    </StoreProvider>
  );
}

function FrameWrapper({ children }) {
  const { s } = useStore();
  const showFrame = !!s.showFrame;

  if (!showFrame) {
    return (
      <div className="app-shell-card">{children}</div>
    );
  }

  return (
    <IOSDevice width={402} height={874} dark={false}>
      <div style={{
        height: '100%',
        paddingTop: 56,
        paddingBottom: 28,
        display: 'flex', flexDirection: 'column',
        boxSizing: 'border-box',
      }}>
        {children}
      </div>
    </IOSDevice>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
