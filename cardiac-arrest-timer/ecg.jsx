// ecg.jsx — live animated ECG trace that morphs with the current rhythm.
// Canvas-based scrolling waveform. Rhythm-reactive:
//   VF        → chaotic fibrillation
//   pVT       → fast wide sine
//   PEA       → organized complexes (electrical activity, no perfusion)
//   asystole  → flatline with faint noise
//   ROSC/NSR  → clean normal sinus complexes
//   default (pre-rhythm) → gentle organized rhythm

// Returns a normalized y (−1..1) for a position within one beat cycle [0,1)
function nsrSample(p) {
  // P wave
  if (p < 0.12) return 0.12 * Math.sin((p / 0.12) * Math.PI);
  // PR segment
  if (p < 0.18) return 0;
  // Q
  if (p < 0.21) return -0.18 * ((p - 0.18) / 0.03);
  // R spike up
  if (p < 0.245) return -0.18 + 1.18 * ((p - 0.21) / 0.035);
  // S down
  if (p < 0.29) return 1.0 - 1.32 * ((p - 0.245) / 0.045);
  // back to baseline
  if (p < 0.34) return -0.32 + 0.32 * ((p - 0.29) / 0.05);
  // ST segment
  if (p < 0.5) return 0;
  // T wave
  if (p < 0.72) return 0.28 * Math.sin(((p - 0.5) / 0.22) * Math.PI);
  return 0;
}

function rhythmSample(kind, p, t) {
  switch (kind) {
    case 'asystole':
      return (Math.random() - 0.5) * 0.04; // near-flat with tiny noise
    case 'vf': {
      // chaotic sum of sines + noise
      const a = Math.sin(p * Math.PI * 18 + t * 9);
      const b = Math.sin(p * Math.PI * 31 + t * 5.3) * 0.6;
      const c = Math.sin(p * Math.PI * 47 - t * 7) * 0.35;
      return (a + b + c) / 2 * 0.7 + (Math.random() - 0.5) * 0.15;
    }
    case 'pvt': {
      // wide, fast, regular sine-ish
      return Math.sin(p * Math.PI * 2) * 0.85;
    }
    case 'pea': {
      // organized but slightly wide complexes
      return nsrSample(p) * 0.8;
    }
    case 'rosc':
    case 'nsr':
    default:
      return nsrSample(p);
  }
}

function ECGTrace({ rhythmKind = 'nsr', color = '#ffffff', height = 34, bpm = 75, active = true }) {
  const canvasRef = React.useRef(null);
  const stateRef = React.useRef({ phase: 0, raf: 0, last: 0, pts: [] });
  // keep latest props in a ref so the rAF loop reads fresh values without restarting
  const propsRef = React.useRef({ rhythmKind, color, bpm, active });
  propsRef.current = { rhythmKind, color, bpm, active };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(40, rect.width); H = rect.height || height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // seed the trail buffer to baseline
      const n = Math.ceil(W);
      stateRef.current.pts = new Array(n).fill(H / 2);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const st = stateRef.current;
    st.last = performance.now();

    const draw = (now) => {
      const { rhythmKind, color, bpm, active } = propsRef.current;
      const dt = Math.min(0.05, (now - st.last) / 1000);
      st.last = now;

      // advance the beat phase; speed scales with bpm and rhythm
      const cyclesPerSec = (rhythmKind === 'vf' ? 1 : bpm / 60);
      st.phase += dt * cyclesPerSec;
      if (st.phase > 1e6) st.phase -= 1e6;

      // pixels to advance this frame (sweep speed)
      const pxPerSec = W * 0.55;
      let advance = Math.max(1, Math.round(pxPerSec * dt));
      const pts = st.pts;
      const mid = H / 2;
      const amp = H * 0.42;

      for (let i = 0; i < advance; i++) {
        // p = position within current beat
        const p = (st.phase + (i / advance) * dt * cyclesPerSec) % 1;
        const y = mid - rhythmSample(rhythmKind, p, now / 1000) * amp;
        pts.push(y);
      }
      while (pts.length > W) pts.shift();

      // render
      ctx.clearRect(0, 0, W, H);
      // faint baseline
      ctx.strokeStyle = color + '33';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();

      // glow trace
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      const start = Math.max(0, pts.length - W);
      for (let x = 0; x < pts.length; x++) {
        const yy = pts[x];
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // bright leading dot
      const lx = pts.length - 1, ly = pts[pts.length - 1];
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(lx, ly, 2.2, 0, Math.PI * 2); ctx.fill();

      st.raf = requestAnimationFrame(draw);
    };
    st.raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(st.raf); ro.disconnect(); };
  }, [height]);

  return (
    <canvas ref={canvasRef} style={{
      width: '100%', height, display: 'block', opacity: active ? 0.95 : 0.4,
      transition: 'opacity 300ms ease',
    }} />
  );
}

// Map app rhythm state → ECG morphology + bpm
function ecgKindFor(s) {
  if (s.status === 'terminated') return { kind: 'asystole', bpm: 0 };
  if (s.status === 'rosc')       return { kind: 'nsr', bpm: 88 };
  // prefer current rhythm change, else initial
  const cur = (s.currentRhythm || '').toLowerCase();
  if (cur) {
    if (cur.includes('vf')) return { kind: 'vf', bpm: 75 };
    if (cur.includes('vt')) return { kind: 'pvt', bpm: 180 };
    if (cur.includes('pea')) return { kind: 'pea', bpm: 60 };
    if (cur.includes('asys')) return { kind: 'asystole', bpm: 0 };
    if (cur.includes('rosc')) return { kind: 'nsr', bpm: 88 };
    if (cur.includes('nsr')) return { kind: 'nsr', bpm: 75 };
  }
  switch (s.initialRhythm) {
    case 'vf':       return { kind: 'vf', bpm: 75 };
    case 'pvt':      return { kind: 'pvt', bpm: 180 };
    case 'pea':      return { kind: 'pea', bpm: 60 };
    case 'asystole': return { kind: 'asystole', bpm: 0 };
  }
  return { kind: 'nsr', bpm: 72 };
}

Object.assign(window, { ECGTrace, ecgKindFor });
