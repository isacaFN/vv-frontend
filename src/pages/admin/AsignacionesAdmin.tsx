import { useEffect, useMemo, useState } from 'react';
import { History, Search, UserMinus, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SELECT_CLASE, fechaCL, fechaHora, hoyLocal, mensajeError } from '@/pages/admin/utils';
import { cn } from '@/lib/utils';

/* ───────────────────────── Tipos ───────────────────────── */

type Vigente = {
  id: number;
  colaborador_id: number;
  nombre: string;
  documento: string | null;
  cargo: string | null;
  asignado_desde: string;
  asignado_por: { usuario: string; fecha: string | null } | null; // null = anterior al historial
};

type MovilFila = {
  id: number;
  placa: string;
  alias: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  asignaciones_vigentes: Vigente[];
};

type Candidato = { id: number; documento: string; nombre: string; cargo: string | null; movil_vigente: string | null };

type Movimiento = {
  id: number;
  accion: 'asignacion' | 'liberacion' | 'cierre_automatico';
  fecha: string | null;
  movil_placa: string | null;
  colaborador_nombre: string | null;
  colaborador_documento: string | null;
  asignado_desde: string | null;
  asignado_hasta: string | null;
  usuario: string;
};

type Pagina<T> = { data: T[]; current_page: number; last_page: number; total: number };

type ParaLiberar = { movil: MovilFila; asignacion: Vigente };

/* ───────────────────────── Pestaña Asignaciones ───────────────────────── */

export default function AsignacionesAdmin() {
  const [moviles, setMoviles] = useState<MovilFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0); // se incrementa para volver a pedir panel + historial
  const [aviso, setAviso] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [soloSinAsignar, setSoloSinAsignar] = useState(false);

  const [paraAsignar, setParaAsignar] = useState<MovilFila | null>(null);
  const [paraLiberar, setParaLiberar] = useState<ParaLiberar | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    api
      .get<{ moviles: MovilFila[] }>('/moviles/asignaciones')
      .then((res) => {
        if (cancelado) return;
        setMoviles(res.data.moviles);
        setErrorCarga(null);
      })
      .catch(() => !cancelado && setErrorCarga('No se pudo cargar la lista de móviles.'))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [recarga]);

  const sinAsignar = useMemo(() => moviles.filter((m) => m.asignaciones_vigentes.length === 0).length, [moviles]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return moviles.filter((m) => {
      if (soloSinAsignar && m.asignaciones_vigentes.length > 0) return false;
      if (!q) return true;
      return (
        m.placa.toLowerCase().includes(q) ||
        (m.alias ?? '').toLowerCase().includes(q) ||
        m.asignaciones_vigentes.some((a) => a.nombre.toLowerCase().includes(q) || (a.documento ?? '').includes(q))
      );
    });
  }, [moviles, busqueda, soloSinAsignar]);

  const alTerminar = (mensaje: string) => {
    setAviso(mensaje);
    setParaAsignar(null);
    setParaLiberar(null);
    setRecarga((n) => n + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Asignación de móviles</h2>
          <p className="text-sm text-muted-foreground">
            Un móvil puede tener varios colaboradores; cada colaborador, un solo móvil a la vez. Cada cambio queda
            registrado con quién lo hizo.
          </p>
        </div>
        <Badge variant="outline">
          {moviles.length} móviles · {sinAsignar} sin asignar
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por placa, alias o colaborador…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Button variant={soloSinAsignar ? 'default' : 'outline'} size="sm" onClick={() => setSoloSinAsignar((v) => !v)}>
          Solo sin asignar ({sinAsignar})
        </Button>
      </div>

      {aviso && <p className="text-sm text-muted-foreground">{aviso}</p>}
      {errorCarga && <p className="text-sm text-red-600 dark:text-red-800">{errorCarga}</p>}

      {cargando && moviles.length === 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          {moviles.length === 0 ? 'No hay móviles activos registrados.' : 'Ningún móvil coincide con la búsqueda.'}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtrados.map((m) => (
            <TarjetaMovil
              key={m.id}
              movil={m}
              onAsignar={() => {
                setAviso(null);
                setParaAsignar(m);
              }}
              onLiberar={(asignacion) => {
                setAviso(null);
                setParaLiberar({ movil: m, asignacion });
              }}
            />
          ))}
        </div>
      )}

      {/* ── Historial ── */}
      <div className="rounded-lg border bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 p-4 text-left"
          onClick={() => setVerHistorial((v) => !v)}
        >
          <span className="flex items-center gap-2 font-heading text-lg font-semibold">
            <History className="size-5" /> Historial de asignaciones
          </span>
          <span className="text-sm text-muted-foreground">{verHistorial ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        {verHistorial && <HistorialAsignaciones moviles={moviles} recarga={recarga} />}
      </div>

      <DialogAsignar movil={paraAsignar} onCerrar={() => setParaAsignar(null)} onListo={alTerminar} />
      <DialogLiberar datos={paraLiberar} onCerrar={() => setParaLiberar(null)} onListo={alTerminar} />
    </div>
  );
}

