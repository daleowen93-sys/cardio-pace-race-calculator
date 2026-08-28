// Pure, DOM-free unit conversion functions for distance.
// Per PROJECT_BIBLE.md Section 12: canonical internal unit is metres.
// Per Section 15/17: calculator logic is separated from UI (no DOM code here).

export const METERS_PER_KM = 1000;
export const METERS_PER_MILE = 1609.344; // PROJECT_BIBLE.md Section 9, exact value
export const METERS_PER_YARD = 0.9144; // exact international yard, used by Swimming (Section 4)

export function kmToMeters(km) {
  return km * METERS_PER_KM;
}

export function metersToKm(meters) {
  return meters / METERS_PER_KM;
}

export function milesToMeters(miles) {
  return miles * METERS_PER_MILE;
}

export function metersToMiles(meters) {
  return meters / METERS_PER_MILE;
}

export function yardsToMeters(yards) {
  return yards * METERS_PER_YARD;
}

export function metersToYards(meters) {
  return meters / METERS_PER_YARD;
}
