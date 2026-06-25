// audio.jsx — subtle audio + haptic cue engine for code timers
// All sounds are soft sine/triangle blips kept deliberately gentle so they
// orient the team without adding stress. Haptics via navigator.vibrate.

const AudioEngine = (() => {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  // Call from a user gesture (START CPR) so iOS unlocks audio.
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function blip({ freq = 880, dur = 0.08, type = 'sine', gain = 0.12, attack = 0.005 }) {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master || c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  return {
    unlock,
    // very soft, short — used for the gentle pre-pulse countdown ticks
    softTick() { blip({ freq: 660, dur: 0.06, type: 'sine', gain: 0.05 }); },
    // slightly brighter tick as the window closes
    tick() { blip({ freq: 880, dur: 0.07, type: 'sine', gain: 0.09 }); },
    // pulse-check due — gentle two-note chime + short haptic
    pulseDue() {
      blip({ freq: 784, dur: 0.16, type: 'sine', gain: 0.16 });
      setTimeout(() => blip({ freq: 1047, dur: 0.22, type: 'sine', gain: 0.16 }), 150);
      vibrate([120, 60, 120]);
    },
    // epi due — soft low double-tone + haptic
    epiDue() {
      blip({ freq: 520, dur: 0.18, type: 'triangle', gain: 0.14 });
      setTimeout(() => blip({ freq: 392, dur: 0.24, type: 'triangle', gain: 0.14 }), 170);
      vibrate([200]);
    },
    vibrate,
  };
})();

// AudioCues — mounts inside the active screen, watches the store's timers,
// and fires cues on second-boundary edges (once each).
function AudioCues() {
  const { s } = useStore();
  const fired = React.useRef({});

  // Reset edge-tracking whenever a cycle resets
  React.useEffect(() => { fired.current = {}; }, [s.pulseCheckResetAt]);
  React.useEffect(() => { fired.current.epi = {}; }, [s.epiLastAt]);

  React.useEffect(() => {
    if (!s.audioEnabled) return;
    if (s.cprStartedAt == null || s.status === 'terminated' || s.status === 'arrived') return;
    if (s.pulseCheckOverlay) return; // paused while checking

    // Pulse-check countdown
    const pulseElapsed = s.elapsed - s.pulseCheckResetAt;
    const pulseRemain = Math.max(0, 120 - pulseElapsed);
    const f = fired.current;

    // Gentle ticks in the last 20s — every 5s, then a soft countdown at 3-2-1
    if ([20, 15, 10].includes(pulseRemain) && !f['p' + pulseRemain]) {
      f['p' + pulseRemain] = true; AudioEngine.softTick();
    }
    if ([5, 4, 3, 2, 1].includes(pulseRemain) && !f['p' + pulseRemain]) {
      f['p' + pulseRemain] = true; AudioEngine.tick();
    }
    if (pulseRemain === 0 && !f.pulse0) {
      f.pulse0 = true; AudioEngine.pulseDue();
    }

    // Epi timer — gentle alert the moment it becomes due (3:00) and overdue (5:00)
    if (s.epiLastAt != null) {
      const epiSec = s.elapsed - s.epiLastAt;
      f.epi = f.epi || {};
      if (epiSec === 180 && !f.epi.due) { f.epi.due = true; AudioEngine.epiDue(); }
      if (epiSec === 300 && !f.epi.over) { f.epi.over = true; AudioEngine.epiDue(); }
    }
  }, [s.elapsed, s.audioEnabled, s.cprStartedAt, s.status, s.pulseCheckOverlay, s.pulseCheckResetAt, s.epiLastAt]);

  return null;
}

Object.assign(window, { AudioEngine, AudioCues });
