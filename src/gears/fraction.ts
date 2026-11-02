/** Exact rational numbers so gear speeds never suffer floating-point drift. */
export interface Frac {
  readonly n: number; // numerator (sign lives here)
  readonly d: number; // denominator, always > 0
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error('Zero denominator');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
export const neg = (a: Frac): Frac => frac(-a.n, a.d);
export const eq = (a: Frac, b: Frac): boolean => a.n === b.n && a.d === b.d;
export const toNum = (a: Frac): number => a.n / a.d;
export const abs = (a: Frac): Frac => frac(Math.abs(a.n), a.d);

/** "1/3", "2", "-3/4" */
export function fmt(a: Frac): string {
  return a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`;
}

/** Friendly RPM text: whole numbers stay whole, otherwise one decimal. */
export function fmtRpm(a: Frac): string {
  const v = Math.abs(toNum(a));
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}
