/**
 * Client-side parsing and validation for admin bulk user import (CSV / JSON).
 * Server persists via POST /auth/admin/create-user (Prisma).
 */

export const IMPORT_CSV_HEADERS = [
  'email',
  'password',
  'displayName',
  'username',
  'fullName',
  'photoUrl',
  'bio',
  'websiteUrl',
  'location',
  'birthday',
  'languageCode',
  'timezone',
  'preferences',
] as const;

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;

export type AdminCreateUserPayload = {
  email: string;
  password: string;
  displayName?: string;
  username?: string;
  fullName?: string;
  photoUrl?: string;
  bio?: string;
  websiteUrl?: string;
  location?: string;
  birthday?: string;
  languageCode?: string;
  timezone?: string;
  preferences?: Record<string, unknown>;
};

const PAYLOAD_KEYS: (keyof AdminCreateUserPayload)[] = [
  'email',
  'password',
  'displayName',
  'username',
  'fullName',
  'photoUrl',
  'bio',
  'websiteUrl',
  'location',
  'birthday',
  'languageCode',
  'timezone',
  'preferences',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result.map((s) => s.trim());
}

function detectDelimiter(headerLine: string): ',' | ';' {
  const comma = (headerLine.match(/,/g) || []).length;
  const semi = (headerLine.match(/;/g) || []).length;
  return semi > comma ? ';' : ',';
}

function normalizeHeaderCell(s: string): string {
  return s.trim().replace(/^\uFEFF/, '').toLowerCase();
}

export type ParsedImport =
  | { ok: true; rows: AdminCreateUserPayload[]; fileError?: undefined }
  | { ok: false; fileError: string };

function emptyToUndefined(s: string | undefined): string | undefined {
  if (s === undefined || s === '') return undefined;
  return s;
}

function parsePreferencesCell(raw: string | undefined): Record<string, unknown> | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  try {
    const v = JSON.parse(t) as unknown;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      return undefined;
    }
    return v as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function validatePayloadRow(
  row: AdminCreateUserPayload,
  rowLabel: string
): string | null {
  if (!row.email?.trim()) return `${rowLabel}: email is required`;
  if (!EMAIL_RE.test(row.email.trim())) return `${rowLabel}: invalid email format`;
  if (!row.password) return `${rowLabel}: password is required`;
  if (row.password.length < 6) return `${rowLabel}: password must be at least 6 characters`;
  if (row.displayName != null && row.displayName.length > 100)
    return `${rowLabel}: displayName must not exceed 100 characters`;
  if (row.username != null && row.username.length > 50)
    return `${rowLabel}: username must not exceed 50 characters`;
  if (row.fullName != null && row.fullName.length > 100)
    return `${rowLabel}: fullName must not exceed 100 characters`;
  if (row.photoUrl != null && row.photoUrl.length > 500)
    return `${rowLabel}: photoUrl must not exceed 500 characters`;
  if (row.bio != null && row.bio.length > 500)
    return `${rowLabel}: bio must not exceed 500 characters`;
  if (row.websiteUrl != null && row.websiteUrl.length > 200)
    return `${rowLabel}: websiteUrl must not exceed 200 characters`;
  if (row.location != null && row.location.length > 100)
    return `${rowLabel}: location must not exceed 100 characters`;
  if (row.languageCode != null && row.languageCode.length > 5)
    return `${rowLabel}: languageCode must not exceed 5 characters`;
  if (row.timezone != null && row.timezone.length > 50)
    return `${rowLabel}: timezone must not exceed 50 characters`;
  if (row.birthday != null && row.birthday !== '') {
    if (Number.isNaN(Date.parse(row.birthday))) {
      return `${rowLabel}: birthday must be a valid ISO date (YYYY-MM-DD)`;
    }
  }
  return null;
}

function pickPayload(obj: Record<string, unknown>): AdminCreateUserPayload {
  const out: Partial<AdminCreateUserPayload> = {};
  if (typeof obj.email === 'string') out.email = obj.email;
  if (typeof obj.password === 'string') out.password = obj.password;
  const str = (k: keyof AdminCreateUserPayload) => {
    const v = obj[k as string];
    if (typeof v === 'string') (out as Record<string, string>)[k as string] = v;
  };
  str('displayName');
  str('username');
  str('fullName');
  str('photoUrl');
  str('bio');
  str('websiteUrl');
  str('location');
  str('birthday');
  str('languageCode');
  str('timezone');
  const p = obj.preferences;
  if (p != null && typeof p === 'object' && !Array.isArray(p)) {
    out.preferences = p as Record<string, unknown>;
  }
  return out as AdminCreateUserPayload;
}

