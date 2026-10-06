/** Lägger till värdet om det saknas i listan, annars tas det bort. Används för kryssrutor. */
export const toggle = <T>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
