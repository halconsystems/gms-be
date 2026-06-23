/**
 * Parse dates from CSV/Excel bulk uploads.
 * Supports ISO (YYYY-MM-DD), DD/MM/YYYY, DD-MM-YYYY, and Excel serial numbers.
 */
export function parseFlexibleDate(value: unknown): Date | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && /^\d+(\.\d+)?$/.test(raw)) {
    // Excel serial date (days since 1899-12-30)
    if (numeric > 1000 && numeric < 100000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const date = new Date(excelEpoch + numeric * 86400000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const date = new Date(
      Date.UTC(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const date = new Date(
      Date.UTC(+dmyMatch[3], +dmyMatch[2] - 1, +dmyMatch[1]),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateFieldLabel(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}