/* ───────────────────────── Tarjeta de móvil ───────────────────────── */

function TarjetaMovil({
  movil,
  onAsignar,
  onLiberar,
}: {
  movil: MovilFila;
  onAsignar: () => void;
  onLiberar: (a: Vigente) => void;
}) {
  const detalle = [movil.marca, movil.modelo, movil.anio].filter(Boolean).join(' ');

  return (
    <div className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-base font-semibold">
            {movil.placa}
            {movil.alias && <span className="ml-2 text-sm font-normal text-muted-foreground">{movil.alias}</span>}
          </p>
          {detalle && <p className="truncate text-xs text-muted-foreground">{detalle}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={onAsignar}>
          <UserPlus className="size-4" /> Asignar
        </Button>
      </div>

      {movil.asignaciones_vigentes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin colaboradores asignados.</p>
      ) : (
        <ul className="space-y-2">
          {movil.asignaciones_vigentes.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/50 p-2">
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">{a.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {[a.documento, a.cargo].filter(Boolean).join(' · ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  Desde {fechaCL(a.asignado_desde)}
                  {a.asignado_por
                    ? ` · asignó ${a.asignado_por.usuario} (${fechaHora(a.asignado_por.fecha)})`
                    : ' · sin registro de quién asignó'}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => onLiberar(a)}>
                <UserMinus className="size-4" /> Liberar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────────────────── Diálogo: asignar ───────────────────────── */

function DialogAsignar({
  movil,
  onCerrar,
  onListo,
}: {
  movil: MovilFila | null;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [elegido, setElegido] = useState<Candidato | null>(null);
  const [desde, setDesde] = useState(hoyLocal);
  const [hasta, setHasta] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre para otro móvil, el diálogo empieza limpio.
  useEffect(() => {
    if (!movil) return;
    setBusqueda('');
    setCandidatos([]);
    setElegido(null);
    setDesde(hoyLocal());
    setHasta('');
    setError(null);
  }, [movil]);

  // Búsqueda con espera de 300 ms para no consultar en cada tecla.
  useEffect(() => {
    const texto = busqueda.trim();
    if (!movil || texto.length < 2) {
      setCandidatos([]);
      setBuscando(false);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const espera = setTimeout(() => {
      api
        .get<Candidato[]>('/moviles/asignaciones/colaboradores', { params: { buscar: texto } })
        .then((res) => !cancelado && setCandidatos(res.data))
        .catch(() => !cancelado && setCandidatos([]))
        .finally(() => !cancelado && setBuscando(false));
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [busqueda, movil]);

  const guardar = () => {
    if (!movil || !elegido) return;
    if (hasta && hasta < desde) return setError('La fecha de término no puede ser anterior al inicio.');

    setGuardando(true);
    setError(null);
    api
      .post('/moviles/asignaciones', {
        movil_id: movil.id,
        colaborador_id: elegido.id,
        asignado_desde: desde,
        asignado_hasta: hasta || null,
      })
      .then(() => onListo(`${elegido.nombre} asignado al móvil ${movil.placa}.`))
      .catch((e) => setError(mensajeError(e, 'No se pudo asignar el móvil.')))
      .finally(() => setGuardando(false));
  };

  return (
    <Dialog open={!!movil} onOpenChange={(abierto) => !abierto && !guardando && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar colaborador al móvil {movil?.placa}</DialogTitle>
          <DialogDescription>Solo aparecen colaboradores activos. Busca por nombre, apellido o RUT (sin DV).</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              autoFocus
              placeholder="Buscar colaborador…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto">
            {buscando && <p className="p-2 text-sm text-muted-foreground">Buscando…</p>}
            {!buscando && busqueda.trim().length >= 2 && candidatos.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">Sin resultados entre los colaboradores activos.</p>
            )}
            {candidatos.map((c) => {
              const ocupado = c.movil_vigente !== null;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={ocupado}
                  onClick={() => setElegido(c)}
                  className={cn(
                    'flex w-full flex-col items-start rounded-md border p-2 text-left text-sm',
                    elegido?.id === c.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted',
                    ocupado && 'cursor-not-allowed opacity-60 hover:bg-transparent'
                  )}
                >
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {[c.documento, c.cargo].filter(Boolean).join(' · ')}
                  </span>
                  {ocupado && (
                    <span className="text-xs text-amber-700 dark:text-amber-500">
                      Ya tiene el móvil {c.movil_vigente}: libéralo antes de asignarle otro.
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {elegido && (
            <p className="rounded-md bg-muted/50 p-2 text-sm">
              Se asignará a <span className="font-medium">{elegido.nombre}</span>.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Desde</span>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Hasta (opcional, vacío = vigente)</span>
              <Input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-800">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button disabled={!elegido || !desde || guardando} onClick={guardar}>
            {guardando ? 'Asignando…' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Diálogo: liberar ───────────────────────── */

function DialogLiberar({
  datos,
  onCerrar,
  onListo,
}: {
  datos: ParaLiberar | null;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const [hasta, setHasta] = useState(hoyLocal);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datos) return;
    // Por defecto, hoy; nunca antes del inicio de la asignación.
    const hoy = hoyLocal();
    setHasta(hoy < datos.asignacion.asignado_desde ? datos.asignacion.asignado_desde : hoy);
    setError(null);
  }, [datos]);

  const guardar = () => {
    if (!datos) return;
    setGuardando(true);
    setError(null);
    api
      .post<{ siguiente_desde_sugerido: string }>('/moviles/asignaciones/liberar', {
        colaborador_id: datos.asignacion.colaborador_id,
        asignado_hasta: hasta,
      })
      .then((res) =>
        onListo(
          `${datos.asignacion.nombre} liberado del móvil ${datos.movil.placa}. Su próximo móvil puede partir desde el ${fechaCL(
            res.data.siguiente_desde_sugerido
          )}.`
        )
      )
      .catch((e) => setError(mensajeError(e, 'No se pudo liberar el móvil.')))
      .finally(() => setGuardando(false));
  };

  return (
    <Dialog open={!!datos} onOpenChange={(abierto) => !abierto && !guardando && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar móvil {datos?.movil.placa}</DialogTitle>
          <DialogDescription>
            {datos &&
              `${datos.asignacion.nombre} deja de tener este móvil. La fecha es el último día que lo usa (inclusive); el siguiente móvil parte al día siguiente.`}
          </DialogDescription>
        </DialogHeader>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Último día con el móvil</span>
          <Input
            type="date"
            value={hasta}
            min={datos?.asignacion.asignado_desde}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-800">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button disabled={!hasta || guardando} onClick={guardar}>
            {guardando ? 'Liberando…' : 'Liberar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Historial ───────────────────────── */

const ETIQUETA: Record<Movimiento['accion'], string> = {
  asignacion: 'Asignación',
  liberacion: 'Liberación',
  cierre_automatico: 'Cierre automático',
};

function describir(m: Movimiento): string {
  const desde = m.asignado_desde ? fechaCL(m.asignado_desde) : '—';
  const hasta = m.asignado_hasta ? fechaCL(m.asignado_hasta) : null;

  if (m.accion === 'asignacion') return hasta ? `Asignado del ${desde} al ${hasta}` : `Asignado desde el ${desde}`;
  if (m.accion === 'liberacion') return `Liberado: último día con el móvil ${hasta ?? '—'} (asignado desde el ${desde})`;
  return `Cerrada por inactividad del colaborador: último día ${hasta ?? '—'} (asignado desde el ${desde})`;
}

function HistorialAsignaciones({ moviles, recarga }: { moviles: MovilFila[]; recarga: number }) {
  const [filtroMovil, setFiltroMovil] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<Pagina<Movimiento> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPagina(1);
  }, [filtroMovil]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    api
      .get<Pagina<Movimiento>>('/moviles/asignaciones/historial', {
        params: { page: pagina, movil_id: filtroMovil || undefined },
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
  }, [pagina, filtroMovil, recarga]);

  return (
    <div className="border-t">
      <div className="p-3">
        <label className="block max-w-xs space-y-1">
          <span className="text-xs text-muted-foreground">Móvil</span>
          <select className={SELECT_CLASE} value={filtroMovil} onChange={(e) => setFiltroMovil(e.target.value)}>
            <option value="">Todos</option>
            {moviles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.placa}
                {m.alias ? ` · ${m.alias}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="px-4 pb-3 text-sm text-red-600 dark:text-red-800">{error}</p>}

      {cargando && !datos ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : datos && datos.data.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Aún no hay movimientos. Se registran desde esta versión en adelante.
        </p>
      ) : (
        <ul className="divide-y">
          {datos?.data.map((m) => (
            <li key={m.id} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ETIQUETA[m.accion]}</Badge>
                <span className="text-sm font-medium">{m.movil_placa ?? '—'}</span>
                <span className="text-sm">{m.colaborador_nombre ?? '—'}</span>
                <span className="text-xs text-muted-foreground">
                  {m.usuario} · {fechaHora(m.fecha)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{describir(m)}</p>
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
