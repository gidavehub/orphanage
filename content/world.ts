// Where Haven stands with children: the world-flags ribbon, the presence map and hero chips.
// Developing-world focus (user brief 2026-10-02): Africa, South and Southeast Asia, the Arab
// world, the Caribbean and Central America, and the Pacific; no US, Europe, Australia or Gulf.
// lat/lon are approximate capital cities, used only to place map markers.
// After editing: `node scripts/art/flags-sprite.mjs` and `node scripts/art/world-map.mjs`.
// CLIENT: confirm the list.

export type Region = "Africa" | "Asia" | "Arab world" | "Americas" | "Pacific";
export type Country = { code: string; name: string; region: Region; lat: number; lon: number };

const A: Region = "Africa";

// All 54 African states, The Gambia (head office) first.
export const africa: Country[] = [
  { code: "gm", name: "The Gambia", region: A, lat: 13.45, lon: -16.58 },
  { code: "sn", name: "Senegal", region: A, lat: 14.69, lon: -17.44 },
  { code: "gw", name: "Guinea-Bissau", region: A, lat: 11.86, lon: -15.6 },
  { code: "gn", name: "Guinea", region: A, lat: 9.64, lon: -13.58 },
  { code: "sl", name: "Sierra Leone", region: A, lat: 8.48, lon: -13.23 },
  { code: "lr", name: "Liberia", region: A, lat: 6.3, lon: -10.8 },
  { code: "ci", name: "Côte d’Ivoire", region: A, lat: 6.82, lon: -5.28 },
  { code: "gh", name: "Ghana", region: A, lat: 5.6, lon: -0.19 },
  { code: "tg", name: "Togo", region: A, lat: 6.13, lon: 1.22 },
  { code: "bj", name: "Benin", region: A, lat: 6.5, lon: 2.6 },
  { code: "ng", name: "Nigeria", region: A, lat: 9.08, lon: 7.4 },
  { code: "ml", name: "Mali", region: A, lat: 12.64, lon: -8.0 },
  { code: "bf", name: "Burkina Faso", region: A, lat: 12.37, lon: -1.52 },
  { code: "ne", name: "Niger", region: A, lat: 13.51, lon: 2.11 },
  { code: "mr", name: "Mauritania", region: A, lat: 18.08, lon: -15.98 },
  { code: "cv", name: "Cabo Verde", region: A, lat: 14.93, lon: -23.51 },
  { code: "ma", name: "Morocco", region: A, lat: 34.02, lon: -6.84 },
  { code: "dz", name: "Algeria", region: A, lat: 36.75, lon: 3.06 },
  { code: "tn", name: "Tunisia", region: A, lat: 36.81, lon: 10.18 },
  { code: "ly", name: "Libya", region: A, lat: 32.89, lon: 13.19 },
  { code: "eg", name: "Egypt", region: A, lat: 30.04, lon: 31.24 },
  { code: "sd", name: "Sudan", region: A, lat: 15.5, lon: 32.56 },
  { code: "ss", name: "South Sudan", region: A, lat: 4.85, lon: 31.58 },
  { code: "td", name: "Chad", region: A, lat: 12.13, lon: 15.06 },
  { code: "cm", name: "Cameroon", region: A, lat: 3.85, lon: 11.5 },
  { code: "cf", name: "Central African Republic", region: A, lat: 4.39, lon: 18.56 },
  { code: "gq", name: "Equatorial Guinea", region: A, lat: 3.75, lon: 8.78 },
  { code: "ga", name: "Gabon", region: A, lat: 0.39, lon: 9.45 },
  { code: "st", name: "São Tomé and Príncipe", region: A, lat: 0.34, lon: 6.73 },
  { code: "cg", name: "Republic of the Congo", region: A, lat: -4.27, lon: 15.28 },
  { code: "cd", name: "DR Congo", region: A, lat: -4.32, lon: 15.31 },
  { code: "ao", name: "Angola", region: A, lat: -8.84, lon: 13.23 },
  { code: "et", name: "Ethiopia", region: A, lat: 9.03, lon: 38.74 },
  { code: "er", name: "Eritrea", region: A, lat: 15.32, lon: 38.93 },
  { code: "dj", name: "Djibouti", region: A, lat: 11.59, lon: 43.15 },
  { code: "so", name: "Somalia", region: A, lat: 2.05, lon: 45.32 },
  { code: "ke", name: "Kenya", region: A, lat: -1.29, lon: 36.82 },
  { code: "ug", name: "Uganda", region: A, lat: 0.35, lon: 32.58 },
  { code: "rw", name: "Rwanda", region: A, lat: -1.94, lon: 30.06 },
  { code: "bi", name: "Burundi", region: A, lat: -3.38, lon: 29.36 },
  { code: "tz", name: "Tanzania", region: A, lat: -6.16, lon: 35.75 },
  { code: "mw", name: "Malawi", region: A, lat: -13.96, lon: 33.79 },
  { code: "zm", name: "Zambia", region: A, lat: -15.39, lon: 28.32 },
  { code: "zw", name: "Zimbabwe", region: A, lat: -17.83, lon: 31.05 },
  { code: "mz", name: "Mozambique", region: A, lat: -25.97, lon: 32.57 },
  { code: "mg", name: "Madagascar", region: A, lat: -18.88, lon: 47.51 },
  { code: "km", name: "Comoros", region: A, lat: -11.7, lon: 43.26 },
  { code: "mu", name: "Mauritius", region: A, lat: -20.16, lon: 57.5 },
  { code: "sc", name: "Seychelles", region: A, lat: -4.62, lon: 55.45 },
  { code: "na", name: "Namibia", region: A, lat: -22.56, lon: 17.08 },
  { code: "bw", name: "Botswana", region: A, lat: -24.65, lon: 25.91 },
  { code: "za", name: "South Africa", region: A, lat: -25.75, lon: 28.19 },
  { code: "ls", name: "Lesotho", region: A, lat: -29.31, lon: 27.48 },
  { code: "sz", name: "Eswatini", region: A, lat: -26.31, lon: 31.14 },
];

