import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CLASE_ESTADO, ETIQUETA_ACCION, etiquetaEvento, type AccionVacaciones } from '@/config/vacaciones';
import BarraProgreso from './BarraProgreso';
import ComprobanteSolicitud from './ComprobanteSolicitud';
import type { Catalogo, Solicitud } from './tipos';
import { TEXTAREA_CLASE, TEXTO_ERROR, fechaHora, mensajeError } from './utilidades';

type Props = {
  catalogo: Catalogo;
  /** Solicitud con su historial si ya se tiene (p. ej. recién creada); si no, se pide al servidor. */
  id: number;
  inicial?: Solicitud | null;
  onClose: () => void;
  /** Algo cambió: el padre recarga la lista y el contador. */
  onCambio: () => void;
};

const VARIANTE: Record<AccionVacaciones, 'default' | 'outline' | 'destructive'> = {
  aceptar: 'default',
  aprobar: 'default',
  cargar: 'default',
  rechazar: 'destructive',
  cancelar: 'outline',
};

/** Detalle de una solicitud: comprobante, barra de progreso, historial con comentarios y las acciones que le tocan al usuario. */
export default function DetalleSolicitudDialog({ catalogo, id, inicial = null, onClose, onCambio }: Props) {
  const [s, setS] = useState<Solicitud | null>(inicial?.eventos ? inicial : null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [comentario, setComentario] = useState('');
  const [folio, setFolio] = useState('');
  const [trabajando, setTrabajando] = useState<AccionVacaciones | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inicial?.eventos) return;
    let vigente = true;
    api
      .get<Solicitud>(`/vacaciones/solicitudes/${id}`)
      .then((res) => vigente && setS(res.data))
      .catch((e) => vigente && setErrorCarga(mensajeError(e, 'No se pudo cargar la solicitud.')));
    return () => {
      vigente = false;
    };
  }, [id, inicial]);

  async function ejecutar(accion: AccionVacaciones) {
    if (!s) return;
    const texto = comentario.trim();

    if (accion === 'rechazar' && texto.length < catalogo.comentario.min_rechazo) {
      setError(`El comentario es obligatorio al rechazar (mínimo ${catalogo.comentario.min_rechazo} caracteres): explica el motivo.`);
      return;
    }
    if (accion === 'cancelar' && !window.confirm('¿Cancelar esta solicitud? No se puede retomar: tendrías que hacer una nueva.')) return;

    setTrabajando(accion);
    setError(null);
    try {
      const res = await api.post<{ ok: boolean; solicitud: Solicitud | null }>(`/vacaciones/solicitudes/${s.id}/accion`, {
        accion,
        comentario: texto || null,
        folio: accion === 'cargar' ? folio.trim() || null : null,
      });
      onCambio();
      if (res.data.solicitud) {
        setS(res.data.solicitud);
        setComentario('');
        setFolio('');
      } else {
        onClose(); // ya no la puede ver (p. ej. solo veía las que esperaban su paso)
      }
    } catch (e) {
      setError(mensajeError(e, 'No se pudo completar la acción.'));
      // Puede que alguien más ya la haya movido: se refresca para mostrar el estado real.
      onCambio();
      api
        .get<Solicitud>(`/vacaciones/solicitudes/${s.id}`)
        .then((res) => setS(res.data))
        .catch(() => undefined);
    } finally {
      setTrabajando(null);
    }
  }

  const acciones = s?.acciones ?? [];
  const pideFolio = acciones.includes('cargar');

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !trabajando && onClose()}>
      <DialogContent style={{ maxWidth: 'min(42rem, calc(100% - 2rem))', maxHeight: '90vh', overflowY: 'auto' }}>
        <DialogHeader>
          <DialogTitle>{s ? `Solicitud ${s.folio}` : 'Solicitud'}</DialogTitle>
          <DialogDescription>{s ? <Badge variant="outline" className={CLASE_ESTADO[s.estado]}>{s.estado_etiqueta}</Badge> : 'Cargando…'}</DialogDescription>
        </DialogHeader>

        {errorCarga && <p className={TEXTO_ERROR}>{errorCarga}</p>}
        {!s && !errorCarga && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {s && (
          <div className="space-y-4">
            <BarraProgreso estado={s.estado} etapas={catalogo.etapas} />
            <ComprobanteSolicitud s={s} />

            <div>
              <h3 className="mb-2 text-sm font-semibold">Historial</h3>
              <ol className="space-y-2">
                {(s.eventos ?? []).map((e) => (
                  <li key={e.id} className="rounded-md border p-2 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{etiquetaEvento(e.accion, e.estado_nuevo)}</span>
                      <span className="text-xs text-muted-foreground">
                        {e.user_nombre} · {fechaHora(e.created_at)}
                      </span>
                    </div>
                    {e.comentario && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">«{e.comentario}»</p>}
                  </li>
                ))}
              </ol>
            </div>

            {acciones.length > 0 && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="vac-accion-comentario">
                    Comentario <span className="font-normal text-muted-foreground">(opcional; obligatorio si rechazas)</span>
                  </label>
                  <textarea
                    id="vac-accion-comentario"
                    className={TEXTAREA_CLASE}
                    rows={3}
                    maxLength={catalogo.comentario.max}
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                  />
                </div>
                {pideFolio && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" htmlFor="vac-folio">
                      N.º en Control Rol <span className="font-normal text-muted-foreground">(opcional)</span>
                    </label>
                    <Input id="vac-folio" maxLength={60} value={folio} onChange={(e) => setFolio(e.target.value)} />
                  </div>
                )}
                {error && <p className={TEXTO_ERROR}>{error}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  {acciones.map((a) => (
                    <Button key={a} type="button" variant={VARIANTE[a]} disabled={trabajando !== null} onClick={() => ejecutar(a)}>
                      {trabajando === a && <Loader2 className="size-4 animate-spin" />} {ETIQUETA_ACCION[a]}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
