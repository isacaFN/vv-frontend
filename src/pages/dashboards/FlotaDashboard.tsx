import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeft } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import FiltroRangoSupervisores from './FiltroRangoSupervisores';
import { KpiVariacion, ListaPersonas, Tarjeta, personasEnLinea, type Persona } from './piezasDashboard';
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
  pesos,
  type Rango,
} from './supervisoresUtil';

/* ───────────────────────── Tipos (contrato de GET /reportes/flota) ───────────────────────── */

type Supervisor = Persona;

type FilaMovil = {
  movil_id: number;
  placa: string;
  alias: string | null;
  activo: boolean | null;
  km: number | null;
  litros: number | null;
  gasto: number | null;
  cargas: number;
  costo_por_km: number | null;
  km_por_litro: number | null;
  precio_litro: number | null;
  supervisores: Supervisor[];
};

type Kpis = {
  moviles: number;
  km: number | null;
  litros: number | null;
  gasto: number | null;
  cargas: number;
  costo_por_km: number | null;
  km_por_litro: number | null;
  precio_litro: number | null;
};

type PuntoSerie = { fecha: string; hasta: string; km: number | null; litros: number | null; gasto: number | null; cargas: number };

type Carga = { id: number; fecha: string; litros: number | null; gasto: number | null; precio_litro: number | null; observacion: string | null };

type Respuesta = {
  rango: Rango;
  rango_anterior: Rango;
  movil_id: number | null;
  movil_solicitado_sin_datos: boolean;
  agrupacion: 'dia' | 'semana';
  kpis: { actual: Kpis; anterior: Kpis };
  serie: PuntoSerie[];
  moviles: FilaMovil[];
  cargas: { total: number; truncado: boolean; filas: Carga[] } | null;
};

type ClaveOrden = 'placa' | 'km' | 'litros' | 'gasto' | 'cargas' | 'costo_por_km' | 'km_por_litro';

/* ───────────────────────── Helpers ───────────────────────── */

const DIAS_RANGO_CORTO = 28;

const iso10 = (f: string) => f.slice(0, 10);

