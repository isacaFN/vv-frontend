import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import FiltroRangoSupervisores from './FiltroRangoSupervisores';
import { KpiVariacion, ListaPersonas, Tarjeta, nombrePropio, personasEnLinea, type Persona } from './piezasDashboard';
import {
  ATAJOS,
  SELECT_CLASE,
  TEXTO_ERROR,
  decimal1,
  decimal2,
  entero,
  errorDeRango,
  fechaCL,
  fechaCorta,
  mensajeError,
  nf1,
  type Rango,
} from './supervisoresUtil';

/* ───────────────────────── Tipos (contrato de GET /reportes/atrasos) ───────────────────────── */

type Kpis = {
  atrasos: number | null;
  horas: number | null;
  minutos_promedio: number | null;
  colaboradores: number | null;
  instalaciones: number | null;
  atrasos_por_colaborador: number | null;
};

type FilaInstalacion = {
  instalacion_id: number | null;
  nombre: string;
  cecos: string | null;
  atrasos: number;
  horas: number | null;
  minutos_promedio: number | null;
  colaboradores: number;
  supervisores: Persona[];
  administradores: Persona[];
};

type FilaColaborador = {
  colaborador_id: number;
  rut: string | null;
  nombre: string;
  instalaciones: { instalacion_id: number | null; nombre: string; atrasos: number }[];
  atrasos: number;
  horas: number | null;
  minutos_promedio: number | null;
  ultimo_atraso: string;
};

type Atraso = {
  id: number;
  colaborador_id: number;
  instalacion: string;
  fecha: string;
  turno: string | null;
  entrada_programada: string | null;
  entrada_real: string | null;
  horas_turno: number | null;
  horas_trabajadas: number | null;
  sin_hora_salida: boolean;
  horas_atraso: number | null;
  minutos_atraso: number | null;
};

type Respuesta = {
  rango: Rango;
  rango_anterior: Rango;
  cobertura: {
    desde: string | null;
    hasta: string | null;
    ultima_actualizacion: string | null;
    rango_con_datos: boolean;
    rango_completo: boolean;
    anterior_con_datos: boolean;
    anterior_completo: boolean;
  };
  instalacion_id: number | null;
  instalacion_solicitada_sin_datos: boolean;
  agrupacion: 'dia' | 'semana';
  kpis: { actual: Kpis; anterior: Kpis };
  serie: { fecha: string; hasta: string; atrasos: number | null; horas: number | null }[];
  instalaciones: FilaInstalacion[];
  colaboradores: FilaColaborador[];
  detalle: { truncado: boolean; filas: Atraso[] };
};

/* ───────────────────────── Helpers ───────────────────────── */

const SIN_SUPERVISOR = 'Sin supervisor asignado';
const SIN_ADMIN = 'Sin administrador asignado';

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** "2026-10-04 15:01" -> "04-10-2026 15:01" */
function fechaHoraCL(v: string): string {
  return `${fechaCL(v.slice(0, 10))} ${v.slice(11, 16)}`;
}

/** Ordena con los null siempre al final, sin importar el sentido. */
function ordenar<T>(filas: T[], valor: (f: T) => number | string | null, asc: boolean): T[] {
  return [...filas].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : va - (vb as number);
    return asc ? cmp : -cmp;
  });
}

