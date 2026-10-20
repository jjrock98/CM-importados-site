/**
 * Helpers PUROS para el receptor de reportes CSP (/api/csp-report).
 * Viven acá y no en route.ts porque Next no permite exportar funciones
 * arbitrarias desde un route handler, y así se pueden testear.
 *
 * Todo lo que llega del navegador es entrada NO confiable (cualquiera puede
 * mandar un POST a mano): se normaliza y se acota antes de guardar nada.
 */

export interface CspViolation {
  /** Directiva violada, ej. "script-src-elem" */
  directive: string;
  /** Qué se bloqueó, normalizado: "inline", "eval", "data" o solo el origen (sin query) */
  blocked: string;
  /** Ruta de la página donde pasó (sin dominio ni query, ids colapsados) */
  page: string;
  /** Archivo y línea que lo intentó, para diagnosticar */
  source: string;
}

const KEYWORDS = new Set(['inline', 'eval', 'wasm-eval', 'data', 'blob', 'self', 'about']);
const MAX_REPORTS_PER_REQUEST = 10;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function normalizeBlocked(raw: unknown): string {
  const v = str(raw).trim();
  if (!v) return 'unknown';
  if (KEYWORDS.has(v)) return v;
  try {
    const u = new URL(v);
    if (u.protocol === 'data:') return 'data';
    if (u.protocol === 'blob:') return 'blob';
    return u.origin.slice(0, 100); // sin path ni query: pueden traer tokens
  } catch {
    return 'unknown';
  }
}

export function normalizePage(raw: unknown): string {
  const v = str(raw).trim();
  if (!v) return 'unknown';
  try {
    return new URL(v).pathname
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d{3,}/g, '/:id')
      .slice(0, 80);
  } catch {
    return 'unknown';
  }
}

function normalizeSource(file: unknown, line: unknown): string {
  const f = str(file).trim();
  if (!f) return 'unknown';
  let where = f.slice(0, 120);
  try {
    const u = new URL(f);
    where = `${u.origin}${u.pathname}`.slice(0, 140); // sin query
  } catch { /* se deja el texto recortado */ }
  const n = typeof line === 'number' && Number.isFinite(line) ? `:${line}` : '';
  return `${where}${n}`;
}

function normalizeDirective(raw: unknown): string {
  const first = str(raw).trim().split(/\s+/)[0] ?? '';
  return /^[a-z-]{3,40}$/.test(first) ? first : 'unknown';
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Acepta el formato clásico (report-uri) y el nuevo (Reporting API / report-to). */
export function parseCspReports(text: string): CspViolation[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return []; }

  const out: CspViolation[] = [];

  if (isObj(data) && isObj(data['csp-report'])) {
    const r = data['csp-report'];
    out.push({
      directive: normalizeDirective(r['effective-directive'] ?? r['violated-directive']),
      blocked:   normalizeBlocked(r['blocked-uri']),
      page:      normalizePage(r['document-uri']),
      source:    normalizeSource(r['source-file'], r['line-number']),
    });
  } else if (Array.isArray(data)) {
    for (const item of data.slice(0, MAX_REPORTS_PER_REQUEST)) {
      if (!isObj(item) || item.type !== 'csp-violation' || !isObj(item.body)) continue;
      const b = item.body;
      out.push({
        directive: normalizeDirective(b.effectiveDirective ?? b.violatedDirective),
        blocked:   normalizeBlocked(b.blockedURL),
        page:      normalizePage(b.documentURL),
        source:    normalizeSource(b.sourceFile, b.lineNumber),
      });
    }
  }
  return out.slice(0, MAX_REPORTS_PER_REQUEST);
}

/** Clave de agrupación: mismo problema = mismo contador. */
export function violationField(v: CspViolation): string {
  return `${v.directive} | ${v.blocked} | ${v.page}`.slice(0, 200);
}