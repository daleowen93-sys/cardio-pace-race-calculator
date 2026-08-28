// Section 12 (confirmed decision #5): the default unit system is auto-detected
// from the user's browser/locale on first load (e.g. imperial for a US locale),
// falling back to metric whenever detection is inconclusive. This reads a browser
// global (navigator), so it lives in js/ui/ rather than js/logic/ (Section 15/17:
// logic modules stay pure/DOM-free) — but the detection itself is identical across
// all four calculators, so it's factored out here rather than duplicated per page.
export function prefersImperial() {
  try {
    const locale = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return locale.toLowerCase().startsWith('en-us');
  } catch {
    return false;
  }
}
