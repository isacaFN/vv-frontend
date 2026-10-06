import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { History, Search, UserMinus, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { aFechaISOLocal } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';

/* ───────────────────────── Tipos ───────────────────────── */

type Rol = { clave: string; etiqueta: string };

type Responsable = {
  colaborador_id: number;
  nombre: string | null;
  documento: string | null;
  asignado_desde: string; // "2026-10-03"
  asignado_por: string | null;
} | null;

type Fila = {
  id: number;
  nombre: string;
  cecos: string | null;
  responsables: Record<string, Responsable>;
};

type Datos = {
  roles: Rol[];
  instalaciones: Fila[];
  resumen: { total: number; sin_responsable: Record<string, number> };
};

type ColaboradorOpcion = {
  id: number;
  nombre: string;
  documento: string | null;
  cargo: string | null;
  instalaciones_vigentes: number;
};

type Movimiento = {
  id: number;
  accion: 'asignacion' | 'liberacion' | 'cierre_automatico';
  rol: string;
  rol_etiqueta: string;
  created_at: string;
  asignado_desde: string;
  asignado_hasta: string | null;
  instalacion: { id: number; nombre: string; cecos: string | null } | null;
  colaborador: { id: number; nombre: string; documento: string | null } | null;
  user: { id: number; name: string } | null;
};

type Pagina<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Accion = { tipo: 'asignar' | 'liberar'; rol: Rol; ids: number[] };

/* ───────────────────────── Helpers ───────────────────────── */

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

function mensajeError(e: unknown, respaldo: string): string {
  if (isAxiosError(e)) {
    const errores = e.response?.data?.errors as Record<string, string[]> | undefined;
    const primero = errores ? Object.values(errores).flat()[0] : undefined;
    return primero ?? e.response?.data?.message ?? respaldo;
  }
  return respaldo;
}

/** Minúsculas y sin tildes, para buscar sin que importe cómo se escribió. */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SELECT_CLASE =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const ETIQUETA_ACCION: Record<Movimiento['accion'], string> = {
  asignacion: 'Asignación',
  liberacion: 'Liberación',
  cierre_automatico: 'Cierre automático',
};

/* ───────────────────────── Pestaña Responsables ───────────────────────── */

export default function ResponsablesAdmin() {
  const isMobile = useIsMobile();

  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const [buscar, setBuscar] = useState('');
  // 'todas' | 'sin:<rol>' | 'con:<rol>:<colaborador_id>'
  const [filtro, setFiltro] = useState('todas');
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [accion, setAccion] = useState<Accion | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api
      .get<Datos>('/responsables')
      .then((res) => {
        if (!vigente) return;
        setDatos(res.data);
        setError(null);
        // Si una instalación dejó de existir en la lista, se quita de la selección.
        const ids = new Set(res.data.instalaciones.map((i) => i.id));
        setSeleccion((prev) => new Set([...prev].filter((id) => ids.has(id))));
      })
      .catch((e) => vigente && setError(mensajeError(e, 'No se pudieron cargar las instalaciones.')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const roles = datos?.roles ?? [];

  // Opciones del filtro por persona: quién tiene cuántas instalaciones, por rol.
  const opcionesPersona = useMemo(() => {
    const salida: { valor: string; etiqueta: string; grupo: string }[] = [];
    if (!datos) return salida;
    for (const rol of datos.roles) {
      const cuenta = new Map<number, { nombre: string; n: number }>();
      for (const inst of datos.instalaciones) {
        const r = inst.responsables[rol.clave];
        if (!r) continue;
        const previo = cuenta.get(r.colaborador_id);
        cuenta.set(r.colaborador_id, { nombre: r.nombre ?? `#${r.colaborador_id}`, n: (previo?.n ?? 0) + 1 });
      }
      [...cuenta.entries()]
        .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'))
        .forEach(([id, v]) =>
          salida.push({ valor: `con:${rol.clave}:${id}`, etiqueta: `${v.nombre} (${v.n})`, grupo: rol.etiqueta }),
        );
    }
    return salida;
  }, [datos]);

  const filtradas = useMemo(() => {
    if (!datos) return [];
    const termino = normalizar(buscar.trim());
    return datos.instalaciones.filter((inst) => {
      if (termino && !normalizar(`${inst.nombre} ${inst.cecos ?? ''}`).includes(termino)) return false;
      if (filtro === 'todas') return true;
      const [tipo, clave, id] = filtro.split(':');
      const r = inst.responsables[clave];
      if (tipo === 'sin') return r === null || r === undefined;
      if (tipo === 'con') return !!r && String(r.colaborador_id) === id;
      return true;
    });
  }, [datos, buscar, filtro]);

  const todasMarcadas = filtradas.length > 0 && filtradas.every((i) => seleccion.has(i.id));

  function alternarTodas() {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (todasMarcadas) filtradas.forEach((i) => siguiente.delete(i.id));
      else filtradas.forEach((i) => siguiente.add(i.id));
      return siguiente;
    });
  }

  function alternarUna(id: number) {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function abrir(tipo: Accion['tipo'], rol: Rol, ids: number[]) {
    setAviso(null);
    setAccion({ tipo, rol, ids });
  }

  const instalacionesDeAccion = useMemo(() => {
    if (!accion || !datos) return [];
    const ids = new Set(accion.ids);
    return datos.instalaciones.filter((i) => ids.has(i.id));
  }, [accion, datos]);

  /* Celda de un rol: responsable actual o "Sin asignar", con sus acciones (función, no componente: no se remonta). */
  function celdaRol(inst: Fila, rol: Rol) {
    const r = inst.responsables[rol.clave];
    if (!r) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-muted-foreground">
            Sin asignar
          </Badge>
          <Button size="sm" variant="outline" onClick={() => abrir('asignar', rol, [inst.id])}>
            <UserPlus className="mr-1 h-3.5 w-3.5" /> Asignar
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{r.nombre ?? `Colaborador #${r.colaborador_id}`}</div>
          <div className="text-xs text-muted-foreground">
            desde {fechaCL(r.asignado_desde)}
            {r.asignado_por ? ` · ${r.asignado_por}` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => abrir('asignar', rol, [inst.id])}>
            Cambiar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => abrir('liberar', rol, [inst.id])}>
            Quitar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-lg font-semibold">Responsables de instalación</h2>
          <p className="text-sm text-muted-foreground">
            Cada instalación tiene un responsable por rol. La efectividad de visitas se mide por supervisor.
          </p>
        </div>
        {datos && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Badge variant="outline">{datos.resumen.total} instalaciones</Badge>
            {roles.map((rol) => (
              <Badge
                key={rol.clave}
                variant={datos.resumen.sin_responsable[rol.clave] > 0 ? 'destructive' : 'outline'}
              >
                {datos.resumen.sin_responsable[rol.clave]} sin {rol.etiqueta.toLowerCase()}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {aviso && (
        <div className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {aviso}
        </div>
      )}
      {error && <p className={TEXTO_ERROR}>{error}</p>}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar instalación o CECOS…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
        <select className={SELECT_CLASE} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todas">Todas las instalaciones</option>
          {roles.map((rol) => (
            <option key={rol.clave} value={`sin:${rol.clave}`}>
              Sin {rol.etiqueta.toLowerCase()}
            </option>
          ))}
          {roles.map((rol) => {
            const delRol = opcionesPersona.filter((o) => o.grupo === rol.etiqueta);
            if (delRol.length === 0) return null;
            return (
              <optgroup key={rol.clave} label={rol.etiqueta}>
                {delRol.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <span className="text-sm text-muted-foreground">
          {filtradas.length} de {datos?.instalaciones.length ?? 0}
        </span>
      </div>

      {/* Acciones en bloque */}
      {seleccion.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{seleccion.size} seleccionada(s)</span>
          {roles.map((rol) => (
            <span key={rol.clave} className="flex gap-1">
              <Button size="sm" onClick={() => abrir('asignar', rol, [...seleccion])}>
                <UserPlus className="mr-1 h-3.5 w-3.5" /> {rol.etiqueta}
              </Button>
              <Button size="sm" variant="outline" onClick={() => abrir('liberar', rol, [...seleccion])}>
                <UserMinus className="mr-1 h-3.5 w-3.5" /> Quitar
              </Button>
            </span>
          ))}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSeleccion(new Set())}>
            Limpiar selección
          </Button>
        </div>
      )}

      {/* Lista */}
      {cargando && !datos ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No hay instalaciones con ese filtro.</p>
      ) : isMobile ? (
        <div className="space-y-2">
          {filtradas.map((inst) => (
            <div key={inst.id} className="space-y-3 rounded-md border p-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={seleccion.has(inst.id)}
                  onChange={() => alternarUna(inst.id)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{inst.nombre}</span>
                  {inst.cecos && <span className="text-xs text-muted-foreground">CECOS {inst.cecos}</span>}
                </span>
              </label>
              {roles.map((rol) => (
                <div key={rol.clave} className="space-y-1">
                  <div className="text-xs font-medium uppercase text-muted-foreground">{rol.etiqueta}</div>
                  {celdaRol(inst, rol)}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    aria-label="Seleccionar todas las instalaciones visibles"
                    checked={todasMarcadas}
                    onChange={alternarTodas}
                  />
                </TableHead>
                <TableHead>Instalación</TableHead>
                {roles.map((rol) => (
                  <TableHead key={rol.clave}>{rol.etiqueta}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((inst) => (
                <TableRow key={inst.id} data-state={seleccion.has(inst.id) ? 'selected' : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label={`Seleccionar ${inst.nombre}`}
                      checked={seleccion.has(inst.id)}
                      onChange={() => alternarUna(inst.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{inst.nombre}</div>
                    {inst.cecos && <div className="text-xs text-muted-foreground">CECOS {inst.cecos}</div>}
                  </TableCell>
                  {roles.map((rol) => (
                    <TableCell key={rol.clave}>
                      {celdaRol(inst, rol)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Historial */}
      <div>
        <Button variant="outline" size="sm" onClick={() => setVerHistorial((v) => !v)}>
          <History className="mr-1 h-4 w-4" /> {verHistorial ? 'Ocultar historial' : 'Ver historial de cambios'}
        </Button>
        {verHistorial && <HistorialResponsables recarga={recarga} isMobile={isMobile} />}
      </div>

      {accion?.tipo === 'asignar' && (
        <DialogAsignar
          rol={accion.rol}
          instalaciones={instalacionesDeAccion}
          onClose={() => setAccion(null)}
          onHecho={(msg) => {
            setAccion(null);
            setAviso(msg);
            setSeleccion(new Set());
            setRecarga((n) => n + 1);
          }}
        />
      )}
      {accion?.tipo === 'liberar' && (
        <DialogLiberar
          rol={accion.rol}
          instalaciones={instalacionesDeAccion}
          onClose={() => setAccion(null)}
          onHecho={(msg) => {
            setAccion(null);
            setAviso(msg);
            setSeleccion(new Set());
            setRecarga((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Resumen de instalaciones de un diálogo ───────────────────────── */

function ListaInstalaciones({ instalaciones }: { instalaciones: Fila[] }) {
  const maximo = 5;
  const visibles = instalaciones.slice(0, maximo);
  const resto = instalaciones.length - visibles.length;
  return (
    <p className="text-sm text-muted-foreground">
      {instalaciones.length === 1 ? 'Instalación: ' : `${instalaciones.length} instalaciones: `}
      <span className="text-foreground">{visibles.map((i) => i.nombre).join(', ')}</span>
      {resto > 0 ? ` y ${resto} más` : ''}
    </p>
  );
}

/* ───────────────────────── Diálogo: asignar / cambiar ───────────────────────── */

function DialogAsignar({
  rol,
  instalaciones,
  onClose,
  onHecho,
}: {
  rol: Rol;
  instalaciones: Fila[];
  onClose: () => void;
  onHecho: (mensaje: string) => void;
}) {
  const [buscar, setBuscar] = useState('');
  const [opciones, setOpciones] = useState<ColaboradorOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [elegido, setElegido] = useState<ColaboradorOpcion | null>(null);
  const [desde, setDesde] = useState(hoyLocal());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Búsqueda con debounce; con el texto vacío lista los primeros (hay pocos supervisores).
  useEffect(() => {
    let vigente = true;
    setBuscando(true);
    const t = setTimeout(() => {
      api
        .get<ColaboradorOpcion[]>('/responsables/colaboradores', { params: { rol: rol.clave, buscar } })
        .then((res) => {
          if (!vigente) return;
          setOpciones(res.data);
          setErrorBusqueda(null);
        })
        .catch((e) => vigente && setErrorBusqueda(mensajeError(e, 'No se pudo buscar.')))
        .finally(() => vigente && setBuscando(false));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [buscar, rol.clave]);

  const reemplazos = elegido
    ? instalaciones.filter((i) => {
        const r = i.responsables[rol.clave];
        return !!r && r.colaborador_id !== elegido.id;
      }).length
    : 0;
  const yaLoTienen = elegido
    ? instalaciones.filter((i) => i.responsables[rol.clave]?.colaborador_id === elegido.id).length
    : 0;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!elegido) {
      setError(`Elige un ${rol.etiqueta.toLowerCase()}.`);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await api.post<{ message: string }>('/responsables/asignar', {
        rol: rol.clave,
        colaborador_id: elegido.id,
        instalacion_ids: instalaciones.map((i) => i.id),
        asignado_desde: desde,
      });
      onHecho(res.data.message);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo asignar.'));
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !enviando && onClose()}>
      <DialogContent style={{ maxWidth: 'min(46rem, calc(100% - 2rem))' }}>
        <form onSubmit={enviar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Asignar {rol.etiqueta.toLowerCase()}</DialogTitle>
            <DialogDescription>Una instalación tiene un solo {rol.etiqueta.toLowerCase()} a la vez.</DialogDescription>
          </DialogHeader>

          <ListaInstalaciones instalaciones={instalaciones} />

          <div className="space-y-2">
            <Input
              autoFocus
              placeholder="Buscar por nombre o RUT…"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
            <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {buscando && opciones.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Buscando…</div>
              ) : opciones.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  Sin resultados (solo colaboradores activos con cargo de {rol.etiqueta.toLowerCase()}).
                </div>
              ) : (
                opciones.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setElegido(o)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                      elegido?.id === o.id ? 'bg-muted font-medium' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{o.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {o.documento ?? 'sin RUT'}
                        {o.cargo ? ` · ${o.cargo}` : ''}
                      </span>
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {o.instalaciones_vigentes} inst.
                    </Badge>
                  </button>
                ))
              )}
            </div>
            {errorBusqueda && <p className={TEXTO_ERROR}>{errorBusqueda}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="resp-desde">
              Responsable desde
            </label>
            <Input id="resp-desde" className="sm:max-w-xs" type="date" max={hoyLocal()} value={desde} onChange={(e) => setDesde(e.target.value)} required />
            <p className="text-xs text-muted-foreground">
              Desde esta fecha se le cuentan las visitas. Puede ser una fecha pasada, no futura.
            </p>
          </div>

          {elegido && reemplazos > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Reemplazará al responsable actual en {reemplazos} instalación(es); el anterior queda hasta el día previo a la
              fecha elegida.
            </p>
          )}
          {elegido && yaLoTienen > 0 && (
            <p className="text-sm text-muted-foreground">{yaLoTienen} instalación(es) ya lo tienen y no cambian.</p>
          )}
          {error && <p className={TEXTO_ERROR}>{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando || !elegido}>
              {enviando ? 'Guardando…' : 'Asignar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Diálogo: quitar responsable ───────────────────────── */

function DialogLiberar({
  rol,
  instalaciones,
  onClose,
  onHecho,
}: {
  rol: Rol;
  instalaciones: Fila[];
  onClose: () => void;
  onHecho: (mensaje: string) => void;
}) {
  const [hasta, setHasta] = useState(hoyLocal());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conResponsable = instalaciones.filter((i) => !!i.responsables[rol.clave]).length;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await api.post<{ message: string }>('/responsables/liberar', {
        rol: rol.clave,
        instalacion_ids: instalaciones.map((i) => i.id),
        asignado_hasta: hasta,
      });
      onHecho(res.data.message);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo quitar el responsable.'));
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !enviando && onClose()}>
      <DialogContent style={{ maxWidth: 'min(34rem, calc(100% - 2rem))' }}>
        <form onSubmit={enviar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Quitar {rol.etiqueta.toLowerCase()}</DialogTitle>
            <DialogDescription>
              La instalación queda sin {rol.etiqueta.toLowerCase()} desde el día siguiente a la fecha de término.
            </DialogDescription>
          </DialogHeader>

          <ListaInstalaciones instalaciones={instalaciones} />

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="resp-hasta">
              Último día como responsable
            </label>
            <Input id="resp-hasta" className="sm:max-w-xs" type="date" max={hoyLocal()} value={hasta} onChange={(e) => setHasta(e.target.value)} required />
          </div>

          <p className="text-sm text-muted-foreground">
            {conResponsable === 0
              ? 'Ninguna de las instalaciones elegidas tiene responsable: no hay nada que quitar.'
              : `Se quitará en ${conResponsable} instalación(es).`}
          </p>
          {error && <p className={TEXTO_ERROR}>{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={enviando || conResponsable === 0}>
              {enviando ? 'Guardando…' : 'Quitar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Historial ───────────────────────── */

function HistorialResponsables({ recarga, isMobile }: { recarga: number; isMobile: boolean }) {
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<Pagina<Movimiento> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api
      .get<Pagina<Movimiento>>('/responsables/historial', { params: { page: pagina } })
      .then((res) => {
        if (!vigente) return;
        setDatos(res.data);
        setError(null);
      })
      .catch((e) => vigente && setError(mensajeError(e, 'No se pudo cargar el historial.')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [pagina, recarga]);

  const vigencia = (m: Movimiento) =>
    `${fechaCL(m.asignado_desde)} → ${m.asignado_hasta ? fechaCL(m.asignado_hasta) : 'vigente'}`;

  return (
    <div className="mt-3 space-y-2">
      {error && <p className={TEXTO_ERROR}>{error}</p>}
      {cargando && !datos ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !datos || datos.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
      ) : isMobile ? (
        <div className="space-y-2">
          {datos.data.map((m) => (
            <div key={m.id} className="space-y-1 rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Badge variant={m.accion === 'asignacion' ? 'outline' : 'secondary'}>{ETIQUETA_ACCION[m.accion]}</Badge>
                <span className="text-xs text-muted-foreground">{fechaHora(m.created_at)}</span>
              </div>
              <div className="font-medium">{m.instalacion?.nombre ?? '—'}</div>
              <div>
                {m.rol_etiqueta}: {m.colaborador?.nombre ?? '—'}
              </div>
              <div className="text-xs text-muted-foreground">
                {vigencia(m)} · {m.user?.name ?? 'Sistema'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuándo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Instalación</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">{fechaHora(m.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={m.accion === 'asignacion' ? 'outline' : 'secondary'}>{ETIQUETA_ACCION[m.accion]}</Badge>
                  </TableCell>
                  <TableCell>{m.instalacion?.nombre ?? '—'}</TableCell>
                  <TableCell>{m.rol_etiqueta}</TableCell>
                  <TableCell>{m.colaborador?.nombre ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{vigencia(m)}</TableCell>
                  <TableCell>{m.user?.name ?? 'Sistema'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {datos && datos.last_page > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            Página {datos.current_page} de {datos.last_page}
          </span>
          <Button size="sm" variant="outline" disabled={pagina <= 1 || cargando} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pagina >= datos.last_page || cargando}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
