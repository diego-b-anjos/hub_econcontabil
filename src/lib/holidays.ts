/**
 * Utilitário de feriados brasileiros e dias úteis.
 * Inclui feriados nacionais fixos, variáveis (Páscoa/Carnaval/Corpus Christi)
 * e feriados estaduais de São Paulo.
 */

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** Domingo de Páscoa — algoritmo Meeus/Jones/Butcher */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Retorna um Set de strings "YYYY-MM-DD" com os feriados nacionais brasileiros.
 * Inclui feriados de São Paulo (estado + município) quando includeSP = true.
 */
export function getBrazilHolidays(year: number, includeSP = true): Set<string> {
  const set = new Set<string>();
  const e = easter(year);

  // Feriados nacionais fixos
  [
    `${year}-01-01`, // Confraternização Universal
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalho
    `${year}-09-07`, // Independência do Brasil
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Dia da Consciência Negra (Lei 14.759/2023)
    `${year}-12-25`, // Natal
  ].forEach((d) => set.add(d));

  // Feriados móveis nacionais
  set.add(fmt(addDays(e, -48))); // Segunda-feira de Carnaval
  set.add(fmt(addDays(e, -47))); // Terça-feira de Carnaval (Mardi Gras)
  set.add(fmt(addDays(e, -2)));  // Sexta-Feira Santa (Paixão de Cristo)
  set.add(fmt(addDays(e,  60))); // Corpus Christi

  // São Paulo — estado e município
  if (includeSP) {
    set.add(`${year}-01-25`); // Aniversário de São Paulo (município)
    set.add(`${year}-07-09`); // Revolução Constitucionalista (estado SP)
  }

  return set;
}

/**
 * Retorna o próximo dia útil a partir de `date` (inclusive).
 * Dia útil = segunda a sexta, fora dos feriados.
 */
export function nextWorkday(date: Date, holidays: Set<string>): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  while (d.getDay() === 0 || d.getDay() === 6 || holidays.has(fmt(d))) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Retorna o último dia útil do mês informado.
 */
export function lastWorkdayOfMonth(year: number, mes: number, holidays: Set<string>): Date {
  const daysInMonth = new Date(year, mes, 0).getDate();
  for (let d = daysInMonth; d >= 1; d--) {
    const dt = new Date(year, mes - 1, d);
    if (dt.getDay() !== 0 && dt.getDay() !== 6 && !holidays.has(fmt(dt))) {
      return dt;
    }
  }
  return new Date(year, mes - 1, daysInMonth);
}
