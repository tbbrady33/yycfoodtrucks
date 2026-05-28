/**
 * Extract a human-readable message from any thrown error. Supabase JS
 * errors are plain objects (not Error instances) with `message`, `code`,
 * `details`, `hint` — `String(err)` on those renders as "[object Object]"
 * which is what was leaking through as "no error".
 */
export function errorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || 'Unknown error';
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof e.message === 'string' && e.message) parts.push(e.message);
    if (typeof e.details === 'string' && e.details) parts.push(e.details);
    if (typeof e.hint === 'string' && e.hint) parts.push(`(${e.hint})`);
    if (typeof e.code === 'string' && e.code) parts.push(`[${e.code}]`);
    if (parts.length > 0) return parts.join(' · ');
    try {
      return JSON.stringify(err);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }
  return String(err);
}
