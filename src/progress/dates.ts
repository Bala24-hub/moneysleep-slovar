// Дни считаем по местному календарю: «через 1 день» = завтра, в любое время.
export type Day = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0');

export function dayOf(ts: number = Date.now()): Day {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parse(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // полдень — без сюрпризов с переходом на летнее время
}

export function addDays(day: Day, n: number): Day {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return dayOf(d.getTime());
}

export function daysBetween(a: Day, b: Day): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** Понедельник недели, в которую входит day. */
export function weekStart(day: Day): Day {
  const wd = (parse(day).getDay() + 6) % 7; // пн = 0
  return addDays(day, -wd);
}
