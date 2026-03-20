/** Mirrors frontend/lib/adminUserImport.ts — keep CSV/JSON rules in sync. */

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

export type AdminImportPayload = {
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

function padCsvRowCells(cells: string[], expectedLength: number): string[] {
  const out = [...cells];
  while (out.length < expectedLength) {
    out.push('');
  }
  return out;
}

function detectDelimiter(headerLine: string): ',' | ';' {
  const comma = (headerLine.match(/,/g) || []).length;
  const semi = (headerLine.match(/;/g) || []).length;
  return semi > comma ? ';' : ',';
}

function normalizeHeaderCell(s: string): string {
  return s.trim().replace(/^\uFEFF/, '').toLowerCase();
}

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

export function validatePayloadRow(row: AdminImportPayload, rowLabel: string): string | null {
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
  if (row.bio != null && row.bio.length > 500) return `${rowLabel}: bio must not exceed 500 characters`;
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

function pickPayload(obj: Record<string, unknown>): AdminImportPayload {
  const out: Partial<AdminImportPayload> = {};
  if (typeof obj.email === 'string') out.email = obj.email;
  if (typeof obj.password === 'string') out.password = obj.password;
  const str = (k: keyof AdminImportPayload) => {
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
  return out as AdminImportPayload;
}

export type ParseImportResult =
  | { ok: true; rows: AdminImportPayload[] }
  | { ok: false; fileError: string };

export function parseImportFileContent(fileName: string, text: string): ParseImportResult {
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
    const rows: AdminImportPayload[] = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return { ok: false, fileError: `Invalid JSON: item at index ${i} must be an object` };
      }
      rows.push(pickPayload(item as Record<string, unknown>));
    }
    return { ok: true, rows };
  }

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

  const expectedCols = IMPORT_CSV_HEADERS.length;
  const rows: AdminImportPayload[] = [];
  for (const line of dataLines) {
    const rawCells = parseCsvRow(line, delimiter);
    if (rawCells.length > expectedCols) {
      return {
        ok: false,
        fileError: `Invalid CSV: a row has ${rawCells.length} columns, expected ${expectedCols}`,
      };
    }
    const cells = padCsvRowCells(rawCells, expectedCols);
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
