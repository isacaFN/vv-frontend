import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { ChevronRight, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PERMISO_RRHH_COSTOS } from '@/config/rrhh';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';

/* ───────────────────────── Tipos ───────────────────────── */

type CostoVigente = {
  costo: number;
  vigente_desde: string; // "2026-10-01"
  registrado_por: string | null;
  registrado_at: string | null; // ISO UTC
  motivo: string | null;
} | null;

type Reglas = { costo_maximo: number; motivo_obligatorio: boolean; motivo_min: number; motivo_max: number };

type Fila = {
  id: number;
  nombre: string;
  cecos: string | null;
  cliente: string | null;
  costo: CostoVigente;
};

type Lista = {
  instalaciones: Fila[];
  resumen: { total: number; con_costo: number; sin_costo: number };
  reglas: Reglas;
  hoy: string;
};

type RegistroCosto = {
  id: number;
  costo: number;
  costo_anterior: number | null;
  vigente_desde: string;
  motivo: string;
  registrado_por: string | null;
  created_at: string | null;
  estado: 'vigente' | 'anterior' | 'corregida';
};

type Detalle = {
  fecha_inicio: string | null;
  fecha_termino: string | null;
  // Asignados en este sistema (Administración → Responsables). `nombre` null = sin asignar.
  responsables: { clave: string; rol: string; nombre: string | null; desde: string | null }[];
  costo: CostoVigente;
  historial: RegistroCosto[];
  reglas: Reglas;
  hoy: string;
};

type RespuestaCosto = { cambio: boolean; mensaje: string; costo: CostoVigente; historial: RegistroCosto[] };

/* ───────────────────────── Helpers ───────────────────────── */

const TEXTO_ERROR = 'text-sm text-red-600 dark:text-red-400';

const SELECT_CLASE =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const FORMATO_PESOS = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const pesos = (v: number | null) => (v === null ? '—' : FORMATO_PESOS.format(v));