function CabeceraOrden({
  texto,
  activa,
  asc,
  onClick,
  derecha = true,
}: {
  texto: string;
  activa: boolean;
  asc: boolean;
  onClick: () => void;
  derecha?: boolean;
}) {
  return (
    <TableHead className={derecha ? 'text-right' : undefined}>
      <button type="button" className={`inline-flex items-center gap-1 hover:text-foreground ${activa ? 'text-foreground' : ''}`} onClick={onClick}>
        {texto}
        {activa && (asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </TableHead>
  );
}

function CeldaBarra({ texto, valor, max, color }: { texto: string; valor: number | null; max: number; color: string }) {
  const ancho = valor !== null && max > 0 ? Math.max(2, (valor / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <p className="text-right tabular-nums">{texto}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${ancho}%`, background: color }} />
      </div>
    </div>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{t}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

/* ───────────────────────── Dashboard ───────────────────────── */

export default function AtrasosDashboard() {
  const isMobile = useIsMobile();

  const [rango, setRango] = useState<Rango>(() => ATAJOS.find((a) => a.clave === 'este-mes')!.rango());
  const [instalacionId, setInstalacionId] = useState<number | null>(null);

  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const errorRango = errorDeRango(rango);

  useEffect(() => {
    if (errorRango) return;
    let cancelado = false;
    setCargando(true);
    api
      .get<Respuesta>('/reportes/atrasos', { params: { ...rango, instalacion_id: instalacionId ?? undefined } })
      .then((res) => {
        if (cancelado) return;
        setDatos(res.data);
        setError(null);
      })
      .catch((e) => !cancelado && setError(mensajeError(e, 'No se pudo cargar el dashboard de atrasos.')))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [rango, instalacionId, errorRango]);

  // Se muestra lo que dice el servidor: si la instalación pedida no tiene atrasos, vuelve el total.
  const activa = datos?.instalacion_id ?? null;
  // Ojo: la fila "Sin instalación" tiene instalacion_id null, así que sin selección no hay que buscarla.
  const seleccionada = activa === null ? null : (datos?.instalaciones.find((i) => i.instalacion_id === activa) ?? null);

  const opciones = useMemo(
    () =>
      (datos?.instalaciones ?? [])
        .filter((i) => i.instalacion_id !== null)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [datos]
  );

  const sinAtrasos = datos !== null && datos.cobertura.rango_con_datos && (datos.kpis.actual.atrasos ?? 0) === 0;
  const sinDatosCargados = datos !== null && !datos.cobertura.rango_con_datos;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="space-y-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Atrasos</h1>
          <p className="text-sm text-muted-foreground">
            Solo atrasos vigentes del archivo de horas de colaborador. Cada cifra se compara con los {diasDelRango(rango)} días anteriores.
          </p>
        </div>

        {datos && <AvisoDatos datos={datos} />}

        <FiltroRangoSupervisores rango={rango} onChange={setRango}>
          <label className="min-w-56 flex-1 space-y-1 sm:max-w-md">
            <span className="text-xs text-muted-foreground">Instalación</span>
            <select
              className={`${SELECT_CLASE} w-full`}
              value={activa ?? ''}
              onChange={(e) => setInstalacionId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Todas las instalaciones</option>
              {opciones.map((i) => (
                <option key={i.instalacion_id} value={i.instalacion_id as number}>
                  {i.nombre} — {personasEnLinea(i.supervisores, SIN_SUPERVISOR)}
                </option>
              ))}
            </select>
          </label>
        </FiltroRangoSupervisores>
      </div>

      {error && <p className={TEXTO_ERROR}>{error}</p>}

      {datos === null && cargando && !error && <Esqueleto />}

      {datos !== null && (
        <div className={`space-y-6 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          {datos.instalacion_solicitada_sin_datos && (
            <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
              La instalación elegida no tiene atrasos en este rango, por eso se muestran todas.
            </p>
          )}

          {seleccionada ? (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3">
              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Instalación seleccionada</p>
                  <p className="text-lg font-semibold">{seleccionada.nombre}</p>
                </div>
                <ResponsablesInstalacion fila={seleccionada} completo />
              </div>
              <Button size="sm" variant="outline" onClick={() => setInstalacionId(null)}>
                <ArrowLeft className="mr-1 size-4" /> Ver todas
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-lg font-semibold">Estadísticas generales</p>
            </div>
          )}

          {sinDatosCargados ? (
            <Tarjeta titulo="Sin datos cargados">
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay datos de atrasos cargados para {fechaCL(datos.rango.desde)} → {fechaCL(datos.rango.hasta)}.
                {datos.cobertura.desde && datos.cobertura.hasta && (
                  <> Los datos disponibles van del {fechaCL(datos.cobertura.desde)} al {fechaCL(datos.cobertura.hasta)}.</>
                )}
              </p>
            </Tarjeta>
          ) : sinAtrasos ? (
            <Tarjeta titulo="Sin atrasos">
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay atrasos entre {fechaCL(datos.rango.desde)} y {fechaCL(datos.rango.hasta)}.
              </p>
            </Tarjeta>
          ) : (
            <>
              <GrillaKpis datos={datos} />

              <Tarjeta titulo={`Atrasos por ${datos.agrupacion === 'semana' ? 'semana' : 'día'}`}>
                <GraficoSerie datos={datos} isMobile={isMobile} />
              </Tarjeta>

              <TarjetaInstalaciones datos={datos} isMobile={isMobile} seleccionada={activa} onElegir={setInstalacionId} />

              <TarjetaColaboradores datos={datos} isMobile={isMobile} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function diasDelRango(r: Rango): number {
  const [a1, m1, d1] = r.desde.split('-').map(Number);
  const [a2, m2, d2] = r.hasta.split('-').map(Number);
  return Math.round((new Date(a2, m2 - 1, d2).getTime() - new Date(a1, m1 - 1, d1).getTime()) / 86_400_000) + 1;
}

function Esqueleto() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/* ───────────────────────── Aviso: de cuándo son los datos ───────────────────────── */

function AvisoDatos({ datos }: { datos: Respuesta }) {
  const c = datos.cobertura;
  const avisos: string[] = [];

  if (c.rango_con_datos && !c.rango_completo && c.desde && c.hasta) {
    avisos.push('El rango pedido se sale de las fechas con datos cargados: los días fuera de ese tramo se ven vacíos, no como cero atrasos.');
  }
  if (c.rango_con_datos && !c.anterior_completo && c.desde && c.hasta) {
    avisos.push(
      c.anterior_con_datos
        ? `El período anterior (${fechaCL(datos.rango_anterior.desde)} → ${fechaCL(datos.rango_anterior.hasta)}) tiene datos solo en parte, así que la comparación es parcial.`
        : `No hay datos cargados del período anterior (${fechaCL(datos.rango_anterior.desde)} → ${fechaCL(datos.rango_anterior.hasta)}), por eso no hay comparación.`
    );
  }

  return (
    <div className="space-y-1 rounded-lg border bg-card px-4 py-2.5 text-sm">
      <p className="flex flex-wrap gap-x-6 gap-y-1">
        <span>
          <span className="text-muted-foreground">Datos de atrasos: </span>
          <span className="font-medium">
            {c.desde && c.hasta ? `${fechaCL(c.desde)} → ${fechaCL(c.hasta)}` : 'sin datos cargados'}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">Última actualización: </span>
          <span className="font-medium">{c.ultima_actualizacion ? fechaHoraCL(c.ultima_actualizacion) : '—'}</span>
        </span>
      </p>
      {avisos.map((a) => (
        <p key={a} className="text-xs text-muted-foreground">
          {a}
        </p>
      ))}
    </div>
  );
}

/* ───────────────────────── Supervisor y administrador ───────────────────────── */

function ResponsablesInstalacion({ fila, completo = false }: { fila: FilaInstalacion; completo?: boolean }) {
  return (
    <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
      <div>
        <p className="text-xs text-muted-foreground">Supervisor</p>
        <ListaPersonas lista={fila.supervisores} vacio={SIN_SUPERVISOR} completo={completo} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Administrador de contrato</p>
        <ListaPersonas lista={fila.administradores} vacio={SIN_ADMIN} completo={completo} />
      </div>
    </div>
  );
}

/* ───────────────────────── KPIs ───────────────────────── */

function GrillaKpis({ datos }: { datos: Respuesta }) {
  const a = datos.kpis.actual;
  const p = datos.kpis.anterior;
  const filtrado = datos.instalacion_id !== null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <KpiVariacion titulo="Atrasos" actual={a.atrasos} anterior={p.atrasos} formato={entero} nota="Un atraso = un día de un colaborador" />
      <KpiVariacion titulo="Horas de atraso" actual={a.horas} anterior={p.horas} formato={decimal2} nota="Suma de horas de atraso" />
      <KpiVariacion titulo="Minutos promedio" actual={a.minutos_promedio} anterior={p.minutos_promedio} formato={decimal1} nota="Horas de atraso × 60 ÷ atrasos" />
      <KpiVariacion titulo="Colaboradores con atraso" actual={a.colaboradores} anterior={p.colaboradores} formato={entero} nota="Distintos en el rango" />
      <KpiVariacion
        titulo="Atrasos por colaborador"
        actual={a.atrasos_por_colaborador}
        anterior={p.atrasos_por_colaborador}
        formato={decimal2}
        nota="Atrasos ÷ colaboradores con atraso"
      />
      {!filtrado && (
        <KpiVariacion titulo="Instalaciones con atraso" actual={a.instalaciones} anterior={p.instalaciones} formato={entero} nota="Distintas en el rango" />
      )}
    </div>
  );
}

/* ───────────────────────── Gráfico por día / semana ───────────────────────── */

function GraficoSerie({ datos, isMobile }: { datos: Respuesta; isMobile: boolean }) {
  const [medida, setMedida] = useState<'atrasos' | 'horas'>('atrasos');

  const puntos = datos.serie.map((p) => ({
    etiqueta: fechaCorta(p.fecha),
    fecha: p.fecha,
    hasta: p.hasta,
    valor: p[medida],
  }));

  // Con muchos puntos se salta alguna etiqueta para que no se encimen.
  const saltar = puntos.length > 20 ? Math.ceil(puntos.length / (isMobile ? 6 : 14)) - 1 : 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={medida === 'atrasos' ? 'default' : 'outline'} onClick={() => setMedida('atrasos')}>
          Cantidad
        </Button>
        <Button size="sm" variant={medida === 'horas' ? 'default' : 'outline'} onClick={() => setMedida('horas')}>
          Horas
        </Button>
      </div>

      <div style={{ height: isMobile ? 200 : 240 }} className="min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={puntos} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} interval={saltar} />
            <YAxis tick={{ fontSize: 11 }} width={40} allowDecimals={medida === 'horas'} />
            <Tooltip
              formatter={(valor) => {
                const n = typeof valor === 'number' ? valor : null;
                return [n === null ? 'Sin datos cargados' : medida === 'atrasos' ? entero(n) : `${nf1.format(n)} h`, ''];
              }}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as { fecha: string; hasta: string } | undefined;
                if (!p) return '';
                return p.fecha === p.hasta ? fechaCL(p.fecha) : `${fechaCL(p.fecha)} → ${fechaCL(p.hasta)}`;
              }}
            />
            <Bar dataKey="valor" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ───────────────────────── Instalaciones ───────────────────────── */

type ClaveInst = 'nombre' | 'atrasos' | 'horas' | 'colaboradores' | 'minutos_promedio';

function TarjetaInstalaciones({
  datos,
  isMobile,
  seleccionada,
  onElegir,
}: {
  datos: Respuesta;
  isMobile: boolean;
  seleccionada: number | null;
  onElegir: (id: number | null) => void;
}) {
  const [orden, setOrden] = useState<{ clave: ClaveInst; asc: boolean }>({ clave: 'atrasos', asc: false });

  const filas = useMemo(() => ordenar(datos.instalaciones, (i) => i[orden.clave], orden.asc), [datos.instalaciones, orden]);
  const maxAtrasos = Math.max(0, ...datos.instalaciones.map((i) => i.atrasos));
  const maxHoras = Math.max(0, ...datos.instalaciones.map((i) => i.horas ?? 0));

  function cambiar(clave: ClaveInst) {
    setOrden((o) => (o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: clave === 'nombre' }));
  }
  const elegir = (i: FilaInstalacion) => {
    if (i.instalacion_id !== null) onElegir(i.instalacion_id === seleccionada ? null : i.instalacion_id);
  };
  const cab = (clave: ClaveInst, texto: string, derecha = true) => (
    <CabeceraOrden texto={texto} activa={orden.clave === clave} asc={orden.asc} onClick={() => cambiar(clave)} derecha={derecha} />
  );

  return (
    <Tarjeta titulo="Atrasos por instalación" derecha={<span className="text-xs text-muted-foreground">Toca una instalación para ver solo esa</span>}>
      {isMobile ? (
        <ul className="space-y-2">
          {filas.map((i) => (
            <li key={i.instalacion_id ?? 'sin'}>
              <button
                type="button"
                onClick={() => elegir(i)}
                className={`w-full rounded-lg border p-3 text-left ${i.instalacion_id !== null && i.instalacion_id === seleccionada ? 'border-primary' : ''}`}
              >
                <p className="font-medium">{i.nombre}</p>
                <div className="mt-1">
                  <ResponsablesInstalacion fila={i} />
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <Dato t="Atrasos" v={entero(i.atrasos)} />
                  <Dato t="Horas" v={decimal2(i.horas)} />
                  <Dato t="Min. prom." v={decimal1(i.minutos_promedio)} />
                  <Dato t="Colab." v={entero(i.colaboradores)} />
                </dl>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {cab('nombre', 'Instalación', false)}
                <TableHead>Supervisor</TableHead>
                <TableHead>Administrador de contrato</TableHead>
                {cab('atrasos', 'Atrasos')}
                {cab('horas', 'Horas')}
                {cab('minutos_promedio', 'Min. promedio')}
                {cab('colaboradores', 'Colaboradores')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((i) => (
                <TableRow
                  key={i.instalacion_id ?? 'sin'}
                  className={i.instalacion_id === null ? undefined : 'cursor-pointer'}
                  data-state={i.instalacion_id !== null && i.instalacion_id === seleccionada ? 'selected' : undefined}
                  onClick={() => elegir(i)}
                >
                  <TableCell className="min-w-48 whitespace-normal font-medium">{i.nombre}</TableCell>
                  <TableCell className="min-w-44 whitespace-normal">
                    <ListaPersonas lista={i.supervisores} vacio={SIN_SUPERVISOR} />
                  </TableCell>
                  <TableCell className="min-w-44 whitespace-normal">
                    <ListaPersonas lista={i.administradores} vacio={SIN_ADMIN} />
                  </TableCell>
                  <TableCell className="min-w-28">
                    <CeldaBarra texto={entero(i.atrasos)} valor={i.atrasos} max={maxAtrasos} color="var(--chart-1)" />
                  </TableCell>
                  <TableCell className="min-w-28">
                    <CeldaBarra texto={decimal2(i.horas)} valor={i.horas} max={maxHoras} color="var(--chart-2)" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{decimal1(i.minutos_promedio)}</TableCell>
                  <TableCell className="text-right tabular-nums">{entero(i.colaboradores)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Tarjeta>
  );
}

/* ───────────────────────── Colaboradores con atrasos ───────────────────────── */

type ClaveColab = 'nombre' | 'rut' | 'atrasos' | 'horas' | 'minutos_promedio' | 'ultimo_atraso';

function TarjetaColaboradores({ datos, isMobile }: { datos: Respuesta; isMobile: boolean }) {
  const [orden, setOrden] = useState<{ clave: ClaveColab; asc: boolean }>({ clave: 'atrasos', asc: false });
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<number | null>(null);

  const detallePorColaborador = useMemo(() => {
    const mapa = new Map<number, Atraso[]>();
    for (const f of datos.detalle.filas) {
      const lista = mapa.get(f.colaborador_id) ?? [];
      lista.push(f);
      mapa.set(f.colaborador_id, lista);
    }
    return mapa;
  }, [datos.detalle.filas]);

  const filas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const visibles = q
      ? datos.colaboradores.filter((c) => normalizar(c.nombre).includes(q) || normalizar(c.rut ?? '').includes(q))
      : datos.colaboradores;
    return ordenar(visibles, (c) => c[orden.clave], orden.asc);
  }, [datos.colaboradores, busqueda, orden]);

  function cambiar(clave: ClaveColab) {
    setOrden((o) => (o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: clave === 'nombre' || clave === 'rut' }));
  }
  const alternar = (id: number) => setAbierto((a) => (a === id ? null : id));
  const cab = (clave: ClaveColab, texto: string, derecha = true) => (
    <CabeceraOrden texto={texto} activa={orden.clave === clave} asc={orden.asc} onClick={() => cambiar(clave)} derecha={derecha} />
  );

  return (
    <Tarjeta
      titulo="Colaboradores con atrasos"
      derecha={<span className="text-xs text-muted-foreground">{filas.length} de {datos.colaboradores.length} · solo quienes tienen atrasos en el rango</span>}
    >
      <div className="mb-3 max-w-sm">
        <Input placeholder="Buscar por nombre o RUT" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {filas.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Ningún colaborador coincide con la búsqueda.</p>
      ) : isMobile ? (
        <ul className="space-y-2">
          {filas.map((c) => (
            <li key={c.colaborador_id} className="rounded-lg border">
              <button type="button" className="w-full p-3 text-left" onClick={() => alternar(c.colaborador_id)}>
                <p className="font-medium">{nombrePropio(c.nombre)}</p>
                <p className="text-xs text-muted-foreground">
                  RUT {c.rut ?? '—'} · {c.instalaciones.map((i) => i.nombre).join(' / ')}
                </p>
                <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <Dato t="Atrasos" v={entero(c.atrasos)} />
                  <Dato t="Horas" v={decimal2(c.horas)} />
                  <Dato t="Min. prom." v={decimal1(c.minutos_promedio)} />
                  <Dato t="Último" v={fechaCorta(c.ultimo_atraso)} />
                </dl>
              </button>
              {abierto === c.colaborador_id && (
                <div className="border-t p-3">
                  <DetalleAtrasos filas={detallePorColaborador.get(c.colaborador_id) ?? []} compacto />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                {cab('rut', 'RUT', false)}
                {cab('nombre', 'Nombre', false)}
                <TableHead>Instalación</TableHead>
                {cab('atrasos', 'Atrasos')}
                {cab('horas', 'Horas')}
                {cab('minutos_promedio', 'Min. promedio')}
                {cab('ultimo_atraso', 'Último atraso')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((c) => {
                const abierta = abierto === c.colaborador_id;
                return (
                  <Fragment key={c.colaborador_id}>
                    <TableRow className="cursor-pointer" data-state={abierta ? 'selected' : undefined} onClick={() => alternar(c.colaborador_id)}>
                      <TableCell className="text-muted-foreground">
                        {abierta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{c.rut ?? '—'}</TableCell>
                      <TableCell className="min-w-48 whitespace-normal font-medium">{nombrePropio(c.nombre)}</TableCell>
                      <TableCell className="min-w-44 whitespace-normal text-muted-foreground">
                        {c.instalaciones.map((i) => (
                          <p key={i.instalacion_id ?? 'sin'} className="leading-tight">
                            {i.nombre}
                            {c.instalaciones.length > 1 && <span className="ml-1 text-xs">({i.atrasos})</span>}
                          </p>
                        ))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{entero(c.atrasos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{decimal2(c.horas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{decimal1(c.minutos_promedio)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{fechaCL(c.ultimo_atraso)}</TableCell>
                    </TableRow>
                    {abierta && (
                      <TableRow>
                        <TableCell />
                        <TableCell colSpan={7} className="bg-muted/30">
                          <DetalleAtrasos filas={detallePorColaborador.get(c.colaborador_id) ?? []} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {datos.detalle.truncado && (
        <p className="mt-2 text-xs text-muted-foreground">El detalle de cada colaborador muestra solo los primeros {datos.detalle.filas.length} atrasos del rango.</p>
      )}
    </Tarjeta>
  );
}

function DetalleAtrasos({ filas, compacto = false }: { filas: Atraso[]; compacto?: boolean }) {
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">Sin detalle disponible.</p>;

  if (compacto) {
    return (
      <ul className="space-y-2 text-xs">
        {filas.map((f) => (
          <li key={f.id} className="rounded border p-2">
            <p className="font-medium">
              {fechaCL(f.fecha)} · {f.turno ?? 'Sin turno'} · {f.instalacion}
            </p>
            <p className="text-muted-foreground">
              Entrada {f.entrada_real ?? '—'} (programada {f.entrada_programada ?? '—'}) · Atraso {decimal2(f.horas_atraso)} h
              {f.minutos_atraso !== null ? ` (${entero(f.minutos_atraso)} min)` : ''}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Instalación</TableHead>
          <TableHead>Turno</TableHead>
          <TableHead className="text-right">Entrada programada</TableHead>
          <TableHead className="text-right">Entrada real</TableHead>
          <TableHead className="text-right">Horas del turno</TableHead>
          <TableHead className="text-right">Horas trabajadas</TableHead>
          <TableHead className="text-right">Atraso (h)</TableHead>
          <TableHead className="text-right">Atraso (min)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((f) => (
          <TableRow key={f.id}>
            <TableCell className="whitespace-nowrap">{fechaCL(f.fecha)}</TableCell>
            <TableCell className="whitespace-normal">{f.instalacion}</TableCell>
            <TableCell>{f.turno ?? '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{f.entrada_programada ?? '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{f.entrada_real ?? '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{decimal2(f.horas_turno)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {f.sin_hora_salida ? <span className="text-xs text-muted-foreground">Sin hora de salida</span> : decimal2(f.horas_trabajadas)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{decimal2(f.horas_atraso)}</TableCell>
            <TableCell className="text-right tabular-nums">{f.minutos_atraso === null ? '—' : entero(f.minutos_atraso)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
