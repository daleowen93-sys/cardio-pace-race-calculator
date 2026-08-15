# Working Standards for This Project

## Source of truth
PROJECT_BIBLE.md is the authoritative source of truth. Read the relevant sections before starting any task. If a new request conflicts with something already locked in the Bible, stop and flag the conflict with the user rather than silently deciding either way.

## Process
- Work in small, reviewable steps. Don't combine unrelated changes into one step.
- Logic (js/logic/) stays completely separate from UI (js/ui/) — pure functions, no DOM code in logic files.
- Build static structure/styling before wiring up live behavior, as separate reviewable steps.
- Never commit or push without the user explicitly saying to do so in that message — this applies even if file edits are set to auto-approve. Committing and pushing are always a distinct, separate ask.

## Showing your work
- When asked to show a file's contents, show the actual complete code — never a summary or description in place of it.
- Never claim something is "fixed," "verified," or "working" without actually running it and showing the real output. A plausible explanation is not proof.
- When you test something yourself, distrust results that could be coincidental (e.g. a number that looks unchanged could mean "correct" or could mean "silently stale" — these need to be told apart with evidence, not assumed).
- After writing calculation code, always test against at least one real-world known example (e.g. actual race times/distances), not just synthetic round numbers — this has caught real bugs that synthetic tests missed.
- Give the user a specific, concrete manual test sequence (exact inputs, exact expected outputs) for anything nontrivial, so they can independently verify in the browser themselves — don't rely solely on your own self-testing.

## Numbers and units
- Canonical internal units: metres for distance, seconds for duration. Convert only at input/output boundaries.
- Full precision is used for all calculation. Only the displayed value is ever rounded. Never chain a rounded display value into further maths.
- Any input field whose value is unit-dependent (e.g. a typed speed, pace, or custom distance) must store its full-precision value separately from its rounded displayed text — a "shadow" value in a fixed canonical unit. Toggling the unit system converts and updates the displayed text from the shadow; it must never reinterpret the same digits as meaning something new in the new unit. Only the user actually retyping the field updates the shadow. All calculations read from the shadow, never by re-parsing displayed text.

## Validation
Reject with a clear, specific error message: missing values, zero/negative where invalid, impossible time formats (e.g. seconds > 59). Extremely large values get a soft, non-blocking warning instead, using the amber --warning colour token (distinct from red errors) — the calculation still completes and displays normally alongside the warning.

## Keeping the Bible current
When a milestone is reached or a new pattern/decision is established (like the shadow-value pattern), propose the exact update text for PROJECT_BIBLE.md and show it before committing — don't silently update it without the user seeing the actual change first.
