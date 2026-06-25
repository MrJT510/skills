# Changelog

## Design + practicality pass

Tuned for the real user: a first responder under stress who needs the app to
*tell them what to do* and never fight their judgment.

- **"Do next" promoted to the screen's hero.** The next-step guidance — the
  feature that keeps an average provider on-protocol mid-code — is now a large,
  high-contrast card with a phase-colored directive badge, gradient depth, and
  19px instruction text. It reads at a glance from arm's length. `chrome.jsx`

- **Airway respects provider judgment.** The airway list is guidance, not a
  forced ladder: providers can go straight to an LMA without intubating. Every
  option stays available in both modes. Pediatric leads with the supraglottic
  (LMA) device and keeps ETT available but ordered last (not a typical
  pediatric field step); adult leads with ETT. `tab-airway-cpr.jsx`

## Clinical-accuracy + capability pass

This pass cross-checked every clinical value in the app against the current
adult and pediatric prehospital cardiac-arrest protocols and added a missing
documentation capability. The existing design, flow, and identity were
preserved — changes are targeted.

### Clinical accuracy

- **Pediatric bag-valve-mask rate.** BVM now ventilates **1:3** in pediatric
  mode and **1:6** in adult mode (previously hard-coded to 1:6 in all modes).
  `tab-airway-cpr.jsx`

- **Pediatric airway ladder.** In pediatric mode the airway list now leads with
  the **supraglottic (LMA) device** and drops endotracheal intubation, which is
  not a pediatric field step. Adult mode is unchanged (ETT first-line → LMA →
  OPA). Each mode shows a one-line ladder caption. `tab-airway-cpr.jsx`

- **Traumatic arrest decision cues.** The persistent traumatic-arrest alert now
  states the do-not-resuscitate criteria (initial ECG asystole, PEA &lt; 40,
  or trauma center &gt; 20 min away) alongside the existing
  immediate-transport / withhold-Epi-if-exsanguinating guidance. `store.jsx`

### New capability

- **Resuscitation-status check at event open.** The launch screen gains a
  *Resuscitation status* card — **Full resuscitation / DNR · POLST / Obvious
  death**. Selecting a non-full status surfaces non-blocking guidance ("do not
  delay care while confirming"), writes an alert entry into the event log at
  `00:00`, and is carried into the case summary and the exported handoff record.
  `launch.jsx`, `store.jsx`, `tab-log-export.jsx`

### Verification

Rendered in a headless browser across adult, pediatric, and traumatic modes;
confirmed no console/runtime errors and no regressions to existing screens.
