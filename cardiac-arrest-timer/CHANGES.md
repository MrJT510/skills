# Changelog

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
