// Exercise names match whatever their case and spacing at the ends.
export const nameKey = (name: string) => name.trim().toLowerCase();
export const sameName = (a: string, b: string) => nameKey(a) === nameKey(b);
