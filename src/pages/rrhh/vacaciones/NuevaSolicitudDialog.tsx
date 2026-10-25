import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Catalogo, ColaboradorBusqueda, Solicitud, VistaPrevia } from './tipos';
import { SELECT_CLASE, TEXTAREA_CLASE, TEXTO_ERROR, mensajeError, textoDiaExcluido } from './utilidades';

type Props = {
  catalogo: Catalogo;
  onClose: () => void;
  /** La solicitud ya quedó guardada: el padre muestra el comprobante. */
  onCreada: (solicitud: Solicitud) => void;
};

const FECHA_COMPLETA = /^\d{4}-\d{2}-\d{2}$/;

/** Formulario "Nueva solicitud" con vista previa del comprobante (los días que de verdad se descontarán). */
export default function NuevaSolicitudDialog({ catalogo, onClose, onCreada }: Props) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ColaboradorBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [colaborador, setColaborador] = useState<ColaboradorBusqueda | null>(null);

  const [tipoId, setTipoId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [comentario, setComentario] = useState('');

  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [errorVista, setErrorVista] = useState<string | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipo = catalogo.tipos.find((t) => String(t.id) === tipoId) ?? null;

  // Buscador de colaboradores (espera 300 ms después de la última tecla).
  useEffect(() => {
    const consulta = texto.trim();
    if (colaborador || consulta.length < 2) {
      setResultados([]);
      return;
    }
    let vigente = true;
    const espera = setTimeout(() => {
      setBuscando(true);
      api
        .get<{ colaboradores: ColaboradorBusqueda[] }>('/vacaciones/colaboradores', { params: { q: consulta } })
        .then((res) => vigente && setResultados(res.data.colaboradores))
        .catch(() => vigente && setResultados([]))
        .finally(() => vigente && setBuscando(false));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [texto, colaborador]);

  // Vista previa: se recalcula cuando cambian tipo, fechas o colaborador.
  const colaboradorId = colaborador?.id ?? null;
  useEffect(() => {
    if (!tipoId || !FECHA_COMPLETA.test(desde) || !FECHA_COMPLETA.test(hasta)) {
      setVista(null);
      setErrorVista(null);
      return;
    }
    let vigente = true;
    const espera = setTimeout(() => {
      setCalculando(true);
      api
        .post<VistaPrevia>('/vacaciones/calcular', {
          tipo_id: Number(tipoId),
          fecha_desde: desde,
          fecha_hasta: hasta,
          colaborador_id: colaboradorId,
        })
        .then((res) => {
          if (!vigente) return;
          setVista(res.data);
          setErrorVista(null);
        })
        .catch((e) => {
          if (!vigente) return;
          setVista(null);
          setErrorVista(mensajeError(e, 'No se pudo calcular los días.'));
        })
        .finally(() => vigente && setCalculando(false));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [tipoId, desde, hasta, colaboradorId]);

  function cambiarDesde(valor: string) {
    setDesde(valor);
    // Lo más común es pedir un rango: si el término no es válido, queda igual al inicio.
    if (!hasta || hasta < valor) setHasta(valor);
  }

  const hayProblemas = (vista?.problemas.length ?? 0) > 0;
  const puedeEnviar = !!colaborador && !!vista && !hayProblemas && !calculando && !enviando;
  const minFecha = tipo && !tipo.permite_retroactivo ? catalogo.hoy : undefined;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!colaborador || !puedeEnviar) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await api.post<Solicitud>('/vacaciones/solicitudes', {
        colaborador_id: colaborador.id,
        tipo_id: Number(tipoId),
        fecha_desde: desde,
        fecha_hasta: hasta,
        comentario: comentario.trim() || null,
      });
      onCreada(res.data);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear la solicitud.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !enviando && onClose()}>
      <DialogContent style={{ maxWidth: 'min(40rem, calc(100% - 2rem))', maxHeight: '90vh', overflowY: 'auto' }}>
        <DialogHeader>
          <DialogTitle>Nueva solicitud</DialogTitle>
          <DialogDescription>
            Elige al colaborador, el tipo y las fechas. Al terminar verás un comprobante con los días que efectivamente se descontarán.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="space-y-4">
          {/* Colaborador */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="vac-colaborador">
              Colaborador
            </label>
            {colaborador ? (
              <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{colaborador.nombre}</span>
                  <span className="block text-xs text-muted-foreground">
                    {colaborador.documento ?? 'Sin documento'}
                    {colaborador.instalacion ? ` · ${colaborador.instalacion}` : ''}
                  </span>
                </span>
                <Button type="button" variant="ghost" size="icon" title="Cambiar colaborador" onClick={() => setColaborador(null)}>
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="vac-colaborador"
                    className="pl-8"
                    placeholder="Busca por nombre, apellido o documento…"
                    value={texto}
                    autoComplete="off"
                    onChange={(e) => setTexto(e.target.value)}
                  />
                </div>
                {buscando && <p className="text-xs text-muted-foreground">Buscando…</p>}
                {!buscando && texto.trim().length >= 2 && resultados.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay colaboradores activos con ese texto.</p>
                )}
                {resultados.length > 0 && (
                  <ul className="max-h-48 overflow-y-auto rounded-md border">
                    {resultados.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                          onClick={() => {
                            setColaborador(c);
                            setTexto('');
                            setResultados([]);
                          }}
                        >
                          <span className="block font-medium">{c.nombre}</span>
                          <span className="block text-xs text-muted-foreground">
                            {c.documento ?? 'Sin documento'}
                            {c.cargo ? ` · ${c.cargo}` : ''}
                            {c.instalacion ? ` · ${c.instalacion}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Tipo y fechas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <label className="text-sm font-medium" htmlFor="vac-tipo">
                Tipo
              </label>
              <select id="vac-tipo" className={`${SELECT_CLASE} w-full`} value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                <option value="">Seleccione…</option>
                {catalogo.tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.numero_control_rol} {t.nombre} ({t.codigo})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="vac-desde">
                Desde
              </label>
              <Input id="vac-desde" type="date" value={desde} min={minFecha} onChange={(e) => cambiarDesde(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="vac-hasta">
                Hasta (inclusive)
              </label>
              <Input id="vac-hasta" type="date" value={hasta} min={desde || minFecha} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>

          {/* Vista previa */}
          {calculando && !vista && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Calculando los días…
            </p>
          )}
          {errorVista && <p className={TEXTO_ERROR}>{errorVista}</p>}
          {vista && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              {/* Solo las vacaciones se calculan; en el resto de los permisos RRHH valida. */}
              {vista.descuenta_vacaciones && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold">{vista.dias_corridos}</p>
                    <p className="text-xs text-muted-foreground">días corridos</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{vista.dias_habiles}</p>
                    <p className="text-xs text-muted-foreground">días hábiles</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{vista.dias_descontados}</p>
                    <p className="text-xs text-muted-foreground">se descontarán</p>
                  </div>
                </div>
              )}
              <p>{vista.mensaje}</p>
              {vista.descuenta_vacaciones && vista.excluidos.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {vista.excluidos.map((d) => (
                    <li key={d.fecha} className="rounded-full border bg-background px-2 py-0.5 text-xs">
                      {textoDiaExcluido(d)}
                    </li>
                  ))}
                </ul>
              )}
              {vista.advertencias.map((a) => (
                <p key={a} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {a}
                </p>
              ))}
              {vista.problemas.map((p) => (
                <p key={p} className={`flex items-start gap-1.5 ${TEXTO_ERROR}`}>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {p}
                </p>
              ))}
            </div>
          )}

          {/* Comentario */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="vac-comentario">
              Comentario <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              id="vac-comentario"
              className={TEXTAREA_CLASE}
              rows={3}
              maxLength={catalogo.comentario.max}
              placeholder="Cualquier dato que RRHH deba saber…"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Queda en el historial y puede viajar en los avisos por correo, que no son un canal seguro. No pongas datos sensibles (salud, diagnósticos,
              datos personales).
            </p>
          </div>

          {error && <p className={TEXTO_ERROR}>{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!puedeEnviar}>
              {enviando && <Loader2 className="size-4 animate-spin" />} Solicitar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
