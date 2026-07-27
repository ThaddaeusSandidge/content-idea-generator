export function cleanText(value: unknown, maxLength = 500): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
