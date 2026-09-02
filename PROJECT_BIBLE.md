# Cardio Pace & Race Calculator — Project Bible

Version: 0.6
Status: All 5 calculators (Running, Cycling, Swimming, Triathlon, Hyrox) live and deployed. My Performance — PB Tracker & Goals: requirements and backend architecture (Supabase) confirmed; implementation (Phase C) not yet started.
Last updated: 3 September 2026
Project Owner (beginner developer, Windows)

## How to use this document
This is the single source of truth for the project. Every entry is labelled:

- **CONFIRMED** — approved, do not change without going through the conflict process
- **PROPOSED** — a recommendation, not yet approved
- **ASSUMPTION** — a conservative default used to keep moving, clearly reversible
- **REQUIRES DECISION** — blocks or affects MVP scope; needs your input
- **FUTURE IDEA** — explicitly out of scope for v1

Keep this file updated as decisions are confirmed. Paste it into this Project's Knowledge/Files so all specialist conversations can see it.

---

## 1. Product Vision
**CONFIRMED.** A polished, responsive web application that lets athletes calculate pace, speed, time and distance for Running, Cycling, Swimming and Triathlon, in both metric and imperial units, without needing multiple separate tools. Built as a foundation that can later expand into a mobile app and a broader endurance-training platform without a rebuild.

## 2. Problem Being Solved
**ASSUMPTION** (reasonable inference, not yet explicitly confirmed by you): Recreational and competitive endurance athletes currently rely on scattered, single-purpose calculators of inconsistent accuracy and inconsistent unit support, and have no single tool that handles all four disciplines with reliable maths and clean UX.

## 3. Target Users
**ASSUMPTION:** Recreational to serious age-group athletes (runners, cyclists, swimmers, triathletes) who want fast, accurate calculations on any device. No formal personas defined yet.
**REQUIRES DECISION (low priority):** Do we design for total beginners to the sport, competitive athletes, or both? This can wait until Product Scope & UX conversation.

## 4. Product Principles
**PROPOSED:**
1. Accuracy before features — never ship a calculator whose formula isn't documented and tested.
2. Simple, obvious UX — activity selection first, minimal fields, clear results.
3. Consistency — same interaction patterns across all four calculators.
4. Low cost to build and run.
5. Expandable without rebuilding (logic separated from UI).
6. Accessible by default, not bolted on later.

## 5. Confirmed Requirements
**CONFIRMED** (from your brief):
- Activity selection screen first (Running / Cycling / Swimming / Triathlon).
- Calculations: distance, time, pace, speed, race splits, estimated finishing times, standard race distances, custom distances.
- Running: min/km, min/mile, km, miles.
- Cycling: km/h, mph, km, miles.
- Swimming: pace/100m, pace/100yd, pace/500m, metres, yards.
- Triathlon: individual swim/bike/run calculations, transition times, individual leg times, total estimated finish time, standard and custom triathlon distances.
- Full metric/imperial support with accurate conversion.
- Responsive: desktop, tablet, mobile browsers.
- Calculator logic separated from UI (for future reuse in a mobile app).
- Canonical internal units: distance in metres, duration in seconds; convert only at input/output boundaries; never chain rounded values into further maths.