/** "2026-10-03" -> "03-10-2026" (sin pasar por Date: evita corrimientos de zona horaria). */
function fechaCL(iso: string | null): string {
  if (!iso) return '—';
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

const ETIQUETA_ESTADO: Record<RegistroCosto['estado'], string> = {
  vigente: 'Vigente',
  anterior: 'Anterior',
  corregida: 'Corregida',
};

/* ───────────────────────── Pestaña Instalaciones ───────────────────────── */

type Orden = 'nombre' | 'costo_desc' | 'costo_asc';

export default function InstalacionesRrhh() {
  const isMobile = useIsMobile();

  const [lista, setLista] = useState<Lista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<Fila | null>(null);

  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'con' | 'sin'>('todas');
  const [orden, setOrden] = useState<Orden>('nombre');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api
      .get<Lista>('/rrhh/instalaciones')
      .then((res) => {
        if (!vigente) return;
        setLista(res.data);
        setError(null);
      })
      .catch((e) => vigente && setError(mensajeError(e, 'No se pudieron cargar las instalaciones.')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  /** Tras guardar un costo en el modal, la lista queda al día sin volver a pedirla. */
  function costoActualizado(id: number, costo: CostoVigente) {
    setLista((prev) => {
      if (!prev) return prev;
      const instalaciones = prev.instalaciones.map((i) => (i.id === id ? { ...i, costo } : i));
      const con = instalaciones.filter((i) => i.costo !== null).length;
      return { ...prev, instalaciones, resumen: { total: instalaciones.length, con_costo: con, sin_costo: instalaciones.length - con } };
    });
  }

  const filas = useMemo(() => {
    if (!lista) return [];
    const termino = normalizar(buscar.trim());
    const filtradas = lista.instalaciones.filter((i) => {
      if (filtro === 'con' && i.costo === null) return false;
      if (filtro === 'sin' && i.costo !== null) return false;
      if (!termino) return true;
      return normalizar(`${i.nombre} ${i.cecos ?? ''}`).includes(termino);
    });

    // Las sin costo van siempre al final en los órdenes por costo.
    const porNombre = (a: Fila, b: Fila) => a.nombre.localeCompare(b.nombre, 'es');
    return [...filtradas].sort((a, b) => {
      if (orden === 'nombre') return porNombre(a, b);
      if (a.costo === null && b.costo === null) return porNombre(a, b);
      if (a.costo === null) return 1;
      if (b.costo === null) return -1;
      return (orden === 'costo_desc' ? b.costo.costo - a.costo.costo : a.costo.costo - b.costo.costo) || porNombre(a, b);
    });
  }, [lista, buscar, filtro, orden]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-lg font-semibold">Instalaciones Activas</h2>
          <p className="text-sm text-muted-foreground">Haz clic en una instalación para ver su información.</p>
        </div>
        {lista && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Badge variant="outline">{lista.resumen.total} instalaciones</Badge>
            <Badge variant="outline">{lista.resumen.con_costo} con costo</Badge>
            <Badge variant="outline">{lista.resumen.sin_costo} sin costo definido</Badge>
          </div>
        )}
      </div>

      {error && <p className={TEXTO_ERROR}>{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nombre o CECOS…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <select className={SELECT_CLASE} value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="todas">Todas</option>
          <option value="con">Con costo</option>
          <option value="sin">Sin costo definido</option>
        </select>
        <select className={SELECT_CLASE} value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
          <option value="nombre">Orden: nombre</option>
          <option value="costo_desc">Orden: costo, mayor a menor</option>
          <option value="costo_asc">Orden: costo, menor a mayor</option>
        </select>
        <span className="text-sm text-muted-foreground">
          {filas.length} de {lista?.instalaciones.length ?? 0}
        </span>
      </div>

      {cargando && !lista ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No hay instalaciones con ese filtro.</p>
      ) : isMobile ? (
        <div className="space-y-2">
          {filas.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setAbierta(i)}
              className="flex w-full items-center gap-3 rounded-md border p-3 text-left hover:bg-muted/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{i.nombre}</span>
                {i.cecos && <span className="block text-xs text-muted-foreground">CECOS {i.cecos}</span>}
                <span className="mt-1 block text-sm">
                  {i.costo ? (
                    <>
                      <span className="font-medium">{pesos(i.costo.costo)}</span>
                      <span className="text-xs text-muted-foreground"> por hora</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sin costo definido</span>
                  )}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instalación</TableHead>
                <TableHead>Costo hora extra</TableHead>
                <TableHead>Último cambio por</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((i) => (
                <TableRow
                  key={i.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => setAbierta(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setAbierta(i);
                  }}
                >
                  <TableCell>
                    <div className="text-sm font-medium">{i.nombre}</div>
                    {i.cecos && <div className="text-xs text-muted-foreground">CECOS {i.cecos}</div>}
                  </TableCell>
                  <TableCell>
                    {i.costo ? (
                      <span className="font-medium">{pesos(i.costo.costo)}</span>
                    ) : (
                      <span className="text-muted-foreground">Sin costo definido</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {i.costo ? (
                      <>
                        <div className="text-sm">{i.costo.registrado_por ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{fechaHora(i.costo.registrado_at)}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {abierta && <ModalCosto fila={abierta} onClose={() => setAbierta(null)} onCosto={costoActualizado} />}
    </div>
  );
}

/* ───────────────────────── Modal: costo de una instalación ───────────────────────── */

function ModalCosto({
  fila,
  onClose,
  onCosto,
}: {
  fila: Fila;
  onClose: () => void;
  onCosto: (id: number, costo: CostoVigente) => void;
}) {
  const { tienePermiso } = useAuth();
  const puedeEditar = tienePermiso(PERMISO_RRHH_COSTOS);

  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  useEffect(() => {
    let vigente = true;
    api
      .get<Detalle>(`/rrhh/instalaciones/${fila.id}`)
      .then((res) => vigente && setDetalle(res.data))
      .catch((e) => vigente && setErrorCarga(mensajeError(e, 'No se pudo cargar el costo de la instalación.')));
    return () => {
      vigente = false;
    };
  }, [fila.id]);

  function guardado(r: RespuestaCosto) {
    setDetalle((prev) => (prev ? { ...prev, costo: r.costo, historial: r.historial } : prev));
    onCosto(fila.id, r.costo);
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent style={{ maxWidth: 'min(34rem, calc(100% - 2rem))' }}>
        <DialogHeader>
          <DialogTitle>{fila.nombre}</DialogTitle>
          <DialogDescription>
            {[fila.cecos ? `CECOS ${fila.cecos}` : null, fila.cliente].filter(Boolean).join(' · ') || 'Costo imponible hora extra'}
          </DialogDescription>
        </DialogHeader>

        {errorCarga && <p className={TEXTO_ERROR}>{errorCarga}</p>}

        {!detalle && !errorCarga && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {detalle && (
          <div className="space-y-4">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Fecha de inicio</dt>
              <dd>{fechaCL(detalle.fecha_inicio)}</dd>
              <dt className="text-muted-foreground">Fecha de término</dt>
              <dd>{fechaCL(detalle.fecha_termino)}</dd>
              {detalle.responsables.map((r) => (
                <div key={r.clave} className="contents">
                  <dt className="text-muted-foreground">{r.rol}</dt>
                  <dd>{r.nombre ?? <span className="text-muted-foreground">Sin asignar</span>}</dd>
                </div>
              ))}
            </dl>

            <FormularioCosto instalacionId={fila.id} detalle={detalle} puedeEditar={puedeEditar} onGuardado={guardado} />

            <div>
              <Button variant="ghost" size="sm" onClick={() => setVerHistorial((v) => !v)}>
                {verHistorial ? 'Ocultar historial de cambios' : `Ver historial de cambios (${detalle.historial.length})`}
              </Button>
              {verHistorial && <HistorialCostos historial={detalle.historial} />}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Valor actual + formulario ───────────────────────── */

function FormularioCosto({
  instalacionId,
  detalle,
  puedeEditar,
  onGuardado,
}: {
  instalacionId: number;
  detalle: Detalle;
  puedeEditar: boolean;
  onGuardado: (r: RespuestaCosto) => void;
}) {
  const { reglas, hoy, costo } = detalle;
  const largoMax = String(reglas.costo_maximo).length;

  const [valor, setValor] = useState('');
  const [desde, setDesde] = useState(hoy);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const numero = valor === '' ? null : Number(valor);

  /** Lo que regía en la fecha elegida según el historial cargado (solo para el texto de vista previa). */
  const regiaEseDia = useMemo(() => {
    const efectivas = new Map<string, RegistroCosto>(); // fecha -> fila de id mayor
    for (const f of detalle.historial) {
      const previa = efectivas.get(f.vigente_desde);
      if (!previa || f.id > previa.id) efectivas.set(f.vigente_desde, f);
    }
    let mejor: RegistroCosto | null = null;
    for (const [fecha, f] of efectivas) {
      if (fecha <= desde && (mejor === null || fecha > mejor.vigente_desde)) mejor = f;
    }
    return mejor;
  }, [detalle.historial, desde]);

  function validar(): string | null {
    if (numero === null) return 'Ingresa el costo.';
    if (numero < 1) return `El costo debe ser un número entero de pesos, entre 1 y ${reglas.costo_maximo.toLocaleString('es-CL')}.`;
    if (numero > reglas.costo_maximo) return `El costo no puede superar ${pesos(reglas.costo_maximo)} (máximo ${largoMax} dígitos).`;
    if (!desde) return 'Indica desde qué fecha rige el costo.';
    if (desde > hoy) return 'La fecha de vigencia no puede ser futura.';
    const m = motivo.trim();
    if (reglas.motivo_obligatorio && m === '') return 'El motivo es obligatorio.';
    if (m !== '' && m.length < reglas.motivo_min) return `El motivo debe tener al menos ${reglas.motivo_min} caracteres.`;
    return null;
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setAviso(null);
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const res = await api.put<RespuestaCosto>(`/rrhh/instalaciones/${instalacionId}/costo-hora-extra`, {
        costo: numero,
        vigente_desde: desde,
        motivo: motivo.trim(),
      });
      onGuardado(res.data);
      setAviso(res.data.mensaje);
      if (res.data.cambio) {
        setValor('');
        setMotivo('');
        setDesde(hoy);
      }
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el costo.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-medium uppercase text-muted-foreground">Costo imponible hora extra</div>
        {costo ? (
          <>
            <div className="text-2xl font-semibold">
              {pesos(costo.costo)} <span className="text-sm font-normal text-muted-foreground">por hora</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Desde {fechaCL(costo.vigente_desde)} · {costo.registrado_por ?? '—'}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Sin costo definido</div>
        )}
      </div>

      {puedeEditar && (
        <form onSubmit={enviar} className="space-y-3 border-t pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{costo ? 'Nuevo costo por hora (pesos)' : 'Costo por hora (pesos)'}</span>
              <Input
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ej: 5200"
                maxLength={largoMax}
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/\D/g, '').slice(0, largoMax))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Vigente desde</span>
              <Input type="date" max={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Motivo{reglas.motivo_obligatorio ? ' (obligatorio)' : ''}</span>
            <Input
              maxLength={reglas.motivo_max}
              placeholder="Ej: reajuste anual, corrección de valor…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>

          {numero !== null && numero > 0 && numero <= reglas.costo_maximo && desde !== '' && (
            <p className="text-xs text-muted-foreground">
              Se registrará {pesos(numero)} por hora desde {fechaCL(desde)}
              {regiaEseDia ? ` (ese día regía ${pesos(regiaEseDia.costo)}).` : ' (ese día no había costo definido).'}
              {regiaEseDia && regiaEseDia.costo === numero ? ' Es el mismo valor: no se guardará nada.' : ''}
            </p>
          )}

          {error && <p className={TEXTO_ERROR}>{error}</p>}
          {aviso && (
            <div className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              {aviso}
            </div>
          )}

          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : costo ? 'Guardar cambio' : 'Guardar costo'}
          </Button>
        </form>
      )}
    </div>
  );
}

/* ───────────────────────── Historial (compacto, plegado por defecto) ───────────────────────── */

function HistorialCostos({ historial }: { historial: RegistroCosto[] }) {
  if (historial.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">Todavía no se ha registrado ningún costo.</p>;
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Desde</TableHead>
            <TableHead>Costo</TableHead>
            <TableHead>Registrado por</TableHead>
            <TableHead>Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historial.map((h) => (
            <TableRow key={h.id}>
              <TableCell>{fechaCL(h.vigente_desde)}</TableCell>
              <TableCell>
                <div className="font-medium">{pesos(h.costo)}</div>
                {h.estado !== 'anterior' && (
                  <div className="text-xs text-muted-foreground">{ETIQUETA_ESTADO[h.estado]}</div>
                )}
              </TableCell>
              <TableCell>
                <div>{h.registrado_por ?? '—'}</div>
                <div className="text-xs text-muted-foreground">{fechaHora(h.created_at)}</div>
              </TableCell>
              <TableCell style={{ whiteSpace: 'normal', minWidth: '10rem' }}>{h.motivo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
