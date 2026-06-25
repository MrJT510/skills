# Resuscribe — Prehospital Cardiac Arrest Timer

A glanceable, single-screen timer and documentation aid for prehospital
cardiac-arrest resuscitation. Built to keep a provider on-protocol during a
code: it tracks the event clock, the 2-minute pulse-check cycle, the
Epinephrine interval, shocks, airway, vascular access, medications, reversible
causes, and a full timestamped event log that exports as a clean handoff record
with **zero patient identifiers**.

The clinical content follows current AHA ACLS/PALS sequencing and is tuned to a
regional EMS prehospital care manual (adult + pediatric cardiac-arrest
protocols). No agency or county is named anywhere in the UI.

## Running it

The app is plain React via Babel-in-browser — no build step.

- **`index.html`** loads the modular `*.jsx` source files. Serve the folder
  over HTTP (Babel can't `XHR`-load the `.jsx` files from `file://`):

  ```sh
  npx serve .        # or: python3 -m http.server
  ```

- **`Resuscribe - Standalone.html`** is a self-contained single-file export
  (prior build). The modular `*.jsx` files are the source of truth; regenerate
  the standalone from them when publishing.

## Source layout

| File | Responsibility |
|------|----------------|
| `store.jsx` | Central state, persistence, drug/airway catalogs, Broselow + phase color tokens |
| `chrome.jsx` | Fixed top chrome: status bar, sub-timers, "Do next" guidance, primary actions, overlays, phase decisions |
| `launch.jsx` | Pre-event setup screen (patient mode, arrest type, scene info, resuscitation status) |
| `tab-rhythm.jsx` | Rhythm/defibrillation + reversible causes (H&T) |
| `tab-meds.jsx` | Medications (adult + weight-based pediatric) |
| `tab-airway-cpr.jsx` | Airway ladder, vascular access, ETCO₂, CPR/compressor tracking |
| `tab-log-export.jsx` | Event log + handoff export (share / clipboard) |
| `app.jsx` | Root composition + tweaks panel |
| `audio.jsx` / `ecg.jsx` / `ios-frame.jsx` / `icons.jsx` | Audio cues, ECG strip, device frame, icon set |

## Recent clinical & UX changes

See `CHANGES.md` for the latest pass (pediatric airway/ventilation accuracy,
traumatic do-not-resuscitate cues, and the launch-time resuscitation-status
check).
