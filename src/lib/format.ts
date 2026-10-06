export function formatCLP(valor: number | null | undefined): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(valor ?? 0);
}

export function formatHoras(valor: number | null | undefined): string {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor ?? 0);
}

export function formatFecha(fecha: string): string {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(
    new Date(fecha + 'T00:00:00')
  );
}

export function formatEntero(valor: number | null | undefined): string {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(valor ?? 0);
}

// null = "sin cuota / no aplica": se muestra un guion, nunca "0%".
export function formatPorcentaje(valor: number | null | undefined, decimales = 1): string {
  if (valor === null || valor === undefined) return '—';
  return `${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)}%`;
}

// YYYY-MM-DD con la fecha local del usuario. toISOString() convierte a UTC
// y entre las 21:00 y las 23:59 en Chile devolvería el día siguiente.
export function aFechaISOLocal(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}