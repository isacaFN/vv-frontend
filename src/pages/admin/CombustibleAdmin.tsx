import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { History, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { aFechaISOLocal, formatCLP, formatHoras } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';

/* ───────────────────────── Tipos ───────────────────────── */

type Movil = { id: number; placa: string; alias: string | null; activo: boolean; fecha_baja: string | null };

type CambioInfo = { usuario: string; fecha: string | null } | null;

// Ojo: Laravel serializa la relación `registradoPor` como `registrado_por`, igual que la
// columna. En el JSON la relación gana: llega { id, name } (o null si el usuario se borró).
type Carga = {
  id: number;
  movil_id: number;
  fecha: string; // "2026-10-03"
  litros: string; // decimal de Laravel llega como texto ("40.00")
  costo_total: string;
  observacion: string | null;
  created_at: string;
  movil: { id: number; placa: string } | null;
  registrado_por: { id: number; name: string } | null;
  ultima_edicion: CambioInfo;
};

type Pagina<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Datos = { movil_id: number; fecha: string; litros: number; costo_total: number; observacion: string | null };

type Movimiento = {
  id: number;
  combustible_id: number;
  accion: 'creacion' | 'edicion' | 'eliminacion';
  created_at: string;
  movil: { id: number; placa: string } | null;
  user: { id: number; name: string } | null;
  datos_antes: Datos | null;
  datos_despues: Datos | null;
};

/* ───────────────────────── Helpers ───────────────────────── */

const SELECT_CLASE =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const TEXTO_ERROR = 'text-sm text-red-600 dark:text-red-400';

const hoyLocal = () => aFechaISOLocal(new Date());

/** "2026-10-03" -> "03-10-2026" (sin pasar por Date: evita corrimientos de zona horaria). */
function fechaCL(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
}

/** Timestamp real (ISO UTC) -> hora local del navegador. */
function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

/** Litros: acepta coma o punto como decimal. */
function parseLitros(texto: string): number {
  return Number(texto.trim().replace(',', '.'));
}

/** Pesos chilenos: solo dígitos ("50.000" -> 50000). */
function parsePesos(texto: string): number {
  const digitos = texto.replace(/\D/g, '');
  return digitos === '' ? NaN : Number(digitos);
}

function mensajeError(e: unknown, respaldo: string): string {
  if (isAxiosError(e)) {
    const errores = e.response?.data?.errors as Record<string, string[]> | undefined;
    const primero = errores ? Object.values(errores).flat()[0] : undefined;
    return primero ?? e.response?.data?.message ?? respaldo;
  }
  return respaldo;
}

const nombreMovil = (m: Movil) => `${m.placa}${m.alias ? ` · ${m.alias}` : ''}${m.activo ? '' : ' (baja)'}`;

/* ───────────────────────── Pestaña Combustible ───────────────────────── */

export default function CombustibleAdmin() {
  const isMobile = useIsMobile();

  const [moviles, setMoviles] = useState<Movil[]>([]);
  const [errorMoviles, setErrorMoviles] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Edición (ventana modal)
  const [editando, setEditando] = useState<Carga | null>(null);

  // Listado
  const [filtroMovil, setFiltroMovil] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0); // se incrementa para volver a pedir listado + historial
  const [cargas, setCargas] = useState<Pagina<Carga> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Eliminación
  const [porEliminar, setPorEliminar] = useState<Carga | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const [verHistorial, setVerHistorial] = useState(false);

  useEffect(() => {
    api
      .get<Movil[]>('/combustibles/moviles')
      .then((res) => setMoviles(res.data))
      .catch(() => setErrorMoviles('No se pudo cargar la lista de móviles.'));
  }, []);

  useEffect(() => {
    setPagina(1);
  }, [filtroMovil, desde, hasta]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    api
      .get<Pagina<Carga>>('/combustibles', {
        params: {
          page: pagina,
          movil_id: filtroMovil || undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        },
      })
      .then((res) => {
        if (cancelado) return;
        // Si se borró la última fila de una página que no es la primera, se retrocede.
        if (res.data.data.length === 0 && pagina > 1) setPagina(pagina - 1);
        else {
          setCargas(res.data);
          setErrorCarga(null);
        }
      })
      .catch(() => !cancelado && setErrorCarga('No se pudieron cargar las cargas de combustible.'))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [pagina, filtroMovil, desde, hasta, recarga]);

  const movilesPorId = useMemo(() => new Map(moviles.map((m) => [m.id, m])), [moviles]);

  const abrirEdicion = (carga: Carga) => {
    setAviso(null);
    setEditando(carga);
  };

  const abrirEliminacion = (carga: Carga) => {
    setAviso(null);
    setErrorEliminar(null);
    setPorEliminar(carga);
  };

  /** Se llama cuando el formulario (alta o edición) guardó bien. */
  const alGuardar = (mensaje: string, esNueva: boolean) => {
    setAviso(mensaje);
    setEditando(null);
    if (esNueva) setPagina(1);
    setRecarga((n) => n + 1);
  };

  const confirmarEliminar = () => {
    if (!porEliminar) return;
    setEliminando(true);
    setErrorEliminar(null);
    api
      .delete(`/combustibles/${porEliminar.id}`)
      .then(() => {
        if (editando?.id === porEliminar.id) setEditando(null);
        setPorEliminar(null);
        setAviso('Carga eliminada. Quedó registrada en el historial.');
        setRecarga((n) => n + 1);
      })
      .catch((err) => setErrorEliminar(mensajeError(err, 'No se pudo eliminar la carga.')))
      .finally(() => setEliminando(false));
  };

  const hayFiltros = filtroMovil !== '' || desde !== '' || hasta !== '';

  return (
    <div className="space-y-6">
      {/* ── Alta de carga ── */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3">
          <h2 className="font-heading text-lg font-semibold">Registrar carga de combustible</h2>
          <p className="text-sm text-muted-foreground">
            La carga se asigna al móvil. Cada creación, edición y eliminación queda registrada con quién la hizo.
          </p>
        </div>
        {errorMoviles && <p className={`mb-3 ${TEXTO_ERROR}`}>{errorMoviles}</p>}
        <FormularioCarga moviles={moviles} carga={null} onGuardado={(mensaje) => alGuardar(mensaje, true)} />
      </div>

      {/* ── Listado ── */}
      <div className="rounded-lg border bg-card">
        {aviso && <p className="border-b px-3 py-2 text-sm text-muted-foreground">{aviso}</p>}

        <div className="flex flex-wrap items-end gap-3 border-b p-3">
          <label className="min-w-40 flex-1 space-y-1">
            <span className="text-xs text-muted-foreground">Móvil</span>
            <select className={SELECT_CLASE} value={filtroMovil} onChange={(e) => setFiltroMovil(e.target.value)}>
              <option value="">Todos</option>
              {moviles.map((m) => (
                <option key={m.id} value={m.id}>
                  {nombreMovil(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Desde</span>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Hasta</span>
            <Input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
          </label>
          {hayFiltros && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiltroMovil('');
                setDesde('');
                setHasta('');
              }}
            >
              Limpiar filtros
            </Button>
          )}
          <Badge variant="outline" className="ml-auto">
            {cargas?.total ?? 0} cargas
          </Badge>
        </div>

        {errorCarga && <p className={`p-4 ${TEXTO_ERROR}`}>{errorCarga}</p>}

        {cargando && !cargas ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : cargas && cargas.data.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {hayFiltros ? 'No hay cargas con esos filtros.' : 'Todavía no hay cargas registradas.'}
          </p>
        ) : isMobile ? (
          <div className="divide-y">
            {cargas?.data.map((c) => (
              <TarjetaCarga key={c.id} carga={c} onEditar={abrirEdicion} onEliminar={abrirEliminacion} />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Móvil</TableHead>
                <TableHead className="text-right">Litros</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">$/litro</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargas?.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap">{fechaCL(c.fecha)}</TableCell>
                  <TableCell className="font-medium">{c.movil?.placa ?? `#${c.movil_id}`}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatHoras(Number(c.litros))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(Number(c.costo_total))}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{precioPorLitro(c)}</TableCell>
                  <TableCell className="min-w-52">
                    <RegistroCarga carga={c} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Editar carga"
                        onClick={() => abrirEdicion(c)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Eliminar carga"
                        onClick={() => abrirEliminacion(c)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {cargas && cargas.last_page > 1 && (
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <Button variant="outline" size="sm" disabled={pagina <= 1 || cargando} onClick={() => setPagina(pagina - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {cargas.current_page} de {cargas.last_page}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= cargas.last_page || cargando}
              onClick={() => setPagina(pagina + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>

      {/* ── Historial ── */}
      <div className="rounded-lg border bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 p-4 text-left"
          onClick={() => setVerHistorial((v) => !v)}
        >
          <span className="flex items-center gap-2 font-heading text-lg font-semibold">
            <History className="size-5" /> Historial de movimientos
          </span>
          <span className="text-sm text-muted-foreground">{verHistorial ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        {verHistorial && <HistorialMovimientos moviles={moviles} movilesPorId={movilesPorId} recarga={recarga} />}
      </div>

      {/* ── Editar carga (modal: el clic en "Editar" siempre tiene respuesta visible) ── */}
      <Dialog open={editando !== null} onOpenChange={(abierto) => !abierto && setEditando(null)}>
        <DialogContent style={{ maxWidth: 'min(36rem, calc(100% - 2rem))' }}>
          <DialogHeader>
            <DialogTitle>Editar carga</DialogTitle>
            <DialogDescription>
              {editando && `${editando.movil?.placa ?? `#${editando.movil_id}`} · ${fechaCL(editando.fecha)}. `}
              El cambio queda registrado en el historial con tu nombre.
            </DialogDescription>
          </DialogHeader>
          {editando && (
            <FormularioCarga
              key={editando.id}
              moviles={moviles}
              carga={editando}
              enDialogo
              onGuardado={(mensaje) => alGuardar(mensaje, false)}
              onCancelar={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmar eliminación ── */}
      <Dialog open={!!porEliminar} onOpenChange={(abierto) => !abierto && !eliminando && setPorEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar carga</DialogTitle>
            <DialogDescription>
              {porEliminar &&
                `${porEliminar.movil?.placa ?? ''} · ${fechaCL(porEliminar.fecha)} · ${formatHoras(Number(porEliminar.litros))} L · ${formatCLP(Number(porEliminar.costo_total))}. `}
              La carga se elimina, pero el movimiento queda en el historial con tu nombre.
            </DialogDescription>
          </DialogHeader>
          {errorEliminar && <p className={TEXTO_ERROR}>{errorEliminar}</p>}
          <DialogFooter>
            <Button variant="ghost" disabled={eliminando} onClick={() => setPorEliminar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={eliminando} onClick={confirmarEliminar}>
              {eliminando ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────────────────── Formulario (alta y edición) ───────────────────────── */

/**
 * Un mismo formulario para crear (carga = null) y editar (carga = la fila).
 * Cada instancia tiene su propio estado: el de alta conserva móvil y fecha entre cargas
 * seguidas; el de edición se monta con los valores de la fila (por eso lleva `key`).
 */
function FormularioCarga({
  moviles,
  carga,
  enDialogo = false,
  onGuardado,
  onCancelar,
}: {
  moviles: Movil[];
  carga: Carga | null;
  enDialogo?: boolean;
  onGuardado: (mensaje: string) => void;
  onCancelar?: () => void;
}) {
  const [movilId, setMovilId] = useState(() => (carga ? String(carga.movil_id) : ''));
  const [fecha, setFecha] = useState(() => carga?.fecha ?? hoyLocal());
  const [litros, setLitros] = useState(() => (carga ? String(Number(carga.litros)) : ''));
  const [costo, setCosto] = useState(() => (carga ? String(Math.round(Number(carga.costo_total))) : ''));
  const [observacion, setObservacion] = useState(() => carga?.observacion ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = (e: FormEvent) => {
    e.preventDefault();

    const litrosNum = parseLitros(litros);
    const costoNum = parsePesos(costo);

    if (!movilId) return setError('Elige un móvil.');
    if (!fecha) return setError('Indica la fecha de la carga.');
    if (!Number.isFinite(litrosNum) || litrosNum <= 0) return setError('Los litros deben ser un número mayor a 0.');
    if (!Number.isFinite(costoNum)) return setError('Indica el total pagado en pesos.');

    const payload = {
      movil_id: Number(movilId),
      fecha,
      litros: litrosNum,
      costo_total: costoNum,
      observacion: observacion.trim() || null,
    };

    setGuardando(true);
    setError(null);

    const peticion = carga ? api.put(`/combustibles/${carga.id}`, payload) : api.post('/combustibles', payload);

    peticion
      .then(() => {
        // En el alta se conservan móvil y fecha para cargar varias seguidas.
        if (!carga) {
          setLitros('');
          setCosto('');
          setObservacion('');
        }
        onGuardado(carga ? 'Carga actualizada.' : 'Carga registrada.');
      })
      .catch((err) => setError(mensajeError(err, 'No se pudo guardar la carga.')))
      .finally(() => setGuardando(false));
  };

  const grilla = enDialogo ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 md:grid-cols-6';
  const spanMovil = enDialogo ? 'sm:col-span-2' : 'md:col-span-2';
  const spanObservacion = enDialogo ? 'sm:col-span-2' : 'md:col-span-1';
  const spanAcciones = enDialogo ? 'sm:col-span-2' : 'md:col-span-6';

  return (
    <form onSubmit={guardar} className={grilla}>
      <label className={`min-w-0 space-y-1 ${spanMovil}`}>
        <span className="text-xs text-muted-foreground">Móvil</span>
        <select className={SELECT_CLASE} value={movilId} onChange={(e) => setMovilId(e.target.value)}>
          <option value="">Selecciona un móvil…</option>
          {moviles.map((m) => (
            <option key={m.id} value={m.id}>
              {nombreMovil(m)}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-0 space-y-1">
        <span className="text-xs text-muted-foreground">Fecha</span>
        <Input type="date" value={fecha} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} />
      </label>

      <label className="min-w-0 space-y-1">
        <span className="text-xs text-muted-foreground">Litros</span>
        <Input inputMode="decimal" placeholder="40,5" value={litros} onChange={(e) => setLitros(e.target.value)} />
      </label>

      <label className="min-w-0 space-y-1">
        <span className="text-xs text-muted-foreground">Total pagado ($)</span>
        <Input inputMode="numeric" placeholder="50000" value={costo} onChange={(e) => setCosto(e.target.value)} />
      </label>

      <label className={`min-w-0 space-y-1 ${spanObservacion}`}>
        <span className="text-xs text-muted-foreground">Observación (opcional)</span>
        <Input value={observacion} maxLength={1000} onChange={(e) => setObservacion(e.target.value)} />
      </label>

      <div className={`flex flex-wrap items-center gap-3 ${spanAcciones}`}>
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : carga ? 'Guardar cambios' : 'Registrar carga'}
        </Button>
        {onCancelar && (
          <Button type="button" variant="ghost" disabled={guardando} onClick={onCancelar}>
            Cancelar
          </Button>
        )}
        {error && <p className={TEXTO_ERROR}>{error}</p>}
      </div>
    </form>
  );
}

/* ───────────────────────── Piezas del listado ───────────────────────── */

function precioPorLitro(c: Carga): string {
  const l = Number(c.litros);
  return l > 0 ? formatCLP(Number(c.costo_total) / l) : '—';
}

/** "Cargada por X el …" y, si se editó, "Editada por Y el …". */
function RegistroCarga({ carga }: { carga: Carga }) {
  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <p>
        Cargada por <span className="text-foreground">{carga.registrado_por?.name ?? 'usuario desconocido'}</span> ·{' '}
        {fechaHora(carga.created_at)}
      </p>
      {carga.ultima_edicion && (
        <p>
          Editada por <span className="text-foreground">{carga.ultima_edicion.usuario}</span> ·{' '}
          {fechaHora(carga.ultima_edicion.fecha)}
        </p>
      )}
      {carga.observacion && <p className="italic">“{carga.observacion}”</p>}
    </div>
  );
}

function TarjetaCarga({
  carga,
  onEditar,
  onEliminar,
}: {
  carga: Carga;
  onEditar: (c: Carga) => void;
  onEliminar: (c: Carga) => void;
}) {
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {carga.movil?.placa ?? `#${carga.movil_id}`} · {fechaCL(carga.fecha)}
          </p>
          <p className="text-sm tabular-nums">
            {formatHoras(Number(carga.litros))} L · {formatCLP(Number(carga.costo_total))}{' '}
            <span className="text-muted-foreground">({precioPorLitro(carga)}/L)</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Editar carga"
            onClick={() => onEditar(carga)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Eliminar carga"
            onClick={() => onEliminar(carga)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <RegistroCarga carga={carga} />
    </div>
  );
}

/* ───────────────────────── Historial de movimientos ───────────────────────── */

const ETIQUETA_ACCION: Record<Movimiento['accion'], string> = {
  creacion: 'Creación',
  edicion: 'Edición',
  eliminacion: 'Eliminación',
};

function HistorialMovimientos({
  moviles,
  movilesPorId,
  recarga,
}: {
  moviles: Movil[];
  movilesPorId: Map<number, Movil>;
  recarga: number;
}) {
  const [accion, setAccion] = useState('');
  const [filtroMovil, setFiltroMovil] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<Pagina<Movimiento> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPagina(1);
  }, [accion, filtroMovil]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    api
      .get<Pagina<Movimiento>>('/combustibles/movimientos', {
        params: { page: pagina, accion: accion || undefined, movil_id: filtroMovil || undefined },
      })
      .then((res) => {
        if (cancelado) return;
        setDatos(res.data);
        setError(null);
      })
      .catch(() => !cancelado && setError('No se pudo cargar el historial.'))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [pagina, accion, filtroMovil, recarga]);

  return (
    <div className="border-t">
      <div className="flex flex-wrap items-end gap-3 p-3">
        <label className="min-w-40 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Móvil</span>
          <select className={SELECT_CLASE} value={filtroMovil} onChange={(e) => setFiltroMovil(e.target.value)}>
            <option value="">Todos</option>
            {moviles.map((m) => (
              <option key={m.id} value={m.id}>
                {nombreMovil(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-40 space-y-1">
          <span className="text-xs text-muted-foreground">Acción</span>
          <select className={SELECT_CLASE} value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="">Todas</option>
            <option value="creacion">Creación</option>
            <option value="edicion">Edición</option>
            <option value="eliminacion">Eliminación</option>
          </select>
        </label>
      </div>

      {error && <p className={`px-4 pb-3 ${TEXTO_ERROR}`}>{error}</p>}

      {cargando && !datos ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : datos && datos.data.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Aún no hay movimientos registrados. Se guardan desde esta versión en adelante.
        </p>
      ) : (
        <ul className="divide-y">
          {datos?.data.map((m) => (
            <li key={m.id} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={m.accion === 'eliminacion' ? 'destructive' : 'outline'}>{ETIQUETA_ACCION[m.accion]}</Badge>
                <span className="text-sm font-medium">{m.movil?.placa ?? '—'}</span>
                <span className="text-xs text-muted-foreground">
                  {m.user?.name ?? 'Usuario eliminado'} · {fechaHora(m.created_at)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{describir(m, movilesPorId)}</p>
            </li>
          ))}
        </ul>
      )}

      {datos && datos.last_page > 1 && (
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <Button variant="outline" size="sm" disabled={pagina <= 1 || cargando} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {datos.current_page} de {datos.last_page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= datos.last_page || cargando}
            onClick={() => setPagina(pagina + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Texto de cada movimiento ───────────────────────── */

const CAMPOS: { clave: keyof Datos; etiqueta: string }[] = [
  { clave: 'movil_id', etiqueta: 'Móvil' },
  { clave: 'fecha', etiqueta: 'Fecha' },
  { clave: 'litros', etiqueta: 'Litros' },
  { clave: 'costo_total', etiqueta: 'Total' },
  { clave: 'observacion', etiqueta: 'Observación' },
];

function valorLegible(clave: keyof Datos, datos: Datos, movilesPorId: Map<number, Movil>): string {
  switch (clave) {
    case 'movil_id':
      return movilesPorId.get(datos.movil_id)?.placa ?? `#${datos.movil_id}`;
    case 'fecha':
      return fechaCL(datos.fecha);
    case 'litros':
      return `${formatHoras(datos.litros)} L`;
    case 'costo_total':
      return formatCLP(datos.costo_total);
    case 'observacion':
      return datos.observacion ? `“${datos.observacion}”` : '—';
  }
}

function resumen(datos: Datos, movilesPorId: Map<number, Movil>): string {
  return `${fechaCL(datos.fecha)} · ${formatHoras(datos.litros)} L · ${formatCLP(datos.costo_total)} · ${
    movilesPorId.get(datos.movil_id)?.placa ?? `#${datos.movil_id}`
  }`;
}

function describir(m: Movimiento, movilesPorId: Map<number, Movil>): string {
  if (m.accion === 'creacion' && m.datos_despues) return resumen(m.datos_despues, movilesPorId);
  if (m.accion === 'eliminacion' && m.datos_antes) return `Se eliminó: ${resumen(m.datos_antes, movilesPorId)}`;

  if (m.accion === 'edicion' && m.datos_antes && m.datos_despues) {
    const antes = m.datos_antes;
    const despues = m.datos_despues;
    const cambios = CAMPOS.filter((c) => antes[c.clave] !== despues[c.clave]).map(
      (c) => `${c.etiqueta}: ${valorLegible(c.clave, antes, movilesPorId)} → ${valorLegible(c.clave, despues, movilesPorId)}`
    );
    return cambios.length > 0 ? cambios.join(' · ') : 'Sin cambios visibles.';
  }

  return '—';
}
