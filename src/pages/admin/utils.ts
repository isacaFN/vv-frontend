import { isAxiosError } from 'axios';
import { aFechaISOLocal } from '@/lib/format';

// Utilidades compartidas por las pestañas del panel de administración.

export const SELECT_CLASE =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Hoy según el reloj local del navegador (no UTC). */
export const hoyLocal = () => aFechaISOLocal(new Date());

/** "2026-10-03" -> "03-10-2026" (sin pasar por Date: evita corrimientos de zona horaria). */
export function fechaCL(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
}

/** Timestamp real (ISO UTC) -> hora local del navegador. */
export function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

/** Primer mensaje de validación del backend (422), o el mensaje general, o el respaldo. */
export function mensajeError(e: unknown, respaldo: string): string {
  if (isAxiosError(e)) {
    const errores = e.response?.data?.errors as Record<string, string[]> | undefined;
    const primero = errores ? Object.values(errores).flat()[0] : undefined;
    return primero ?? e.response?.data?.message ?? respaldo;
  }
  return respaldo;
}