## 6. MVP Scope
**CONFIRMED (signed off 28 Aug 2026 — see Decision #2)**:
- 4 calculators: Running, Cycling, Swimming, Triathlon.
- Each calculator supports solving for the "missing" value (e.g. given distance + time, find pace; given pace + distance, find time; given pace + time, find distance).
- Standard race distances selectable from a list, plus a custom distance option, per activity.
- Metric/imperial switching.
- Fully responsive layout, no horizontal scrolling, usable one-handed on mobile.
- Client-side only — no accounts, no login, no server-side storage.
- No data persistence between sessions in v1 (results are not saved).

**Post-MVP expansion, 30 Aug 2026 (Decision #28):** a 5th calculator, Hyrox, was added — see Section 9 for its structure. It's a fixed-format total-time calculator (no solve-for-missing-value modes, no distance selection, no metric/imperial toggle), so it doesn't follow every bullet above the way the original 4 do.

**Post-MVP expansion, 1 Sep 2026 (Decision #31):** a new major feature, My Performance — PB Tracker & Goals, was approved — see Section 27. This is the first feature to require accounts and server-side persistence, both explicitly excluded from the original MVP above (see Section 7) — a deliberate, flagged expansion, not scope creep, and one the project's own Product Vision (Section 1) and Future Roadmap (Section 26) already anticipated. The 5 calculators themselves remain client-side-only and unaffected.

## 7. Items Excluded from MVP
**FUTURE IDEA** (explicitly deferred per your instructions, not to be added without approval):
- Dedicated mobile application
- Race planning tools
- Training tools
- AI-driven performance predictions
- Broader endurance-training platform features beyond My Performance V1 (see Section 27)

**No longer excluded, 1 Sep 2026 (Decision #31) — now in progress, not yet built:** User accounts/login and saved PB history, which were excluded here, are the foundation of My Performance — PB Tracker & Goals (Section 27). They move from "excluded" to "planned, requirements confirmed" — the actual auth/database technology and implementation are not yet built; see Section 24.

## 8. User Journeys
**PROPOSED (draft, to be refined in Product Scope & UX conversation):**
- **Primary journey:** Land on home screen → choose activity → land on that activity's calculator → choose "what am I solving for" (pace / time / distance / speed) → enter known values + units → see result.
- **Race-distance journey:** Choose activity → pick a standard distance (e.g. 10K, Half Marathon, Olympic Triathlon) instead of typing a custom one → enter pace or goal time → see splits/finish time.
- **Triathlon journey (more complex):** Choose Triathlon → pick standard or custom triathlon distance → enter swim/bike/run pace or speed for each leg → enter transition times → see individual leg times and total estimated finish time.

## 9. Calculator & Activity Structure
**CONFIRMED (units/measurements)** — table below is the reference for all calculator work.

| Activity | Metric units | Imperial units | Special formats |
|---|---|---|---|
| Running | km | miles | min/km, min/mile |
| Cycling | km | miles | km/h, mph |
| Swimming | metres | yards | pace/100m, pace/100yd, pace/500m |
| Triathlon | combination of the above per leg | combination of the above per leg | leg times, transitions, total time |
| Hyrox | metres/km only (fixed race spec, no imperial variant) | n/a — metric-only, even at US events | 16 fixed segment times, total time |

**CONFIRMED, 29 Jul 2026 — Running standard distances:** 1 Mile (1,609.344 m), 5K (5,000 m), 10K (10,000 m), Half Marathon (21,097.5 m / 21.0975 km), Marathon (42,195 m / 42.195 km), plus a custom distance field.

**CONFIRMED, 29 Jul 2026 — Cycling standard distances:** 40K Time Trial (40,000 m), Metric Century (100,000 m / 100 km), Century (160,934.4 m / 100 mi / 160.9344 km), plus a custom distance field.

**CONFIRMED, 29 Jul 2026 — Swimming standard distances:** 400m, 800m, 1500m (pool, Olympic distances), 5K and 10K (open water, World Aquatics standard distances), plus a custom distance field. Triathlon distances (Sprint, Olympic, 70.3, Full) are defined separately within the Triathlon calculator, not duplicated here.

**CONFIRMED, 29 Jul 2026 — Triathlon standard distances:** Sprint (750 m swim / 20,000 m bike / 5,000 m run), Olympic (1,500 m swim / 40,000 m bike / 10,000 m run), T100 (2,000 m swim / 80,000 m bike / 18,000 m run — 100 km total, a World Triathlon-recognised format from the PTO T100 series, sitting between Olympic and Half Distance), Half Distance — 70.3 mi total (1,900 m swim / 90,000 m bike / 21,097.5 m run), Full Distance — 140.6 mi total (3,800 m swim / 180,000 m bike / 42,195 m run), plus a custom distance field for each leg. Generic naming used for Half/Full Distance rather than the trademarked "Ironman" branding. All standard race distances (Running, Cycling, Swimming, Triathlon) are now confirmed — see Decision Log, Section 23.

**CONFIRMED, 30 Aug 2026 — Hyrox added as a 5th calculator (post-MVP; see Decision Log #28):** fixed 16-segment race structure, always in this order — Run 1km, SkiErg 1000m, Run 1km, Sled Push 50m, Run 1km, Sled Pull 50m, Run 1km, Burpee Broad Jumps 80m, Run 1km, Row 1000m, Run 1km, Farmers Carry 200m, Run 1km, Sandbag Lunges 100m, Run 1km, Wall Balls 100 reps (race ends here — no run after the final station). Distances/reps verified against current official HYROX specs (see sources in Decision #28); each of the 8 runs gets its own time input (Decision #29: individual splits, not one shared average) rather than a chip-selectable distance the way the other four calculators work, since the structure never varies. All 8 runs share one Time/Pace toggle (Decision #30, revised from an initial per-run design), showing the other metric underneath each run — trivial to compute since a 1km run's pace-per-km equals its time, unlike Triathlon's equivalent feature. Station weight/rep standards differ by division (Open/Pro, Men/Women), but weight doesn't affect the time math, so the calculator has no division selector (Decision #29) — every station is just a generic "time to complete" input with no pace toggle (stations have no natural pace concept). No metric/imperial toggle either: Hyrox race distances are fixed international metric specs, unlike Running/Cycling's dual-unit races.

## 10. Functional Requirements
**CONFIRMED (from brief):**
- Solve for pace, speed, time, or distance given the other two.
- Race split calculation.
- Estimated finishing time calculation.
- Standard and custom distance support.
- Metric/imperial conversion, accurate both ways.
- Triathlon: per-leg + transition + total time.

## 11. Non-Functional Requirements
**PROPOSED:**
- Responsive across desktop, tablet, mobile.
- Fast load (static site, minimal dependencies).
- Accessible (see Section 14).
- Low/zero hosting cost.
- Maintainable, modular, commented code.
- No build-step complexity beyond what's necessary for a beginner to manage.

## 12. Mathematical & Unit-Handling Principles
**CONFIRMED:**
- Internal canonical units: **metres** for distance, **seconds** for duration.
- Pace and speed are always *derived* from canonical distance/duration, never stored independently.
- Unit conversion happens only at the input boundary (user enters miles → convert to metres internally) and the output boundary (convert metres back to km/miles for display).
- Full-precision values are always used for further calculation; only the *displayed* value is rounded.
- **Default unit system (CONFIRMED, 22 Jul 2026):** auto-detected from the user's browser/locale on first load (e.g. imperial for a US locale, metric elsewhere). **Fallback rule (PROPOSED):** if detection is inconclusive, default to metric, since it's the global standard. This needs no further approval unless you'd like to change the fallback.

**CONFIRMED, 29 Jul 2026 — Running rounding rules:**
- Pace (min/km, min/mile): rounded to nearest whole second, round-half-up.
- Time (finish time, splits): rounded to nearest whole second, displayed h:mm:ss (or mm:ss under an hour).
- Distance: 2 decimal places (km/mi) for custom distances; standard distances show their label (e.g. "Half Marathon").
- All calculations always use the full-precision stored value, never a rounded display value.

**CONFIRMED, 29 Jul 2026 — Cycling rounding rules:**
- Speed (km/h, mph): rounded to 1 decimal place.
- Time (finish time, splits): rounded to nearest whole second, displayed h:mm:ss (or mm:ss under an hour).
- Distance: 2 decimal places (km/mi) for custom distances; standard distances show their label (e.g. "Metric Century").
- Race splits calculated every 10 km/mi (not every 1 km/mi), matching typical cycling pace granularity.
- All calculations always use the full-precision stored value, never a rounded display value.

**CONFIRMED, 29 Jul 2026 — Swimming rounding rules:**
- Pace (per 100m, per 100yd, per 500m): rounded to nearest whole second, displayed m:ss.
- Time (finish time, splits): rounded to nearest whole second, displayed h:mm:ss (or mm:ss under an hour).
- Distance: whole metres/yards, no decimal places, for custom distances; standard distances show their label (e.g. "1500m").
- Pace/500m displays only in metric mode; pace/100yd displays only in imperial mode.
- Race splits every 100m/100yd for distances up to 1500m; every 500m for 5K/10K.
- All calculations always use the full-precision stored value, never a rounded display value.

**CONFIRMED, 29 Jul 2026 — Triathlon rounding rules:** No new rounding rules are introduced — each leg (swim/bike/run) uses its own already-confirmed rounding (nearest second for pace/time). Total finish time is the sum of swim time + T1 + bike time + T2 + run time, rounded to the nearest whole second and displayed as h:mm:ss. All calculator rounding rules (Running, Cycling, Swimming, Triathlon) are now confirmed.

## 13. Input, Validation & Rounding Principles
**CONFIRMED (categories to handle, from your brief):**
- Missing values
- Zero values where invalid (e.g. zero time)
- Negative values
- Impossible time formats (e.g. 90 seconds entered as ":90")
- Unsupported units
- Extremely large values
- Decimal/rounding errors

**PROPOSED:** Every calculator's formula documentation (Section 12's per-calculator decision) must define required inputs, accepted units, internal units, formula, conversion method, rounding rule, validation rule, expected output, known edge cases, and test examples — **before** implementation begins, per your instructions.

**CONFIRMED, 29 Jul 2026 — Impossible time format handling (Running, and default for other calculators unless overridden):** Rejected with an inline error message (e.g. "Seconds must be between 0 and 59") rather than silently auto-corrected. Extremely large values show a soft warning but aren't blocked.

**CONFIRMED, 29 Jul 2026 — Cycling validation:** Inherits Running's confirmed rules — impossible time formats rejected with an inline error message. Extremely large values show a soft warning (not blocked) above roughly 2,000 km or 100 hours, to accommodate legitimate ultra-distance cycling events.

**CONFIRMED, 29 Jul 2026 — Swimming validation:** Inherits Running's confirmed rules — impossible time formats rejected with an inline error message. Extremely large values show a soft warning (not blocked) above roughly 50 km or 24 hours, to accommodate legitimate marathon/channel swims.

**CONFIRMED, 29 Jul 2026 — Triathlon validation:** Each leg validates using its own already-confirmed rules. Transition times (T1, T2): zero is a valid value, a blank field defaults to zero, negative values are rejected. Impossible time formats are rejected with an inline error message, consistent with all other calculators.

## 14. Accessibility Requirements
**PROPOSED:**
- Full keyboard navigation (tab order, enter-to-submit).
- Semantic HTML (proper labels, form elements, headings).
- Sufficient colour contrast (WCAG AA minimum).
- Visible focus states.
- Error messages that are programmatically associated with their field (for screen readers).
- Touch targets sized appropriately for mobile.

## 15. Initial Technical Architecture
**PROPOSED (REQUIRES DECISION for approval):**
- Client-side-only responsive web app. No backend/server needed for MVP (no accounts, no saved data).
- Calculator logic lives in its own set of plain JavaScript modules, completely independent of the UI/DOM — these modules are the part most likely to be reused in a future mobile app.
- UI layer calls into the logic modules and only handles display, input capture, and formatting.
- Static hosting (no server to run or pay for).

**Superseded in part, 1 Sep 2026 (Decision #31):** the "no backend/server needed" premise above applies to the 5 calculators only, which remain unchanged. My Performance — PB Tracker & Goals (Section 27) requires accounts and server-side persistence, so this project now has a backend of some form: **Supabase**, confirmed 3 Sep 2026 (Decision #35) — see Section 27.

## 16. Technology Decisions
**CONFIRMED — 22 July 2026.**

| Decision | Recommended option | Why |
|---|---|---|
| Frontend | Plain HTML, CSS, and JavaScript (ES modules), no framework | Zero build tooling to learn, runs by just opening a file or a simple static server, easiest on-ramp for a beginner, free to host, and the logic-separation principle (Section 15) means we don't lose the ability to move to a framework later. |
| Alternative considered | React | More "industry standard," component reuse is cleaner, but requires learning Node.js, npm, JSX, and a build step before writing your first calculator — meaningfully steeper for a beginner and not necessary for a 4-calculator MVP. |
| Testing | Jest, run via Node.js, testing only the logic modules (not the UI) | Free, extremely well documented, beginner-friendly, and lets us test formulas in isolation exactly as your brief requires. |
| Version control | Git + GitHub | Already confirmed by your project instructions. |
| Hosting | GitHub Pages | Free, integrates directly with the GitHub repo we're already using, no server to manage, perfectly suited to a static client-side app. |

**Confirmed approach:** vanilla HTML/CSS/JS + Jest + GitHub + GitHub Pages. This is the lowest-cost, lowest-complexity path that still meets every professional requirement in your brief (modular, testable, maintainable, expandable). If down the line the app grows into the mobile app / larger platform, the separated logic modules can be lifted into a React/React Native project with minimal rewriting.

## 17. Application Structure
**PROPOSED (draft skeleton, to be finalised once tech stack is approved):**
```
cardio-pace-race-calculator/
├── PROJECT_BIBLE.md            (this document — kept in sync with Claude Project Knowledge)
├── index.html                 (activity selection screen)
├── /running/
│   └── index.html
├── /cycling/
│   └── index.html
├── /swimming/
│   └── index.html
├── /triathlon/
│   └── index.html
├── /css/
│   └── styles.css
├── /js/
│   ├── /logic/                (pure calculation modules — no DOM code)
│   │   ├── running.js
│   │   ├── cycling.js
│   │   ├── swimming.js
│   │   ├── triathlon.js
│   │   └── unitConversion.js
│   └── /ui/                   (DOM/interaction code per activity)
│       ├── running-ui.js
│       ├── cycling-ui.js
│       ├── swimming-ui.js
│       └── triathlon-ui.js
├── /tests/
│   ├── running.test.js
│   ├── cycling.test.js
│   ├── swimming.test.js
│   ├── triathlon.test.js
│   └── unitConversion.test.js
└── README.md
```

## 18. UI/UX Decisions
**CONFIRMED, 22 July 2026:**
- Activity selection is the first screen a user sees (also Section 5).
- Unit switching uses **one global toggle for the whole app**, not a separate toggle per calculator — switching it updates every calculator consistently.
- The toggle does not persist between visits in v1 (no accounts/storage yet, per Section 7). On each visit, the default is re-detected per the rule in Section 12.

**CONFIRMED, 29 Jul 2026 — Visual design direction (v1, subject to refinement after review):**
- Style: clean, minimal, precise — welcoming to beginners and experienced athletes alike.
- Theme: follows device/system light-dark preference (prefers-color-scheme); no in-app manual toggle in v1.
- Typography: system font stack for UI text/labels; system monospace (tabular figures) for all numeric results and splits.
- Colour tokens — Light: background #F7F8F9, surface #FFFFFF, text #14171A, secondary text #5B6168, border #D8DBDF, warning #9A6700.
  Dark: background #121316, surface #1B1D21, text #F2F3F5, secondary text #9AA0A8, border #33363B, warning #F0B429.
  The warning token is used for Section 13's "soft warning" (extreme value) states — visually distinct from error red, since it doesn't block the calculation. Introduced for Cycling; reused consistently across all calculators (Swimming and Triathlon to follow).
- Activity accent colours (used sparingly — icons/labels/buttons, not backgrounds): Running #E85D4E, Cycling #2F8F3E, Swimming #0E8FA8, Triathlon #6A4FE0.
- Signature element: large bold monospace "hero" result number as the visual focus of every calculator screen.
- Layout: mobile-first, single-column, full-width tappable activity cards with a representative icon per activity, one primary focus per screen.

**CONFIRMED, 29 Jul 2026 — Result interaction model:**
- No explicit "Calculate" button. Results update live as the user edits any input field, taps a standard-distance chip, or switches solve-for mode (Pace/Time/Distance).
- Implementation note (for Frontend Development phase): live recalculation should debounce briefly after the last keystroke rather than firing on every keystroke, to avoid computing against incomplete input.

**CONFIRMED, 29 Jul 2026 — Triathlon solve-for model:**
- Triathlon does not use a Pace/Time/Distance solve-for toggle (unlike Running, Cycling, Swimming).
- Triathlon always takes distance (standard or custom, per leg) and time (or transition time) per leg as inputs, and always outputs total finish time as the result. No "solve backward" mode (e.g. required pace to hit a target finish time) is in v1 scope.

**CONFIRMED, 30 Jul 2026 — Responsive breakpoints:**
- Mobile (<640px): full-bleed, fills the entire viewport edge-to-edge, no visible frame.
- Tablet (640–1023px): content becomes a centered card (max-width 560px) with rounded corners and a soft shadow, floating on a neutral backdrop.
- Desktop (≥1024px): same centered-card pattern, max-width 640px, more surrounding whitespace.
- Same single-column layout and interaction patterns at all sizes — only the container width/framing changes, no per-breakpoint layout redesign.

Visual design direction, result interaction, Triathlon's solve-for model, and responsive breakpoints are all now confirmed (see below). UI/UX & Visual Design direction is complete; the next phase is Frontend Development.

## 19. Testing Strategy
**CONFIRMED (categories, from your brief):**
- Formula unit tests
- Unit-conversion tests
- Input-validation tests
- Known race-distance examples
- Metric vs imperial comparison tests
- Rounding tests
- Boundary/edge cases
- Mobile responsiveness
- Keyboard accessibility
- Clear error states
- Cross-browser checks
- Regression testing after every bug fix

**PROPOSED:** Logic-module tests written in Jest, run before every commit that touches calculation code. UI/responsiveness/accessibility tested manually against a documented checklist (to be built in the Testing, QA & Bug Fixes conversation).

## 20. Git & GitHub Workflow
**PROPOSED:**
- One GitHub repository for the whole project.
- Single `main` branch during MVP build (low complexity, single developer) — small, frequent, meaningful commits directly to `main` once each step is verified working.
- Commit messages describe what changed and why (e.g. `Add running pace calculator logic module`).
- Revisit branching strategy (e.g. feature branches) only if/when complexity grows — no need to over-engineer this now.

## 21. Deployment Approach
**CONFIRMED (for the 5 calculators):** GitHub Pages, deployed from the `main` branch. Free, no server management, updates automatically when you push changes once set up.

**RESOLVED, 3 Sep 2026 (Decision #35):** My Performance's backend is Supabase, a managed service — GitHub Pages keeps serving the static frontend unchanged, and the frontend calls Supabase directly via its client-side SDK. No new hosting to set up or pay for beyond Supabase's own free tier.

## 22. Development Phases
**PROPOSED high-level roadmap** (detail in the deliverables below):
0. Setup — GitHub repo, local tools, project skeleton
1. Finalise scope & open decisions (this conversation)
2. Document all calculator formulas, units, rounding & edge cases (Exercise Science conversation) — no code until this is done
3. UI/UX design direction (UI/UX conversation)
4. Build Running calculator (simplest, proves the pattern end-to-end)
5. Build Cycling calculator
6. Build Swimming calculator
7. Build Triathlon calculator (most complex, depends on the other three)
8. Full responsive polish + accessibility pass
9. Testing & QA pass
10. Deploy v1

**My Performance — PB Tracker & Goals phases (added 1 Sep 2026, Decision #31 — see Section 27):**
A. Product & requirements — confirmed 1 Sep 2026 (this phase)
B. Backend, Data & Architecture conversation — auth approach, backend/database technology, hosting shape, real schema, privacy model (REQUIRES DECISION — see Section 24)
C. Implement backend + auth per Phase B's decisions
D. Build My Performance UI for Strength
E. Build My Performance UI for Running, then fast-follow Cycling/Swimming
F. Testing & QA pass for My Performance, extending Section 19's approach to cover auth and persistence
G. Deploy
H. Future (not scheduled): calculator-to-goal integration, Triathlon/Hyrox performance tracking, then the wider roadmap (Section 26)

## 23. Decision Log
| # | Date | Decision | Status |
|---|---|---|---|
| 1 | 22 Jul 2026 | Project Bible established as the authoritative source of truth | CONFIRMED |
| 2 | 22 Jul 2026 | MVP = 4 calculators, client-side only, no accounts/saved data | CONFIRMED (signed off 28 Aug 2026 — built, tested, and deployed as specified) |
| 3 | 22 Jul 2026 | Tech stack: vanilla HTML/CSS/JS + Jest + GitHub Pages | CONFIRMED |
| 4 | 22 Jul 2026 | Unit switching: single global toggle, not per-calculator | CONFIRMED |
| 5 | 22 Jul 2026 | Default units: auto-detected from browser/locale, fallback to metric | CONFIRMED |
| 6 | 29 Jul 2026 | Running standard distances: 1 Mile, 5K, 10K, Half Marathon, Marathon + custom | CONFIRMED |
| 7 | 29 Jul 2026 | Running rounding rules (pace/time to nearest second, distance to 2 decimals) | CONFIRMED |
| 8 | 29 Jul 2026 | Impossible time formats rejected with error message, not auto-corrected | CONFIRMED |
| 9 | 29 Jul 2026 | Cycling standard distances: 40K, Metric Century, Century + custom | CONFIRMED |
| 10 | 29 Jul 2026 | Cycling rounding rules (speed to 1 decimal, time to nearest second, splits every 10km/mi) | CONFIRMED |
| 11 | 29 Jul 2026 | Cycling validation inherits Running's rules, with a higher large-value threshold | CONFIRMED |
| 12 | 29 Jul 2026 | Swimming standard distances: 400m, 800m, 1500m, 5K, 10K + custom (triathlon distances kept separate) | CONFIRMED |
| 13 | 29 Jul 2026 | Swimming rounding rules (pace to nearest second, distance whole units, mixed split granularity) | CONFIRMED |
| 14 | 29 Jul 2026 | Swimming validation inherits Running's rules, with a swim-specific large-value threshold | CONFIRMED |
| 15 | 29 Jul 2026 | Triathlon standard distances: Sprint, Olympic, T100, Half Distance, Full Distance + custom per leg (generic naming, not "Ironman" branding) | CONFIRMED |
| 16 | 29 Jul 2026 | Triathlon rounding: inherits per-leg rules, total time to nearest second | CONFIRMED |
| 17 | 29 Jul 2026 | Triathlon validation: transitions allow zero/default to zero, inherits other rules | CONFIRMED |
| 18 | 29 Jul 2026 | Visual design direction confirmed (palette, typography, layout concept) — provisional, may refine after implementation review | CONFIRMED |
| 19 | 29 Jul 2026 | Result interaction model confirmed: no Calculate button, live-updating results | CONFIRMED |
| 20 | 29 Jul 2026 | Triathlon solve-for model confirmed: no toggle, always outputs total time from per-leg inputs | CONFIRMED |
| 21 | 30 Jul 2026 | Responsive breakpoints confirmed: full-bleed mobile, centered card at tablet (640px+) and desktop (1024px+) | CONFIRMED |
| 22 | 14 Aug 2026 | Running calculator complete: logic module (pace/time/distance/validation/standard distances) and UI (all 3 solve-for modes) built, tested, and verified working | CONFIRMED |
| 23 | 29 Aug 2026 | Triathlon calculator complete: logic module (total time from per-leg times + transitions, standard distances) and UI (distance chips across all 3 legs, per-leg time inputs, T1/T2 transitions, mixed Metric/Imperial toggle) built, tested, and verified working | CONFIRMED |
| 23 | 15 Aug 2026 | Added --warning colour token (Light #9A6700, Dark #F0B429) for Section 13 soft-warning states, distinct from error red — introduced for Cycling, to be reused across all calculators | CONFIRMED |
| 24 | 28 Aug 2026 | Formal testing/QA pass (Section 19) complete: Jest suite (92 tests) covering all 5 logic modules; manual browser QA across all 4 calculators for mobile responsiveness, keyboard accessibility, error states, and dark mode. Found and fixed a gap: Running was missing the Section 13 extreme-value soft warning present in Cycling/Swimming — now added and covered by tests. | CONFIRMED |
| 25 | 28 Aug 2026 | Superseded Decision #5: default units are now always metric on load, regardless of browser locale (locale-based auto-detection removed per user request) | CONFIRMED |
| 26 | 28 Aug 2026 | Superseded Decision #20: Triathlon now supports per-leg Pace (swim/run) or Speed (bike) input as an alternative to direct Time — that leg's duration is computed from its distance via calculateTime, reused from running.js/cycling.js/swimming.js. Triathlon still has no overall distance-solving mode. | CONFIRMED |
| 27 | 28 Aug 2026 | Extended Decision #9: Cycling standard distances now also include 50K, 90K, and 180K alongside the original 40K Time Trial, Metric Century, and Century | CONFIRMED |
| 28 | 30 Aug 2026 | Hyrox added as a 5th calculator, expanding beyond the original 4-calculator MVP (Decision #2). Official 16-segment structure and station distances/reps verified via web search against current HYROX specs (Red Bull and hyroxfitness.com station guides) rather than assumed from memory, per this project's testing standard. | CONFIRMED |
| 29 | 30 Aug 2026 | Hyrox UX decisions: (a) each of the 8 runs gets its own individual time input rather than one shared average pace, to reflect realistic fatigue-driven pacing; (b) no division/weight selector — all 8 stations are generic "time to complete" inputs, since station weight doesn't affect the time math | CONFIRMED |
| 30 | 31 Aug 2026 | Extended Decision #29: the 8 Hyrox runs share ONE Time/Pace toggle (revised same day from an initial per-run-toggle design), showing the other metric underneath each run. Since every Hyrox run is exactly 1km, pace-per-km and time-for-that-run are the same number, so this needed no unit-conversion round-trip through running.js — unlike Triathlon's equivalent feature. A single shared toggle was chosen over 8 independent ones because run splits realistically all come from the same source in one sitting (a watch, or a pacing plan) — mixing modes per run isn't a real need. The 8 stations were not extended this way; they have no natural pace concept. | CONFIRMED |
| 31 | 1 Sep 2026 | My Performance — PB Tracker & Goals approved as the next major feature, expanding beyond the original 4/5-calculator MVP (Decision #2) into accounts + server-side persistence for the first time. This is a deliberate, flagged expansion the project's own Product Vision (Section 1) and Future Roadmap (Section 26) already anticipated, not scope creep. Full requirements analysis in Section 27. | CONFIRMED |
| 32 | 1 Sep 2026 | My Performance V1 scope confirmed: Strength + Running categories only (Cycling/Swimming to fast-follow — same data shape); current PB is always computed from logged history, never stored as its own field; strength "current PB" ranked by best estimated 1RM (not a separate PB-type system); one active goal per exercise/category, no deadlines/history; progress shown as a plain chronological list, not charts; no calculator-to-goal UI integration in V1. See Section 27 for full detail. | CONFIRMED |
| 33 | 1 Sep 2026 | Triathlon/Hyrox performance tracking explicitly deferred from My Performance V1 despite being part of the long-term hybrid-athlete vision — their composite multi-segment shape isn't needed to validate the core tracker. The data model should allow for them later without a rebuild, but no UI/entry forms are built for them now. | CONFIRMED |
| 34 | 1 Sep 2026 | Authentication approach, database/backend technology, hosting shape for My Performance, and the real schema are explicitly NOT decided in this conversation — deferred to a dedicated Backend, Data & Architecture conversation, per Decision #31's requirements as input. See Section 24. | RESOLVED — see Decision #35 |
| 35 | 3 Sep 2026 | Backend, Data & Architecture decisions for My Performance confirmed: Supabase (Postgres + bundled auth + storage) over Firebase, chosen for the relational fit of the data model, SQL as a transferable skill, and lower long-term lock-in risk; Row-Level Security for privacy; GitHub Pages frontend unchanged, calling Supabase via its client SDK; a single `performance_entries` table with a `type` discriminator rather than separate strength/endurance tables. Full reasoning and first-pass table list in Section 27. | CONFIRMED |

## 24. Risks & Unresolved Questions
Standard race distances and rounding rules are confirmed for all four calculators (Running, Cycling, Swimming, Triathlon) as of 29 Jul 2026 — see Decision Log, Section 23, items 6–17. MVP scope as a whole set (Section 6, Decision #2) was signed off 28 Aug 2026.

**RESOLVED, 3 Sep 2026 (Decision #35) — My Performance backend:** see Section 27's "Confirmed architecture" for the full decision and reasoning. Summary: Supabase (Postgres + bundled auth + storage), Row-Level Security for privacy, GitHub Pages frontend unchanged, single `performance_entries` table with a `type` discriminator rather than separate strength/endurance tables.

**Lower-priority, can wait:**
- Visual design direction/branding.
- Whether v1 should be a Progressive Web App (offline support) — currently out of scope unless you want to add it.

## 25. Current Project Status
Version 0.3 of the Project Bible. Technology stack, global unit-toggle behaviour, and default-unit detection are confirmed. Phase 0 (setup) is complete: GitHub repository cardio-pace-race-calculator created under account da1eowen93-sys, connected via GitHub Desktop, folder/file skeleton scaffolded per Section 17, and pushed to GitHub.com — verified 22 Jul 2026. No application code has been written yet (all scaffolded files are intentionally empty). Standard race distances, per-calculator rounding rules, and input validation for all four calculators (Running, Cycling, Swimming, Triathlon) are now fully confirmed — verified 29 Jul 2026. The next phase is UI/UX & Visual Design, to establish layout, colour, and typography before any code is written. UI/UX & Visual Design direction — visual style, typography, colour tokens, result interaction model, Triathlon's solve-for model, and responsive breakpoints — is now fully confirmed, verified 30 Jul 2026, via an interactive mockup reviewed across mobile, tablet, and desktop. No production application code has been written yet. The next phase is Frontend Development, beginning with the Running calculator per the locked build order in Section 22. Frontend Development is now complete for all four calculators — Running, Cycling, Swimming, and Triathlon each have a working logic module and a fully wired UI, verified 29 Aug 2026. Formal testing & QA (Section 19) is now complete, verified 28 Aug 2026: a Jest suite of 92 tests covers formula correctness, unit conversion, validation, and rounding across all five logic modules, and a manual browser QA pass confirmed mobile responsiveness, keyboard accessibility, and error states across all four calculators — during which a missing extreme-value warning on the Running calculator was found and fixed for consistency with Cycling and Swimming. Cross-browser testing was limited to a Chromium-based browser in this environment. Deployment is complete: the app is live on GitHub Pages. Two post-deployment refinements were made 28 Aug 2026: unit auto-detection was removed in favour of always defaulting to metric, and Triathlon gained a per-leg Pace/Speed input mode alongside the original direct-Time input. A 5th calculator, Hyrox, was added 30 Aug 2026 as a post-MVP expansion (Decision #28) — a fixed 16-segment total-time calculator, verified against official HYROX race specs and a hand-calculated example (8x 5:00 runs + 8x 3:00 stations = 1:04:00). On 1 Sep 2026, a new major feature — My Performance: PB Tracker & Goals — was approved (Decision #31), the project's first move beyond a purely client-side, stateless app. Requirements, V1 scope, user journeys, and conceptual data entities are confirmed and documented in Section 27. On 3 Sep 2026, the Backend, Data & Architecture decisions were confirmed (Decision #35): Supabase (Postgres, bundled auth, Row-Level Security), GitHub Pages frontend unchanged, single `performance_entries` table with a type discriminator. No code has been written and no Supabase project exists yet — that's Phase C, starting next.

## 26. Future Roadmap
**FUTURE IDEA (not part of v1, listed here only to keep architecture expansion-friendly):**
- Dedicated mobile app (reusing the logic modules from Section 15/17)
- Race planning tools
- Training tools
- AI-driven performance predictions / AI-generated hybrid training programs
- Full workout programming
- Human coaching interaction
- Race-day nutrition planning, sweat-rate/hydration tools
- Social features: feed, followers, kudos, comments, direct messaging, leaderboards
- Photo/video attachments to achievements
- Wearable integrations (Garmin, Strava, Apple Health)
- Broader hybrid-athlete platform beyond My Performance V1

**Moved from here into active planning, 1 Sep 2026 (Decision #31):** user accounts and saved performance history are no longer just a future idea — they're the confirmed subject of My Performance — PB Tracker & Goals (Section 27), currently at the requirements stage.

## 27. My Performance — PB Tracker & Goals

**CONFIRMED, 1 Sep 2026 (Decisions #31–#33) — purpose and strategic role:** a single place for a user to store, view, and track personal best performances across strength and endurance sports, and set goals against them. This is the first step toward the long-term hybrid-athlete platform described below — not the whole thing.

**Long-term vision (FUTURE IDEA, informs the data model but is NOT being built now):** track strength and endurance performance and full lift history; store race/endurance PBs; set goals; attach photos/videos to achievements; log training; receive AI-generated hybrid training programs; plan around multiple simultaneous sport goals; race-day nutrition planning; sweat-rate/hydration tools; social sharing, followers, kudos, comments; interaction with real coaches. None of this is scheduled — see Section 26.

**CONFIRMED — V1 scope (Decision #32):**
- User accounts (basic auth — technology TBD, Section 24) and a minimal profile (display name only; no bio/photo/settings in V1).
- Two categories only: **Strength** and **Running**. Cycling/Swimming are the same underlying data shape as Running (distance + time + date) and are the intended fast-follow, not full V1. Triathlon/Hyrox are a third, more complex composite shape and are explicitly deferred (Decision #33).
- Strength entry fields: exercise, weight, reps, date, optional bodyweight, optional notes.
- Running entry fields: distance (standard or custom — reusing the same distances already confirmed in Section 9 where sensible), time, date. Pace is derived, never stored.
- **Current PB is always computed from logged history, never stored as its own field.** Every logged attempt is kept; "current PB" is whichever historical entry ranks best under a fixed rule, queried on demand. This avoids stale-cache bugs and keeps the door open to new ranking rules later without a schema change.
- **Strength PB ranking rule for V1: best estimated 1RM**, computed from each entry's weight + reps via a standard formula (formula choice deferred to implementation, not a product decision). This deliberately does NOT assume every PB is a literal 1-rep attempt — any logged rep range contributes, made comparable via the estimated-1RM conversion. Rep PBs, Weight PBs, and Volume PBs are NOT separate tracked features in V1; they remain possible later as new queries over the same stored (weight, reps, date) data, requiring no new fields.
- **Running PB ranking rule for V1: fastest time at a given distance.**
- **Goals:** one active goal value per exercise/category. No deadlines, no goal history/versioning, no multiple simultaneous goals per item in V1.
- **Progress view:** a plain chronological list (date + value + notes) per exercise/category. No charts/graphs in V1.
- **No calculator-to-goal integration UI in V1** (e.g. no "set 19:59 as my 5K goal" button from a calculator result) — deferred, but the data model must not preclude it later (see below).

**CONFIRMED — architecturally anticipated but NOT built in V1 (Decision #32/#33):**
- Cycling and Swimming as full My Performance categories.
- Rep PBs / Weight PBs / Volume PBs as distinct views.
- Triathlon and Hyrox performance records — a composite, multi-segment shape the data model should be able to accommodate later without a rebuild, but with no entry forms or UI now.
- A "set as goal" action linking a calculator result directly to a My Performance goal. This app's canonical units (metres, seconds — Section 12) already match what a tracker would store, so this is intended to be a thin later integration rather than a redesign, provided My Performance's own schema (chosen in the Backend, Data & Architecture conversation) also speaks metres/seconds internally.
- Any field for attaching media to a PB entry — no upload/storage built, but the entry shape shouldn't actively block adding one later.

**CONFIRMED — explicitly OUT of scope for this phase (not even architected for yet):** social feed, followers, kudos, comments, direct messaging, AI-generated training programs, human coaching, actual photo/video upload and storage, wearable integrations (Garmin/Strava/Apple Health), nutrition/hydration tracking, full workout programming, leaderboards. These require dedicated design work of their own if and when they're prioritised.

**CONFIRMED — main user journeys:**
1. Sign up / log in → land on My Performance home (empty state prompts a first entry).
2. Log a strength PB → pick/add exercise → weight, reps, date, optional bodyweight/notes → save → history updates, current PB (and its estimated 1RM) recalculated.
3. Log a running PB → pick standard or custom distance → time, date → save → history updates, current PB recalculated, pace shown as derived context.
4. View an exercise/category page → current PB, active goal (if set), full chronological history.
5. Set/update a goal → enter target → shown alongside current PB with the difference.
6. My Performance home → summary across tracked items (current PB + goal per item).

**CONFIRMED — major data entities (conceptual):**
- **User** — owns everything below.
- **Profile** — 1:1 with User, kept separate from the auth record for future flexibility.
- **ExerciseDefinition** — the strength catalog (e.g. Bench Press, Back Squat).
- **SportCategory** — Running now; Cycling/Swimming/Triathlon/Hyrox later, mirroring the existing calculator activities (Section 9).
- **PerformanceEntry** — the single historical ledger: user, category/exercise, date, and type-specific values (strength: weight+reps+optional bodyweight+notes; endurance: distance+time). Current PB is a query over this table, never its own row.
- **Goal** — user + exercise/category + target value.
- Relationships: User 1—1 Profile; User 1—many PerformanceEntry; User 1—many Goal; PerformanceEntry many—1 ExerciseDefinition-or-(SportCategory+Distance); Goal many—1 ExerciseDefinition-or-(SportCategory+Distance).

**CONFIRMED, 3 Sep 2026 (Decision #35) — architecture:**
- **Backend/database: Supabase** (managed Postgres + bundled auth + file storage + auto-generated APIs), chosen over Firebase because the data model above is inherently relational (and gets more so with later relational features like leaderboards/following), SQL is a more transferable beginner skill than a proprietary query language, and Postgres being open-source reduces long-term lock-in risk — directly serving the stated goal of not needing a rebuild if the product succeeds. Firebase's stronger historical mobile-SDK maturity was the acknowledged tradeoff given up.
- **Auth: Supabase Auth** (bundled with the above) rather than rolling custom auth or a separate standalone auth vendor — one platform, one SDK, and the logged-in user's ID is natively understood by the same database.
- **Privacy: Row-Level Security.** Every table carries a `user_id` column; Postgres policies enforce "a user can only read/write their own rows" at the database level, not just in application code.
- **Hosting: unchanged.** The 5 calculators and the future My Performance UI stay on GitHub Pages as a static site; the frontend calls Supabase directly via its client-side SDK. No server for the project owner to run or pay for beyond Supabase's own managed service.
- **Schema shape: a single `performance_entries` table with a `type` discriminator** (`strength` | `endurance`) and nullable type-specific columns, rather than separate strength/endurance tables — simpler to query with only two V1 shapes; a genuinely different future shape (Triathlon's composite legs) can become its own related table later without disturbing this one.
- **First-pass table list (still conceptual, not a migration script):** `profiles` (id, display_name, created_at); `sport_categories` (reference data — `running` for V1); `exercise_definitions` (reference data — strength catalog); `performance_entries` (user_id, type, category/exercise reference, entry_date, weight/reps/bodyweight/notes OR distance_meters/duration_seconds); `goals` (user_id, category/exercise reference, target_value).

**CONFIRMED — development phases:** see Section 22's "My Performance" phase list (A–H). Phases A (requirements) and B (backend architecture) are complete. Phase C (implement the Supabase project, schema, and auth) is next.
