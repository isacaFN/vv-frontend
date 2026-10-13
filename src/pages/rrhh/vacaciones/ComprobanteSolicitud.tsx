import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Solicitud } from './tipos';
import { fechaCL, fechaHora, imprimirComprobante, rangoTexto, textoDiaExcluido } from './utilidades';

/** Comprobante de una solicitud: qué se pidió y cuántos días se descontarán efectivamente. */
export default function ComprobanteSolicitud({ s }: { s: Solicitud }) {
  const excluidos = s.dias_excluidos ?? [];

  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Comprobante de solicitud</p>
          <p className="text-lg font-semibold">{s.folio}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => imprimirComprobante(s)}>
          <Printer className="size-4" /> Imprimir
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Colaborador</dt>
          <dd className="font-medium">{s.colaborador.nombre}</dd>
          <dd className="text-xs text-muted-foreground">
            {s.colaborador.documento ?? 'Sin documento'}
            {s.colaborador.instalacion ? ` · ${s.colaborador.instalacion}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Tipo</dt>
          <dd className="font-medium">
            {s.tipo.codigo} · {s.tipo.nombre}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fechas solicitadas</dt>
          <dd className="font-medium">{rangoTexto(s.fecha_desde, s.fecha_hasta)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Solicitada por</dt>
          <dd>
            {s.solicitante} <span className="text-xs text-muted-foreground">· {fechaHora(s.created_at)}</span>
          </dd>
        </div>
        {s.folio_control_rol && (
          <div>
            <dt className="text-xs text-muted-foreground">N.º en Control Rol</dt>
            <dd className="font-medium">{s.folio_control_rol}</dd>
          </div>
        )}
      </dl>

      {/* Solo las vacaciones se calculan; en el resto de los permisos RRHH valida. */}
      {s.descuenta_vacaciones && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border p-2">
            <p className="text-xl font-semibold">{s.dias_corridos}</p>
            <p className="text-xs text-muted-foreground">días corridos</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xl font-semibold">{s.dias_habiles}</p>
            <p className="text-xs text-muted-foreground">días hábiles</p>
          </div>
          <div className="rounded-md border-2 border-primary p-2">
            <p className="text-xl font-semibold">{s.dias_descontados}</p>
            <p className="text-xs text-muted-foreground">se descuentan de vacaciones</p>
          </div>
        </div>
      )}

      <p className="rounded-md bg-muted/50 p-3 text-sm">{s.mensaje}</p>

      {s.descuenta_vacaciones && excluidos.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Días que no cuentan ({fechaCL(s.fecha_desde)} al {fechaCL(s.fecha_hasta)})</p>
          <ul className="flex flex-wrap gap-1.5">
            {excluidos.map((d) => (
              <li key={d.fecha} className="rounded-full border px-2 py-0.5 text-xs">
                {textoDiaExcluido(d)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