/** 1.250.000 -> "1,3 M"; 350.000 -> "350 mil". Para ejes de gráficos. */
function abreviarPesos(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${nf1.format(v / 1_000_000)} M`;
  if (Math.abs(v) >= 1_000) return `$${entero(v / 1_000)} mil`;
  return `$${entero(v)}`;
}

function diasDelRango(r: Rango): number {
  const [a1, m1, d1] = r.desde.split('-').map(Number);
  const [a2, m2, d2] = r.hasta.split('-').map(Number);
  return Math.round((new Date(a2, m2 - 1, d2).getTime() - new Date(a1, m1 - 1, d1).getTime()) / 86_400_000) + 1;
}

function etiquetaMovil(m: Pick<FilaMovil, 'placa' | 'alias'>): string {
  return m.alias ? `${m.placa} · ${m.alias}` : m.placa;
}

const SIN_SUPERVISOR = 'Sin supervisor asignado';

function ListaSupervisores({ lista, completo = false }: { lista: Supervisor[]; completo?: boolean }) {
  return <ListaPersonas lista={lista} vacio={SIN_SUPERVISOR} completo={completo} />;
}

/* ───────────────────────── Dashboard ───────────────────────── */

export default function FlotaDashboard() {
  const isMobile = useIsMobile();
  const arriba = useRef<HTMLDivElement>(null);

  const [rango, setRango] = useState<Rango>(() => ATAJOS.find((a) => a.clave === 'este-mes')!.rango());
  const [movilId, setMovilId] = useState<number | null>(null);

  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const errorRango = errorDeRango(rango);

  useEffect(() => {
    if (errorRango) return;
    let cancelado = false;
    setCargando(true);
    api
      .get<Respuesta>('/reportes/flota', { params: { ...rango, movil_id: movilId ?? undefined } })
      .then((res) => {
        if (cancelado) return;
        setDatos(res.data);
        setError(null);
      })
      .catch((e) => !cancelado && setError(mensajeError(e, 'No se pudo cargar el dashboard de la flota.')))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [rango, movilId, errorRango]);

  // Se muestra lo que dice el servidor: si el móvil pedido no tiene consumos, vuelve la flota completa.
  const movilActivo = datos?.movil_id ?? null;
  const seleccionado = datos?.moviles.find((m) => m.movil_id === movilActivo) ?? null;

  const opciones = useMemo(
    () => [...(datos?.moviles ?? [])].sort((a, b) => a.placa.localeCompare(b.placa, 'es')),
    [datos]
  );

  function elegirMovil(id: number | null) {
    setMovilId(id);
    arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const sinDatos = datos !== null && datos.kpis.actual.moviles === 0;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div ref={arriba} className="space-y-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Combustible y kilómetros de la flota</h1>
          <p className="text-sm text-muted-foreground">
            Se muestran los móviles con kilómetros o cargas dentro del rango, estén activos o no. Cada cifra se compara con los
            {' '}
            {diasDelRango(rango)} días anteriores.
          </p>
        </div>

        <FiltroRangoSupervisores rango={rango} onChange={setRango}>
          <label className="min-w-56 flex-1 space-y-1 sm:max-w-md">
            <span className="text-xs text-muted-foreground">Móvil</span>
            <select
              className={`${SELECT_CLASE} w-full`}
              value={movilActivo ?? ''}
              onChange={(e) => elegirMovil(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Toda la flota</option>
              {opciones.map((m) => (
                <option key={m.movil_id} value={m.movil_id}>
                  {etiquetaMovil(m)} — {personasEnLinea(m.supervisores, SIN_SUPERVISOR)}
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
          {datos.movil_solicitado_sin_datos && (
            <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
              El móvil elegido no tiene kilómetros ni cargas en este rango, por eso se muestra toda la flota.
            </p>
          )}

          {seleccionado && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Móvil seleccionado</p>
                <p className="truncate text-lg font-semibold">
                  {etiquetaMovil(seleccionado)}
                  {seleccionado.activo === false && (
                    <Badge variant="outline" className="ml-2 align-middle">
                      Inactivo
                    </Badge>
                  )}
                </p>
                <div className="mt-1 text-sm text-muted-foreground">
                  Supervisor(es):
                  <ListaSupervisores lista={seleccionado.supervisores} completo />
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => elegirMovil(null)}>
                <ArrowLeft className="mr-1 size-4" /> Ver toda la flota
              </Button>
            </div>
          )}

          {sinDatos ? (
            <Tarjeta titulo="Sin consumos">
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay kilómetros ni cargas de combustible entre {fechaCL(datos.rango.desde)} y {fechaCL(datos.rango.hasta)}.
              </p>
            </Tarjeta>
          ) : (
            <>
              <GrillaKpis datos={datos} />

              <Tarjeta titulo={`Kilómetros por ${datos.agrupacion === 'semana' ? 'semana' : 'día'}`}>
                <GraficoSerie datos={datos} campo="km" color="var(--chart-1)" unidad="km" isMobile={isMobile} />
              </Tarjeta>

              <Tarjeta titulo={`Gasto en combustible por ${datos.agrupacion === 'semana' ? 'semana' : 'día'}`}>
                <GraficoSerie datos={datos} campo="gasto" color="var(--chart-2)" unidad="$" isMobile={isMobile} />
              </Tarjeta>

              {datos.cargas && <TarjetaCargas cargas={datos.cargas} />}

              {!seleccionado && datos.moviles.length > 1 && <TarjetaCostoPorKm datos={datos} isMobile={isMobile} />}

              <TarjetaMoviles datos={datos} isMobile={isMobile} seleccionado={movilActivo} onElegir={elegirMovil} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/* ───────────────────────── KPIs ───────────────────────── */

function GrillaKpis({ datos }: { datos: Respuesta }) {
  const a = datos.kpis.actual;
  const p = datos.kpis.anterior;
  const filtrado = datos.movil_id !== null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiVariacion titulo="Gasto en combustible" actual={a.gasto} anterior={p.gasto} formato={pesos} nota="Suma de las cargas del rango" />
      <KpiVariacion titulo="Kilómetros recorridos" actual={a.km} anterior={p.km} formato={decimal1} nota="Suma de km diarios" />
      <KpiVariacion titulo="Litros cargados" actual={a.litros} anterior={p.litros} formato={decimal1} nota="Suma de litros de las cargas" />
      <KpiVariacion titulo="Costo por km" actual={a.costo_por_km} anterior={p.costo_por_km} formato={pesos} nota="Gasto total ÷ km totales" />
      <KpiVariacion titulo="Rendimiento (km/L)" actual={a.km_por_litro} anterior={p.km_por_litro} formato={decimal2} nota="Km totales ÷ litros totales" />
      <KpiVariacion titulo="Precio promedio por litro" actual={a.precio_litro} anterior={p.precio_litro} formato={pesos} nota="Gasto total ÷ litros totales" />
      <KpiVariacion titulo="Cargas de combustible" actual={a.cargas > 0 ? a.cargas : null} anterior={p.cargas > 0 ? p.cargas : null} formato={entero} />
      {!filtrado && (
        <KpiVariacion
          titulo="Móviles con consumo"
          actual={a.moviles > 0 ? a.moviles : null}
          anterior={p.moviles > 0 ? p.moviles : null}
          formato={entero}
          nota="Con km o cargas en el rango"
        />
      )}
    </div>
  );
}

/* ───────────────────────── Gráfico de serie (km o gasto) ───────────────────────── */

function GraficoSerie({
  datos,
  campo,
  color,
  unidad,
  isMobile,
}: {
  datos: Respuesta;
  campo: 'km' | 'gasto';
  color: string;
  unidad: 'km' | '$';
  isMobile: boolean;
}) {
  const puntos = datos.serie.map((p) => ({
    etiqueta: fechaCorta(p.fecha),
    fecha: p.fecha,
    hasta: p.hasta,
    valor: p[campo],
  }));

  if (!puntos.some((p) => p.valor !== null && p.valor > 0)) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {campo === 'km' ? 'Sin kilómetros registrados en el rango.' : 'Sin cargas de combustible en el rango.'}
      </p>
    );
  }

  // Con muchos puntos se salta alguna etiqueta para que no se encimen.
  const saltar = puntos.length > 20 ? Math.ceil(puntos.length / (isMobile ? 6 : 14)) - 1 : 0;

  return (
    <div style={{ height: isMobile ? 200 : 240 }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={puntos} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} interval={saltar} />
          <YAxis
            tick={{ fontSize: 11 }}
            width={60}
            tickFormatter={(v: number) => (unidad === '$' ? abreviarPesos(v) : entero(v))}
          />
          <Tooltip
            formatter={(valor) => {
              const n = typeof valor === 'number' ? valor : null;
              return [n === null ? '—' : unidad === '$' ? pesos(n) : `${nf1.format(n)} km`, ''];
            }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as { fecha: string; hasta: string } | undefined;
              if (!p) return '';
              return p.fecha === p.hasta ? fechaCL(p.fecha) : `${fechaCL(p.fecha)} → ${fechaCL(p.hasta)}`;
            }}
          />
          <Bar dataKey="valor" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────────── Cargas de un móvil ───────────────────────── */

function TarjetaCargas({ cargas }: { cargas: NonNullable<Respuesta['cargas']> }) {
  return (
    <Tarjeta titulo="Cargas de combustible" derecha={<span className="text-xs text-muted-foreground">{cargas.total} en el rango</span>}>
      {cargas.filas.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Este móvil no tiene cargas en el rango.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Litros</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">$/litro</TableHead>
                <TableHead>Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargas.filas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap">{fechaCL(iso10(c.fecha))}</TableCell>
                  <TableCell className="text-right tabular-nums">{decimal1(c.litros)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pesos(c.gasto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pesos(c.precio_litro)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.observacion || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {cargas.truncado && (
        <p className="mt-2 text-xs text-muted-foreground">Se muestran las primeras {cargas.filas.length} cargas.</p>
      )}
    </Tarjeta>
  );
}

/* ───────────────────────── Costo por km por móvil ───────────────────────── */

type PuntoMovil = { etiqueta: string; valor: number; supervisores: Supervisor[] };

function TooltipMovil({ payload }: { payload?: readonly { payload?: unknown }[] }) {
  const p = payload?.[0]?.payload as PuntoMovil | undefined;
  if (!p) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{p.etiqueta}</p>
      <div className="mt-0.5 text-muted-foreground">
        Supervisor(es):
        <ListaSupervisores lista={p.supervisores} />
      </div>
      <p className="mt-1 tabular-nums">{pesos(p.valor)} por km</p>
    </div>
  );
}

function TarjetaCostoPorKm({ datos, isMobile }: { datos: Respuesta; isMobile: boolean }) {
  const filas: PuntoMovil[] = datos.moviles
    .filter((m) => m.costo_por_km !== null)
    .sort((a, b) => (b.costo_por_km ?? 0) - (a.costo_por_km ?? 0))
    .map((m) => ({ etiqueta: etiquetaMovil(m), valor: m.costo_por_km as number, supervisores: m.supervisores }));

  const promedio = datos.kpis.actual.costo_por_km;
  const rangoCorto = diasDelRango(datos.rango) < DIAS_RANGO_CORTO;
  const conPocasCargas = datos.moviles.some((m) => m.costo_por_km !== null && m.cargas < 2);

  return (
    <Tarjeta
      titulo="Costo por km por móvil"
      derecha={promedio !== null ? <span className="text-xs text-muted-foreground">Línea: promedio de la flota {pesos(promedio)}/km</span> : undefined}
    >
      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Ningún móvil tiene a la vez km y combustible en el rango, así que no hay costo por km que calcular.
        </p>
      ) : (
        <>
          <div style={{ height: Math.max(180, filas.length * (isMobile ? 30 : 28) + 40) }} className="min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${entero(v)}`} />
                <YAxis type="category" dataKey="etiqueta" tick={{ fontSize: 11 }} width={isMobile ? 96 : 150} interval={0} />
                <Tooltip content={(p) => <TooltipMovil payload={p.payload} />} />
                {promedio !== null && <ReferenceLine x={promedio} stroke="var(--foreground)" strokeDasharray="4 3" />}
                <Bar dataKey="valor" fill="var(--chart-1)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(rangoCorto || conPocasCargas) && (
            <p className="mt-2 text-xs text-muted-foreground">
              El costo por km se calcula con las cargas del rango. Las cargas son eventos puntuales, así que en rangos cortos
              (menos de {DIAS_RANGO_CORTO} días) o con una sola carga el valor puede no reflejar el consumo real del período.
            </p>
          )}
        </>
      )}
    </Tarjeta>
  );
}

