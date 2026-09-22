/** أدوات مشتركة لفلاتر الفترة المالية (القيود والتقارير). */

/** يحوّل قيمة حقل التاريخ (YYYY-MM-DD) إلى Date أو undefined إن كانت غير صالحة. */
export function parseDateParam(
  value: string | undefined,
  endOfDay = false,
): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (endOfDay) parsed.setHours(23, 59, 59, 999);
  else parsed.setHours(0, 0, 0, 0);
  return parsed;
}

/** أول يوم في السنة الميلادية الحالية. */
export function startOfCurrentYear(reference = new Date()): Date {
  return new Date(reference.getFullYear(), 0, 1, 0, 0, 0, 0);
}

export function endOfDay(reference = new Date()): Date {
  const date = new Date(reference);
  date.setHours(23, 59, 59, 999);
  return date;
}

/** صيغة YYYY-MM-DD المطلوبة لحقول <input type="date"> (بتوقيت محلي). */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
