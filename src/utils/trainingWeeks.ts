export interface TrainingWorkWeek {
  key: string;
  label: string;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(value: string | Date): Date | null {
  let date: Date;
  if (typeof value === 'string') {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    if (!year || !month || !day) return null;
    date = new Date(year, month - 1, day, 12);
  } else {
    date = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

export function getCalendarWeek(value: string | Date): TrainingWorkWeek | null {
  const date = parseLocalDate(value);
  if (!date) return null;

  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

  return {
    key: dateKey(monday),
    label: `${monday.toLocaleDateString('es-ES', options)}–${sunday.toLocaleDateString('es-ES', options)}`,
  };
}

export function getTrainingWorkWeek(value: string | Date): TrainingWorkWeek | null {
  const date = parseLocalDate(value);
  if (!date || date.getDay() === 0 || date.getDay() === 6) return null;
  return getCalendarWeek(date);
}

export function getRecentCompletedTrainingWeeks(referenceDate: Date, count: number): TrainingWorkWeek[] {
  const currentWeek = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 12);
  currentWeek.setDate(currentWeek.getDate() - ((currentWeek.getDay() + 6) % 7));

  return Array.from({ length: count }, (_, index) => {
    const week = new Date(currentWeek);
    week.setDate(week.getDate() - (count - index) * 7);
    return getTrainingWorkWeek(week);
  }).filter((week): week is TrainingWorkWeek => week !== null);
}