// Design tokens portados de frontend/src/styles.css (:root) + tailwind.config.ts.
// Paleta warm off-white/oliva, heros escuros. (Tema claro por enquanto — dark mode futuro.)

export const colors = {
  page: '#F0EDE6',
  surface: '#FAFAF8',
  raised: '#F5F0E8',
  dark: '#1A1714',
  dark2: '#2C2925',
  dark3: '#222018',
  border: '#EDE8DF',
  border2: '#E8E2D8',

  green: '#6DBF6D',
  greenT: '#5C7A5C',
  greenM: '#7A9E7A',
  greenBg: '#EBF5EB',
  greenB: '#2D6B2D',

  conf: '#4CAF50',
  pend: '#E8A020',
  abs: '#E05050',
  confBg: '#EBF5EB',
  confT: '#2D6B2D',
  pendBg: '#FBF5E6',
  pendT: '#8A6A10',
  absBg: '#FBEBEB',
  absT: '#8A2020',

  gold: '#C8A020',
  silver: '#9098A0',
  bronze: '#A07848',

  ink: '#1A1714',
  ink2: '#5C5048',
  ink3: '#8A7F6E',
  ink4: '#B0A898',
  onDark: '#F5F0E8',
  onDark2: '#8A8078',
  danger: '#C07070',
} as const;

export const radius = {
  cardLg: 20,
  cardMd: 16,
  cardSm: 14,
  btn: 14,
  chip: 20,
  badge: 6,
  input: 12,
  logo: 16,
} as const;

export const spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
} as const;

export type ColorToken = keyof typeof colors;