export function parseImportFileContent(
  fileName: string,
  text: string
): ParsedImport {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.csv') && !lower.endsWith('.json')) {
    return { ok: false, fileError: 'Unsupported file format. Please use .csv or .json' };
  }
  if (!text.trim()) {
    return { ok: false, fileError: 'File is empty' };
  }

  if (lower.endsWith('.json')) {
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, fileError: 'Invalid JSON format. Expected an array of objects' };
    }
    if (!Array.isArray(data)) {
      return { ok: false, fileError: 'Invalid JSON format. Expected an array of objects' };
    }
    if (data.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        fileError: `Too many rows. Maximum is ${MAX_IMPORT_ROWS} users per file`,
      };
    }
    const rows: AdminCreateUserPayload[] = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return { ok: false, fileError: `Invalid JSON: item at index ${i} must be an object` };
      }
      rows.push(pickPayload(item as Record<string, unknown>));
    }
    return { ok: true, rows };
  }

  // CSV
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      ok: false,
      fileError: `Invalid CSV format. Expected header row and at least one data row (${IMPORT_CSV_HEADERS.join(', ')})`,
    };
  }
  const delimiter = detectDelimiter(lines[0]);
  const headerCells = parseCsvRow(lines[0], delimiter).map(normalizeHeaderCell);
  const expected = IMPORT_CSV_HEADERS.map((h) => h.toLowerCase());
  if (headerCells.length !== expected.length) {
    return {
      ok: false,
      fileError: `Invalid CSV: expected ${expected.length} columns, got ${headerCells.length}`,
    };
  }
  for (let i = 0; i < expected.length; i++) {
    if (headerCells[i] !== expected[i]) {
      return {
        ok: false,
        fileError: `Invalid CSV header at column ${i + 1}: expected "${IMPORT_CSV_HEADERS[i]}", got "${parseCsvRow(lines[0], delimiter)[i]?.trim() ?? ''}"`,
      };
    }
  }

  const dataLines = lines.slice(1);
  if (dataLines.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      fileError: `Too many rows. Maximum is ${MAX_IMPORT_ROWS} users per file`,
    };
  }

  const rows: AdminCreateUserPayload[] = [];
  for (const line of dataLines) {
    const cells = parseCsvRow(line, delimiter);
    if (cells.length !== IMPORT_CSV_HEADERS.length) {
      return {
        ok: false,
        fileError: `Invalid CSV: a row has ${cells.length} columns, expected ${IMPORT_CSV_HEADERS.length}`,
      };
    }
    const prefRaw = cells[12];
    let preferences: Record<string, unknown> | undefined;
    if (prefRaw?.trim()) {
      const p = parsePreferencesCell(prefRaw);
      if (!p) {
        return {
          ok: false,
          fileError: `Invalid CSV: row ${rows.length + 2}: preferences must be valid JSON object string`,
        };
      }
      preferences = p;
    }
    rows.push({
      email: cells[0],
      password: cells[1],
      displayName: emptyToUndefined(cells[2]),
      username: emptyToUndefined(cells[3]),
      fullName: emptyToUndefined(cells[4]),
      photoUrl: emptyToUndefined(cells[5]),
      bio: emptyToUndefined(cells[6]),
      websiteUrl: emptyToUndefined(cells[7]),
      location: emptyToUndefined(cells[8]),
      birthday: emptyToUndefined(cells[9]),
      languageCode: emptyToUndefined(cells[10]),
      timezone: emptyToUndefined(cells[11]),
      preferences,
    });
  }
  return { ok: true, rows };
}

export function validateRowsForDuplicatesAndFields(
  rows: AdminCreateUserPayload[]
): { validRows: AdminCreateUserPayload[]; preFailures: Array<{ email: string; reason: string }> } {
  const seen = new Set<string>();
  const preFailures: Array<{ email: string; reason: string }> = [];
  const validRows: AdminCreateUserPayload[] = [];

  rows.forEach((row, idx) => {
    const label = `Row ${idx + 1}`;
    const err = validatePayloadRow(row, label);
    if (err) {
      preFailures.push({ email: row.email?.trim() || '(no email)', reason: err });
      return;
    }
    const emailKey = row.email!.trim().toLowerCase();
    if (seen.has(emailKey)) {
      preFailures.push({
        email: row.email!,
        reason: `${label}: duplicate email (already in this file)`,
      });
      return;
    }
    seen.add(emailKey);
    validRows.push({
      ...row,
      email: emailKey,
    });
  });

  return { validRows, preFailures };
}

export function getCsvTemplateBlob(): Blob {
  const header = IMPORT_CSV_HEADERS.join(',');
  const example =
    'user@example.com,password123,Jane Doe,janedoe,Jane Doe,,,https://example.com,NY,1990-01-15,en,UTC,';
  return new Blob([`${header}\n${example}\n`], { type: 'text/csv;charset=utf-8' });
}