/* ───────────────────────── Tabla por móvil ───────────────────────── */

function TarjetaMoviles({
  datos,
  isMobile,
  seleccionado,
  onElegir,
}: {
  datos: Respuesta;
  isMobile: boolean;
  seleccionado: number | null;
  onElegir: (id: number | null) => void;
}) {
  const [orden, setOrden] = useState<{ clave: ClaveOrden; asc: boolean }>({ clave: 'km', asc: false });

  const filas = useMemo(() => {
    const valor = (m: FilaMovil): number | string | null => (orden.clave === 'placa' ? m.placa : m[orden.clave]);
    return [...datos.moviles].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      // Los vacíos (null) siempre al final, sin importar el sentido.
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : va - (vb as number);
      return orden.asc ? cmp : -cmp;
    });
  }, [datos.moviles, orden]);

  const maxKm = Math.max(0, ...datos.moviles.map((m) => m.km ?? 0));
  const maxGasto = Math.max(0, ...datos.moviles.map((m) => m.gasto ?? 0));

  function cambiarOrden(clave: ClaveOrden) {
    setOrden((o) => (o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: clave === 'placa' }));
  }

  const cabecera = (clave: ClaveOrden, texto: string, derecha = true) => (
    <TableHead className={derecha ? 'text-right' : undefined}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 hover:text-foreground ${orden.clave === clave ? 'text-foreground' : ''}`}
        onClick={() => cambiarOrden(clave)}
      >
        {texto}
        {orden.clave === clave && (orden.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </TableHead>
  );

  return (
    <Tarjeta titulo="Detalle por móvil" derecha={<span className="text-xs text-muted-foreground">Toca un móvil para ver solo ese</span>}>
      {filas.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Sin móviles con consumo en el rango.</p>
      ) : isMobile ? (
        <ul className="space-y-2">
          {filas.map((m) => (
            <li key={m.movil_id}>
              <button
                type="button"
                onClick={() => onElegir(m.movil_id === seleccionado ? null : m.movil_id)}
                className={`w-full rounded-lg border p-3 text-left ${m.movil_id === seleccionado ? 'border-primary' : ''}`}
              >
                <p className="font-medium">
                  {etiquetaMovil(m)}
                  {m.activo === false && <span className="ml-2 text-xs font-normal text-muted-foreground">(inactivo)</span>}
                </p>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Supervisor(es):
                  <ListaSupervisores lista={m.supervisores} />
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <Dato t="Km" v={decimal1(m.km)} />
                  <Dato t="Litros" v={decimal1(m.litros)} />
                  <Dato t="Gasto" v={pesos(m.gasto)} />
                  <Dato t="Cargas" v={String(m.cargas)} />
                  <Dato t="$/km" v={pesos(m.costo_por_km)} />
                  <Dato t="km/L" v={decimal2(m.km_por_litro)} />
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
                {cabecera('placa', 'Patente', false)}
                <TableHead>Supervisor(es)</TableHead>
                {cabecera('km', 'Km')}
                {cabecera('litros', 'Litros')}
                {cabecera('gasto', 'Gasto')}
                {cabecera('cargas', 'Cargas')}
                {cabecera('costo_por_km', '$/km')}
                {cabecera('km_por_litro', 'km/L')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((m) => (
                <TableRow
                  key={m.movil_id}
                  className="cursor-pointer"
                  data-state={m.movil_id === seleccionado ? 'selected' : undefined}
                  onClick={() => onElegir(m.movil_id === seleccionado ? null : m.movil_id)}
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {etiquetaMovil(m)}
                    {m.activo === false && <span className="ml-2 text-xs font-normal text-muted-foreground">(inactivo)</span>}
                  </TableCell>
                  <TableCell className="min-w-48 whitespace-normal"><ListaSupervisores lista={m.supervisores} /></TableCell>
                  <TableCell className="min-w-36">
                    <CeldaBarra texto={decimal1(m.km)} valor={m.km} max={maxKm} color="var(--chart-1)" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{decimal1(m.litros)}</TableCell>
                  <TableCell className="min-w-36">
                    <CeldaBarra texto={pesos(m.gasto)} valor={m.gasto} max={maxGasto} color="var(--chart-2)" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.cargas}</TableCell>
                  <TableCell className="text-right tabular-nums">{pesos(m.costo_por_km)}</TableCell>
                  <TableCell className="text-right tabular-nums">{decimal2(m.km_por_litro)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Tarjeta>
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
