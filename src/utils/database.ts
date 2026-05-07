/**
 * utils/database.ts
 * Shared database utilities extracted from repositories and DatabaseService.
 *
 * These functions were duplicated across multiple files and are now consolidated
 * here as the single source of truth.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Virtual / computed fields that do NOT exist as columns in the SQLite database.
 * These are injected at the repository layer (e.g. cpfCnpj, rgIe on Cliente)
 * or computed via JOINs (e.g. totalLocacoesAtivas).
 *
 * Previously defined inline in DatabaseService.update(), upsertFromSync(), insert(),
 * and referenced by repositories.
 */
export const CAMPOS_EXCLUIDOS = new Set([
  'cpfCnpj', 'rgIe',
  'locacaoAtiva', 'estaLocado', 'locacaoAtual',
  'totalLocacoesAtivas', 'totalLocacoesFinalizadas', 'saldoDevedorTotal',
]);

/**
 * Superset of CAMPOS_EXCLUIDOS for UPDATE operations.
 * Also excludes `id` and `createdAt` which are immutable in UPDATE.
 * Used by DatabaseService.update() instead of inline definitions.
 */
export const UPDATE_EXCLUIDOS = new Set([
  'id', 'createdAt',       // Imutáveis em UPDATE
  ...CAMPOS_EXCLUIDOS,     // Campos virtuais
]);

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generate a unique ID for a given entity type.
 *
 * Pattern: `{entityType}_{timestamp}_{random}`
 *
 * Previously every repository had its own version like:
 * - `cliente_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
 * - `produto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
 * - `manut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
 *
 * Now consolidated into a single shared function.
 */
export function generateId(entityType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${entityType}_${timestamp}_${random}`;
}

// ============================================================================
// JSON PARSING
// ============================================================================

/**
 * Safely parse a JSON string with a fallback value.
 *
 * Previously duplicated in ClienteRepository, UsuarioRepository, and others
 * as a private `parseJSON` method.
 *
 * @param jsonString - The JSON string to parse (may be null/undefined)
 * @param fallback - Value returned when jsonString is falsy or parsing fails
 */
export function parseJSON<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize an entity for SQLite storage.
 *
 * - Objects/arrays are JSON-stringified (SQLite cannot store nested structures)
 * - Fields in `excludeFields` are omitted entirely
 * - `undefined` values are omitted (SQLite doesn't support undefined)
 * - Primitives (string, number, boolean, null) are passed through unchanged
 *
 * @param entity - The entity object to serialize
 * @param excludeFields - Set of field names to exclude (defaults to CAMPOS_EXCLUIDOS)
 */
export function serializeForDB(
  entity: Record<string, unknown>,
  excludeFields: Set<string> = CAMPOS_EXCLUIDOS,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity)) {
    if (excludeFields.has(key) || value === undefined) continue;
    if (value !== null && typeof value === 'object') {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================================
// DATE CONVERSION (DD/MM/AAAA <-> ISO)
// ============================================================================

/**
 * Convert a DD/MM/AAAA date string to an ISO 8601 string.
 * Returns undefined if the input is empty/invalid.
 *
 * The backend (Prisma DateTime?) expects ISO strings.
 * The mobile form uses DD/MM/AAAA for user input.
 *
 * @example "15/03/2024" → "2024-03-15T00:00:00.000Z"
 */
export function dateBRtoISO(value: string | undefined | null): string | undefined {
  if (!value || !value.trim()) return undefined;
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    // Already ISO? Pass through
    if (/^\d{4}-\d{2}-\d{2}/.test(value.trim())) return value.trim();
    return undefined;
  }
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}T00:00:00.000Z`;
  // Validate it's a real date
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return iso;
}

/**
 * Convert an ISO 8601 date string to DD/MM/AAAA format for display.
 * Returns empty string if the input is empty/invalid.
 *
 * @example "2024-03-15T00:00:00.000Z" → "15/03/2024"
 */
export function dateISOtoBR(value: string | undefined | null): string {
  if (!value) return '';
  // Already DD/MM/AAAA? Pass through
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())) return value.trim();
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}
