import { isAxiosError } from 'axios';
import { aFechaISOLocal, formatCLP } from '@/lib/format';

/** Piezas compartidas por el dashboard de supervisores y su pestaña interna de diagnóstico. */

export type Rango = { desde: string; hasta: string };

export const MAX_DIAS = 93; // igual que el backend

export const SELECT_CLASE =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export const TEXTO_ERROR = 'text-sm text-red-600 dark:text-red-400';

const nf0 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

export const entero = (v: number | null) => (v === null ? '—' : nf0.format(v));
export const decimal1 = (v: number | null) => (v === null ? '—' : nf1.format(v));
export const decimal2 = (v: number | null) => (v === null ? '—' : nf2.format(v));
export const porcentaje = (v: number | null) => (v === null ? '—' : `${nf1.format(v)}%`);
export const pesos = (v: number | null) => (v === null ? '—' : formatCLP(v));

/** "2026-10-03" -> Date local (sin pasar por UTC). */
export function aFecha(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export const aISO = (f: Date) => aFechaISOLocal(f);

export function sumarDias(iso: string, n: number): string {
  const f = aFecha(iso);
  f.setDate(f.getDate() + n);
  return aISO(f);
}

/** "2026-10-03" -> "03-10-2026" */
export function fechaCL(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
}

/** "2026-10-03" -> "03-10" */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}-${m}`;
}

export function mensajeError(e: unknown, respaldo: string): string {
  if (isAxiosError(e)) {
    const errores = e.response?.data?.errors as Record<string, string[]> | undefined;
    const primero = errores ? Object.values(errores).flat()[0] : undefined;
    return primero ?? e.response?.data?.message ?? respaldo;
  }
  return respaldo;
}

/** null si el rango es válido; si no, el mensaje a mostrar. */
export function errorDeRango(rango: Rango): string | null {
  if (!rango.desde || !rango.hasta) return 'Elige las dos fechas.';
  const dias = Math.round((aFecha(rango.hasta).getTime() - aFecha(rango.desde).getTime()) / 86_400_000) + 1;
  if (dias < 1) return 'La fecha "hasta" no puede ser anterior a "desde".';
  if (dias > MAX_DIAS) return `El rango máximo es de ${MAX_DIAS} días.`;
  return null;
}

export type Atajo = { clave: string; etiqueta: string; rango: () => Rango };

export const ATAJOS: Atajo[] = [
  {
    clave: '7d',
    etiqueta: 'Últimos 7 días',
    rango: () => {
      const hoy = aISO(new Date());
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    },
  },
  {
    clave: 'semana-pasada',
    etiqueta: 'Semana pasada',
    rango: () => {
      const hoy = new Date();
      const diasDesdeLunes = (hoy.getDay() + 6) % 7; // lunes = 0
      const lunesActual = sumarDias(aISO(hoy), -diasDesdeLunes);
      return { desde: sumarDias(lunesActual, -7), hasta: sumarDias(lunesActual, -1) };
    },
  },
  {
    clave: 'este-mes',
    etiqueta: 'Este mes',
    rango: () => {
      const hoy = new Date();
      return { desde: aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: aISO(hoy) };
    },
  },
  {
    clave: 'mes-pasado',
    etiqueta: 'Mes pasado',
    rango: () => {
      const hoy = new Date();
      return {
        desde: aISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        hasta: aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
      };
    },
  },
];