// South and Southeast Asia, the Arab world, the Caribbean and Central America, and the Pacific.
export const world: Country[] = [
  { code: "in", name: "India", region: "Asia", lat: 28.61, lon: 77.21 },
  { code: "pk", name: "Pakistan", region: "Asia", lat: 33.68, lon: 73.05 },
  { code: "bd", name: "Bangladesh", region: "Asia", lat: 23.81, lon: 90.41 },
  { code: "ph", name: "Philippines", region: "Asia", lat: 14.6, lon: 120.98 },
  { code: "kh", name: "Cambodia", region: "Asia", lat: 11.56, lon: 104.92 },
  { code: "np", name: "Nepal", region: "Asia", lat: 27.72, lon: 85.32 },
  { code: "lk", name: "Sri Lanka", region: "Asia", lat: 6.93, lon: 79.86 },
  { code: "af", name: "Afghanistan", region: "Asia", lat: 34.53, lon: 69.17 },
  { code: "mm", name: "Myanmar", region: "Asia", lat: 19.76, lon: 96.08 },
  { code: "la", name: "Laos", region: "Asia", lat: 17.98, lon: 102.63 },
  { code: "vn", name: "Vietnam", region: "Asia", lat: 21.03, lon: 105.85 },
  { code: "id", name: "Indonesia", region: "Asia", lat: -6.2, lon: 106.85 },
  { code: "tl", name: "Timor-Leste", region: "Asia", lat: -8.56, lon: 125.57 },
  { code: "ye", name: "Yemen", region: "Arab world", lat: 15.37, lon: 44.19 },
  { code: "jo", name: "Jordan", region: "Arab world", lat: 31.95, lon: 35.93 },
  { code: "lb", name: "Lebanon", region: "Arab world", lat: 33.89, lon: 35.5 },
  { code: "sy", name: "Syria", region: "Arab world", lat: 33.51, lon: 36.29 },
  { code: "iq", name: "Iraq", region: "Arab world", lat: 33.31, lon: 44.36 },
  { code: "ps", name: "Palestine", region: "Arab world", lat: 31.9, lon: 35.2 },
  { code: "ht", name: "Haiti", region: "Americas", lat: 18.59, lon: -72.31 },
  { code: "gt", name: "Guatemala", region: "Americas", lat: 14.63, lon: -90.51 },
  { code: "hn", name: "Honduras", region: "Americas", lat: 14.07, lon: -87.19 },
  { code: "bo", name: "Bolivia", region: "Americas", lat: -16.5, lon: -68.15 },
  { code: "pg", name: "Papua New Guinea", region: "Pacific", lat: -9.44, lon: 147.18 },
  { code: "sb", name: "Solomon Islands", region: "Pacific", lat: -9.43, lon: 159.95 },
  { code: "fj", name: "Fiji", region: "Pacific", lat: -18.14, lon: 178.44 },
];

// Not a presence country: the US appears only for the Thanksgiving appeal (California office).
const extra: Country[] = [{ code: "us", name: "United States", region: "Americas", lat: 38.9, lon: -77.04 }];

export const countries: Country[] = [...africa, ...world];

/** Sprite geometry, shared by the bake script and <Flag>. Includes `extra` flags used outside the map. */
export const spriteCountries: Country[] = [...countries, ...extra];
export const FLAG_SPRITE = { src: "/flags/sprite.webp", cell: 96, cols: 12 } as const;

export const regions: Region[] = ["Africa", "Asia", "Arab world", "Americas", "Pacific"];

export const countryByCode = (code: string) => spriteCountries.find((c) => c.code === code);
