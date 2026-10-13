import { Check, X } from 'lucide-react';
import type { Etapa } from './tipos';

// Cuántos pasos ya se cumplieron en cada estado, y en qué paso (0 = el primero) se rechazó.
const CUMPLIDOS: Record<string, number> = { solicitada: 1, aceptada: 2, aprobada: 3, cargada: 4, rechazada_rrhh: 1, rechazada_jefe: 2 };
const PASO_RECHAZADO: Record<string, number> = { rechazada_rrhh: 1, rechazada_jefe: 2 };

type Props = { estado: string; etapas: Etapa[]; compacta?: boolean };

/** Barra de progreso de la solicitud: Solicitada → Aceptada por RRHH → Aprobada por Jefe de Operaciones → Cargada. */
export default function BarraProgreso({ estado, etapas, compacta = false }: Props) {
  const cancelada = estado === 'cancelada';
  const cumplidos = cancelada ? 0 : (CUMPLIDOS[estado] ?? 0);
  const rechazado = PASO_RECHAZADO[estado] ?? -1;
  const completa = estado === 'cargada';

  const circulo = compacta ? 'size-5 text-[10px]' : 'size-7 text-xs';
  const icono = compacta ? 'size-3' : 'size-4';

  return (
    <div className={compacta ? 'w-36' : 'w-full'} role="img" aria-label={`Avance de la solicitud: ${estado}`}>
      <div className="flex items-start">
        {etapas.map((etapa, i) => {
          const hecho = i < cumplidos && i !== rechazado;
          const fallo = i === rechazado;
          const enCurso = !cancelada && !completa && rechazado < 0 && i === cumplidos;

          // Si se rechazó en este paso, dice "Rechazada por…" en vez de "Aprobada por…".
          const nombre = fallo ? (etapa.etiqueta_rechazo ?? etapa.etiqueta) : etapa.etiqueta;

          const clase = fallo
            ? 'border-red-600 bg-red-600 text-white'
            : hecho
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : enCurso
                ? 'border-primary bg-background text-primary'
                : 'border-border bg-muted text-muted-foreground';

          // El tramo que llega a este paso está "hecho" si el paso anterior se cumplió.
          const tramoHecho = i > 0 && i - 1 < cumplidos && i - 1 !== rechazado && !cancelada;

          return (
            <div key={etapa.clave} className="relative flex min-w-0 flex-1 flex-col items-center">
              {i > 0 && (
                <div
                  className={`absolute top-1/2 right-1/2 left-[-50%] h-0.5 -translate-y-1/2 ${tramoHecho ? 'bg-emerald-600' : 'bg-border'}`}
                  style={{ top: compacta ? '0.625rem' : '0.875rem' }}
                />
              )}
              <span className={`relative z-10 flex items-center justify-center rounded-full border-2 font-semibold ${circulo} ${clase}`} title={nombre}>
                {fallo ? <X className={icono} /> : hecho ? <Check className={icono} /> : i + 1}
              </span>
              {!compacta && (
                <span className={`mt-1 px-1 text-center text-xs leading-tight ${fallo ? 'font-medium text-red-600 dark:text-red-400' : enCurso ? 'font-medium' : 'text-muted-foreground'}`}>
                  {nombre}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {cancelada && !compacta && <p className="mt-2 text-center text-xs text-muted-foreground">Solicitud cancelada</p>}
    </div>
  );
}
