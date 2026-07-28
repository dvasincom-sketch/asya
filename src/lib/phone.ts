// Приводим телефон к единому виду: только цифры с ведущим +.
export function normalizePhone(input: string): string {
  const digits = String(input).replace(/\D/g, "");
  return "+" + digits;
}
