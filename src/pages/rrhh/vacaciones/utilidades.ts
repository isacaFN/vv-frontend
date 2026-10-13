import { isAxiosError } from 'axios';
import type { DiaExcluido, Solicitud } from './tipos';

export const TEXTO_ERROR = 'text-sm text-red-600 dark:text-red-400';

export const SELECT_CLASE =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export const TEXTAREA_CLASE =
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** "2026-10-03" -> "03-10-2026" (sin pasar por Date: evita corrimientos de zona horaria). */
export function fechaCL(iso: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
}

/** Timestamp real (ISO UTC) -> hora local del navegador. */
export function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

/** "03-10-2026" o "03-10-2026 al 07-10-2026". */
export function rangoTexto(desde: string, hasta: string): string {
  return desde === hasta ? fechaCL(desde) : `${fechaCL(desde)} al ${fechaCL(hasta)}`;
}

/** Todos los mensajes de validación del servidor juntos (puede haber más de un problema a la vez). */
export function mensajeError(e: unknown, respaldo: string): string {
  if (isAxiosError(e)) {
    const errores = e.response?.data?.errors as Record<string, string[]> | undefined;
    const todos = errores ? Object.values(errores).flat() : [];
    if (todos.length > 0) return todos.join(' ');
    return e.response?.data?.message ?? respaldo;
  }
  return respaldo;
}

/** Minúsculas y sin tildes, para buscar sin que importe cómo se escribió. */
export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "jueves 15-10" para listar los días que no cuentan. */
export function textoDiaExcluido(d: DiaExcluido): string {
  const [, m, dia] = d.fecha.split('-');
  const base = `${d.dia_semana} ${dia}-${m}`;
  if (d.motivo === 'festivo') return `${base} (feriado: ${d.detalle ?? '—'})`;
  return d.detalle ? `${base} (también feriado: ${d.detalle})` : base;
}

const escapar = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Abre el comprobante en una ventana aparte y la manda a imprimir (sin depender de estilos de la app). */
export function imprimirComprobante(s: Solicitud): void {
  const excluidos = (s.dias_excluidos ?? []).map((d) => `<li>${escapar(textoDiaExcluido(d))}</li>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${escapar(s.folio)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;margin:32px;color:#111}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#555;font-size:13px;margin-bottom:20px}
  table{border-collapse:collapse;width:100%;font-size:14px} td{border:1px solid #ccc;padding:8px;vertical-align:top}
  td.k{background:#f4f4f4;width:34%;font-weight:bold}
  .destacado{font-size:18px;font-weight:bold} .msg{margin:16px 0;padding:12px;border:1px solid #999;font-size:14px}
  ul{margin:6px 0 0 18px;padding:0;font-size:13px}
</style></head><body>
<h1>Comprobante de solicitud ${escapar(s.folio)}</h1>
<div class="sub">V&amp;V Operaciones · RRHH · Permisos y Vacaciones · Solicitada el ${escapar(fechaHora(s.created_at))} por ${escapar(s.solicitante)}</div>
<table>
<tr><td class="k">Colaborador</td><td>${escapar(s.colaborador.nombre)}</td></tr>
<tr><td class="k">Documento</td><td>${escapar(s.colaborador.documento ?? '—')}</td></tr>
<tr><td class="k">Instalación</td><td>${escapar(s.colaborador.instalacion ?? '—')}</td></tr>
<tr><td class="k">Tipo</td><td>${escapar(s.tipo.codigo)} · ${escapar(s.tipo.nombre)}</td></tr>
<tr><td class="k">Fechas</td><td>${escapar(rangoTexto(s.fecha_desde, s.fecha_hasta))}</td></tr>
${
  s.descuenta_vacaciones
    ? `<tr><td class="k">Días corridos solicitados</td><td>${s.dias_corridos}</td></tr>
<tr><td class="k">Días hábiles</td><td>${s.dias_habiles ?? '—'}</td></tr>
<tr><td class="k">Días que se descontarán de las vacaciones</td><td class="destacado">${s.dias_descontados}</td></tr>
${excluidos ? `<tr><td class="k">Días que no cuentan</td><td><ul>${excluidos}</ul></td></tr>` : ''}`
    : ''
}
</table>
<div class="msg">${escapar(s.mensaje)}</div>
<div class="sub">Estado: ${escapar(s.estado_etiqueta)}. RRHH valida y carga la solicitud en Control Rol.</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const ventana = window.open('', '_blank');
  if (!ventana) {
    window.alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.');
    return;
  }
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}
