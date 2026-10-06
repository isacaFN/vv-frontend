import { useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { aFechaISOLocal, formatEntero, formatFecha, formatPorcentaje } from '@/lib/format';
import { DateRangePicker } from '@/components/dashboards/date-range-picker';
import { StatTile, DualStatTile } from '@/components/dashboards/stat-tile';
import { RankingCard } from '@/components/dashboards/ranking-card';
import { CategoryTick } from '@/components/dashboards/category-tick';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

/* ───────────────────────── Tipos (shape de los 3 endpoints) ───────────────────────── */

type Resumen = {
  rondas_realizadas: number; // total real, sin tope
  rondas_computadas: number; // aporte con tope por instalación: es el numerador del %
  rondas_sobre_cuota: number; // realizadas - computadas (excedentes o sin cuota), no suman al %
  rondas_programadas: number;
  puntos_totales: number;
  puntos_realizados: number;
  puntos_omitidos: number;
  cumplimiento_rondas: number;
  cumplimiento_puntos: number;
};

type FilaInstalacion = {
  instalacion_id: number;
  instalacion_nombre: string;
  instalacion_cecos: string | null;
  instalacion_activa: boolean;
  tiene_cuota_configurada: boolean;
  rondas_realizadas: number;
  rondas_programadas: number;
  rondas_computadas: number; // min(realizadas, programadas): lo que aporta al global
  puntos_totales: number;
  puntos_realizados: number;
  puntos_omitidos: number;
  cumplimiento_rondas: number | null; // null = sin cuota / inactiva → nunca mostrar "0%"
  cumplimiento_puntos: number | null;
};

type DiaSerie = { fecha: string; rondas_realizadas: number; rondas_programadas: number };

type TopGuardia = {
  colaborador_id: number | null;
  nombre_usuario_ronda: string;
  cargo_usuario_ronda: string | null;
  rondas_realizadas: number | string;
};

type RespuestaIndex = {
  resumen: Resumen;
  por_instalacion: FilaInstalacion[];
  serie_diaria: DiaSerie[];
  top_guardias: TopGuardia[];
  instalaciones_criticas: FilaInstalacion[];
  umbral_critico: number;
};

type Guardia = {
  colaborador_id: number | null;
  nombre: string;
  cargo: string | null;
  rondas_realizadas: number;
  puntos_totales: number;
  puntos_realizados: number;
  puntos_omitidos: number;
  cumplimiento_puntos: number | null;
};

type RespuestaDetalle = {
  instalacion: { id: number; nombre: string; cecos: string | null; activa: boolean };
  resumen: Omit<Resumen, 'cumplimiento_rondas' | 'cumplimiento_puntos' | 'rondas_computadas' | 'rondas_sobre_cuota'>;
  guardias: Guardia[];
};

type Seleccion = { id: number; nombre: string; cecos: string | null };

type FilaGrafico = {
  instalacion_id: number;
  nombre: string;
  cecos: string | null;
  valor: number; // valor real (puede superar 100)
  barra: number; // valor topado en 100 para dibujar la barra
  critica: boolean;
};

const configSerie = {
  rondas_realizadas: { label: 'Rondas realizadas', color: 'var(--chart-1)' },
  rondas_programadas: { label: 'Rondas programadas', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const configGuardias = {
  rondas: { label: 'Rondas', color: 'var(--chart-3)' },
} satisfies ChartConfig;

// El import de rondas es semanal → rango inicial de 7 días.
function rangoUltimosDias(dias: number): DateRange {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - (dias - 1));
  return { from: desde, to: hasta };
}

function armarSerie(
  filas: FilaInstalacion[],
  campo: 'cumplimiento_rondas' | 'cumplimiento_puntos',
  umbral: number
): FilaGrafico[] {
  return filas
    .filter((f) => f[campo] !== null)
    .map((f) => {
      const valor = Number(f[campo]);
      return {
        instalacion_id: f.instalacion_id,
        nombre: f.instalacion_nombre,
        cecos: f.instalacion_cecos,
        valor,
        barra: Math.min(valor, 100),
        critica: valor < umbral,
      };
    })
    .sort((a, b) => a.valor - b.valor); // peores primero
}

/* ───────────────────────── Dashboard ───────────────────────── */

export default function RondasDashboard() {
  const isMobile = useIsMobile();
  const [rango, setRango] = useState<DateRange>(() => rangoUltimosDias(7));
  const [datos, setDatos] = useState<RespuestaIndex | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);

  useEffect(() => {
    if (!rango.from || !rango.to) return;
    setCargando(true);
    api
      .get<RespuestaIndex>('/reportes/rondas', {
        params: { desde: aFechaISOLocal(rango.from), hasta: aFechaISOLocal(rango.to) },
      })
      .then((res) => setDatos(res.data))
      .finally(() => setCargando(false));
  }, [rango]);

  const umbral = datos?.umbral_critico ?? 70;
  const resumen = datos?.resumen;

  const serieRondas = useMemo(
    () => armarSerie(datos?.por_instalacion ?? [], 'cumplimiento_rondas', umbral),
    [datos, umbral]
  );
  const seriePuntos = useMemo(
    () => armarSerie(datos?.por_instalacion ?? [], 'cumplimiento_puntos', umbral),
    [datos, umbral]
  );
  const sinCuota = useMemo(
    () => (datos?.por_instalacion ?? []).filter((f) => f.instalacion_activa && !f.tiene_cuota_configurada).length,
    [datos]
  );
  const topGuardias = useMemo(
    () =>
      (datos?.top_guardias ?? []).map((g) => ({
        nombre: g.nombre_usuario_ronda,
        rondas: Number(g.rondas_realizadas),
      })),
    [datos]
  );

  // Instalaciones que realizaron al menos una ronda en el período, las más activas primero.
  const conRondas = useMemo(
    () =>
      (datos?.por_instalacion ?? [])
        .filter((f) => f.rondas_realizadas > 0)
        .sort((a, b) => b.rondas_realizadas - a.rondas_realizadas),
    [datos]
  );

  const abrirInstalacion = (s: Seleccion) => setSeleccion(s);
  const alturaScroll = isMobile ? 420 : 520;
  const alturaListas = isMobile ? 360 : 460;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">Rondas</h2>
          <p className="text-sm text-muted-foreground">
            Cumplimiento por instalación · en rojo, bajo {umbral}%
          </p>
        </div>
        <DateRangePicker value={rango} onChange={setRango} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelResumen
          etiqueta="% Cumplimiento Rondas"
          valor={formatPorcentaje(resumen?.cumplimiento_rondas)}
          detalles={[
            { label: 'Computadas', value: formatEntero(resumen?.rondas_computadas) },
            { label: 'Programadas', value: formatEntero(resumen?.rondas_programadas) },
            { label: 'Sobre cuota', value: formatEntero(resumen?.rondas_sobre_cuota), className: 'text-muted-foreground' },
          ]}
        />
        <PanelResumen
          etiqueta="% Cumplimiento Puntos"
          valor={formatPorcentaje(resumen?.cumplimiento_puntos)}
          detalles={[
            { label: 'Totales', value: formatEntero(resumen?.puntos_totales) },
            { label: 'Realizados', value: formatEntero(resumen?.puntos_realizados) },
            { label: 'Omitidos', value: formatEntero(resumen?.puntos_omitidos), className: 'text-red-600 dark:text-red-800' },
          ]}
        />
      </div>

      <p className="-mt-3 text-xs text-muted-foreground">
        Cumplimiento de rondas = rondas computadas ÷ programadas. Cada instalación suma como máximo su cuota; las rondas
        hechas de más (o en instalaciones sin cuota) se muestran aparte y no suben el porcentaje. Total real de rondas
        realizadas: {formatEntero(resumen?.rondas_realizadas)}.
      </p>

      {/* Los dos gráficos pedidos: % cumplimiento de puntos y % cumplimiento de rondas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RankingCard
          titulo="% Cumplimiento de Puntos por instalación"
          cargando={cargando}
          vacio={seriePuntos.length === 0}
          alturaMaxima={alturaScroll}
        >
          <GraficoCumplimiento datos={seriePuntos} color="var(--chart-1)" isMobile={isMobile} onSelect={abrirInstalacion} />
        </RankingCard>

        <RankingCard
          titulo="% Cumplimiento de Rondas por instalación"
          nota={sinCuota > 0 ? <Badge variant="outline">{sinCuota} sin cuota</Badge> : undefined}
          cargando={cargando}
          vacio={serieRondas.length === 0}
          alturaMaxima={alturaScroll}
        >
          <GraficoCumplimiento datos={serieRondas} color="var(--chart-2)" isMobile={isMobile} onSelect={abrirInstalacion} />
        </RankingCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankingCard
          titulo="Rondas realizadas vs programadas por día"
          cargando={cargando}
          vacio={(datos?.serie_diaria.length ?? 0) === 0}
        >
          <ChartContainer config={configSerie} className="h-64 w-full">
            <LineChart data={datos?.serie_diaria ?? []} margin={{ left: 0, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="fecha" tickFormatter={formatFecha} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis axisLine={false} tickLine={false} width={40} tickFormatter={formatEntero} />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(v) => formatFecha(String(v))} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                dataKey="rondas_realizadas"
                type="monotone"
                stroke="var(--color-rondas_realizadas)"
                strokeWidth={2}
                dot={(datos?.serie_diaria.length ?? 0) <= 14}
              />
              <Line
                dataKey="rondas_programadas"
                type="monotone"
                stroke="var(--color-rondas_programadas)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </RankingCard>

        <RankingCard titulo="Top 10 — Guardias con más rondas" cargando={cargando} vacio={topGuardias.length === 0}>
          <ChartContainer
            config={configGuardias}
            style={{ height: Math.max(topGuardias.length * (isMobile ? 34 : 42), 120) }}
            className="w-full"
          >
            <BarChart
              data={topGuardias}
              layout="vertical"
              margin={{ left: isMobile ? 4 : 12, right: isMobile ? 40 : 56 }}
              barSize={isMobile ? 14 : 20}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tickFormatter={formatEntero} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="nombre"
                width={isMobile ? 96 : 170}
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={(props) => <CategoryTick {...props} isMobile={isMobile} margenIzquierdo={isMobile ? 4 : 12} />}
              />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)' }}
                content={<ChartTooltipContent formatter={(v) => formatEntero(Number(v))} labelKey="nombre" />}
              />
              <Bar dataKey="rondas" fill="var(--color-rondas)" radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="rondas"
                  position="right"
                  formatter={(v: number) => formatEntero(v)}
                  className={isMobile ? 'fill-foreground text-[10px]' : 'fill-foreground text-xs'}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </RankingCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelInstalaciones
          titulo="Instalaciones con rondas"
          modo="rondas"
          filas={conRondas}
          umbral={umbral}
          rango={rango}
          cargando={cargando}
          alturaMaxima={alturaListas}
          vacioTexto="Sin rondas en el período seleccionado."
        />
        <PanelInstalaciones
          titulo="Instalaciones críticas"
          modo="criticas"
          filas={datos?.instalaciones_criticas ?? []}
          umbral={umbral}
          rango={rango}
          cargando={cargando}
          alturaMaxima={alturaListas}
          vacioTexto="Sin instalaciones críticas en el período."
        />
      </div>

      <DetalleInstalacionDialog
        seleccion={seleccion}
        rango={rango}
        onClose={() => setSeleccion(null)}
      />
    </div>
  );
}

/* ───────────────────────── Panel resumen: % grande + 3 datos secundarios en una fila ───────────────────────── */

function PanelResumen({
  etiqueta,
  valor,
  detalles,
}: {
  etiqueta: string;
  valor: string;
  detalles: { label: string; value: string; className?: string }[];
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <p className="text-sm font-medium text-muted-foreground">{etiqueta}</p>
          <p className="mt-1 font-heading text-4xl font-semibold leading-none text-primary">{valor}</p>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-3 border-t pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          {detalles.map((d) => (
            <div key={d.label} className="min-w-0">
              <p className="truncate text-xs font-medium text-muted-foreground">{d.label}</p>
              <p className={`mt-0.5 font-heading text-lg font-semibold tabular-nums ${d.className ?? ''}`}>{d.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Panel de instalaciones: lista ↔ detalle (se usa 2 veces) ───────────────────────── */

// Una tarjeta con una lista de instalaciones. Al hacer clic en una, la lista se reemplaza
// por su detalle (tarjetas de porcentajes + colaboradores) con un botón "Volver".
// Se reutiliza para "Instalaciones con rondas" y para "Instalaciones críticas".
function PanelInstalaciones({
  titulo,
  modo,
  filas,
  umbral,
  rango,
  cargando,
  alturaMaxima,
  vacioTexto,
}: {
  titulo: string;
  modo: 'rondas' | 'criticas';
  filas: FilaInstalacion[];
  umbral: number;
  rango: DateRange;
  cargando: boolean;
  alturaMaxima: number;
  vacioTexto: string;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [seleccionId, setSeleccionId] = useState<number | null>(null);
  const [guardias, setGuardias] = useState<Guardia[] | null>(null);
  const [cargandoGuardias, setCargandoGuardias] = useState(false);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (f) => f.instalacion_nombre.toLowerCase().includes(q) || (f.instalacion_cecos ?? '').toLowerCase().includes(q)
    );
  }, [filas, busqueda]);

  // La fila se busca en los datos vigentes: si cambia el rango, las tarjetas se refrescan solas.
  const fila = seleccionId !== null ? (filas.find((f) => f.instalacion_id === seleccionId) ?? null) : null;

  // Si la instalación seleccionada ya no está en la lista del nuevo período, se vuelve a la lista.
  useEffect(() => {
    if (seleccionId !== null && !cargando && !fila) setSeleccionId(null);
  }, [seleccionId, cargando, fila]);

  useEffect(() => {
    if (seleccionId === null || !rango.from || !rango.to) return;
    let cancelado = false;
    setCargandoGuardias(true);
    setGuardias(null);
    api
      .get<RespuestaDetalle>(`/reportes/rondas/instalaciones/${seleccionId}`, {
        params: { desde: aFechaISOLocal(rango.from), hasta: aFechaISOLocal(rango.to) },
      })
      .then((res) => {
        if (!cancelado) setGuardias(res.data.guardias);
      })
      .finally(() => {
        if (!cancelado) setCargandoGuardias(false);
      });
    return () => {
      cancelado = true; // evita que una respuesta tardía pise a la instalación elegida después
    };
  }, [seleccionId, rango]);

  const maxRondas = Math.max(1, ...(guardias ?? []).map((g) => g.rondas_realizadas));
  const sobreCuota = fila ? fila.rondas_realizadas - fila.rondas_computadas : 0;

  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      {fila ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 shrink-0" onClick={() => setSeleccionId(null)}>
              <ArrowLeft className="size-4" />
              Volver
            </Button>
            <div className="min-w-0">
              <h3 className="truncate font-heading text-sm font-semibold">{fila.instalacion_nombre}</h3>
              <p className="text-xs text-muted-foreground">
                {fila.instalacion_cecos ?? 'Sin CECOS'}
                {!fila.instalacion_activa && ' · inactiva'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              size="sm"
              className="min-w-0"
              label="% Rondas"
              value={fila.cumplimiento_rondas === null ? 'Sin cuota' : formatPorcentaje(fila.cumplimiento_rondas)}
              valueClassName={
                fila.cumplimiento_rondas !== null && fila.cumplimiento_rondas < umbral
                  ? 'text-red-600 dark:text-red-800'
                  : undefined
              }
            />
            <StatTile
              size="sm"
              className="min-w-0"
              label="% Puntos"
              value={formatPorcentaje(fila.cumplimiento_puntos)}
              valueClassName="text-primary"
            />
            <DualStatTile
              size="sm"
              className="min-w-0"
              items={[
                { label: 'Realizadas', value: formatEntero(fila.rondas_realizadas) },
                { label: 'Programadas', value: formatEntero(fila.rondas_programadas) },
              ]}
            />
            <StatTile
              size="sm"
              className="min-w-0"
              label="Puntos omitidos"
              value={formatEntero(fila.puntos_omitidos)}
              valueClassName="text-red-600 dark:text-red-800"
            />
          </div>

          {sobreCuota > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatEntero(sobreCuota)} rondas {fila.rondas_programadas > 0 ? 'sobre su cuota' : 'sin cuota exigida'}{' '}
              (no suman al cumplimiento global).
            </p>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Colaboradores y rondas realizadas</h4>
            {cargandoGuardias || !guardias ? (
              <Skeleton className="h-40 w-full" />
            ) : guardias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin rondas en este período.</p>
            ) : (
              <div className="divide-y overflow-y-auto rounded-md border" style={{ maxHeight: Math.max(alturaMaxima - 200, 220) }}>
                {guardias.map((g) => (
                  <div key={g.colaborador_id ?? `sm-${g.nombre}`} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{g.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {g.cargo ?? 'Sin cargo'}
                          {g.colaborador_id === null && ' · sin match en RRHH'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatEntero(g.rondas_realizadas)} rondas</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {formatPorcentaje(g.cumplimiento_puntos)} puntos
                        </p>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(g.rondas_realizadas / maxRondas) * 100}%`, backgroundColor: 'var(--chart-3)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-sm font-semibold text-muted-foreground">{titulo}</h3>
            <Badge variant="outline">{modo === 'criticas' ? `${filas.length} bajo ${umbral}%` : filas.length}</Badge>
          </div>

          {cargando ? (
            <Skeleton className="h-64 w-full" />
          ) : filas.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{vacioTexto}</p>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar instalación o CECOS..."
                  className="pl-8"
                />
              </div>
              {visibles.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados para tu búsqueda.</p>
              ) : (
                <div className="divide-y overflow-y-auto overflow-x-hidden pr-1" style={{ maxHeight: alturaMaxima - 40 }}>
                  {visibles.map((f) => (
                    <button
                      key={f.instalacion_id}
                      type="button"
                      onClick={() => setSeleccionId(f.instalacion_id)}
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{f.instalacion_nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">{f.instalacion_cecos ?? 'Sin CECOS'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {modo === 'criticas'
                            ? `${formatEntero(f.rondas_realizadas)} de ${formatEntero(f.rondas_programadas)} rondas`
                            : `${formatEntero(f.rondas_realizadas)} rondas`}
                        </p>
                        <p
                          className={
                            f.cumplimiento_rondas !== null && f.cumplimiento_rondas < umbral
                              ? 'text-xs tabular-nums text-red-600 dark:text-red-800'
                              : 'text-xs tabular-nums text-muted-foreground'
                          }
                        >
                          {f.cumplimiento_rondas === null ? 'Sin cuota' : formatPorcentaje(f.cumplimiento_rondas)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Gráfico de barras de cumplimiento (reutilizado x2) ───────────────────────── */

function GraficoCumplimiento({
  datos,
  color,
  isMobile,
  onSelect,
}: {
  datos: FilaGrafico[];
  color: string;
  isMobile: boolean;
  onSelect: (s: Seleccion) => void;
}) {
  const config = { barra: { label: 'Cumplimiento', color } } satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      style={{ height: Math.max(datos.length * (isMobile ? 34 : 42), 120) }}
      className="w-full"
    >
      <BarChart
        data={datos}
        layout="vertical"
        margin={{ left: isMobile ? 4 : 12, right: isMobile ? 52 : 64 }}
        barSize={isMobile ? 14 : 20}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v) => `${v}%`}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="nombre"
          width={isMobile ? 96 : 170}
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={(props) => <CategoryTick {...props} isMobile={isMobile} margenIzquierdo={isMobile ? 4 : 12} />}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          content={
            <ChartTooltipContent
              labelKey="nombre"
              formatter={(_valor, _nombre, item) => formatPorcentaje((item.payload as FilaGrafico).valor)}
            />
          }
        />
        {/* El clic va en la barra (no en el BarChart): Recharts 3 ya no entrega activePayload en el onClick del gráfico */}
        <Bar
          dataKey="barra"
          radius={[0, 4, 4, 0]}
          cursor="pointer"
          onClick={(barra) => {
            const fila = ((barra as { payload?: FilaGrafico }).payload ?? barra) as FilaGrafico;
            if (fila?.instalacion_id != null) onSelect({ id: fila.instalacion_id, nombre: fila.nombre, cecos: fila.cecos });
          }}
        >
          {datos.map((fila) => (
            <Cell key={fila.instalacion_id} fill={fila.critica ? 'var(--destructive)' : 'var(--color-barra)'} />
          ))}
          {/* La etiqueta muestra el valor real aunque la barra esté topada en 100 */}
          <LabelList
            dataKey="valor"
            position="right"
            formatter={(v: number) => formatPorcentaje(v)}
            className={isMobile ? 'fill-foreground text-[10px]' : 'fill-foreground text-xs'}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/* ───────────────────────── Modal de detalle por instalación (solo consulta) ───────────────────────── */

function DetalleInstalacionDialog({
  seleccion,
  rango,
  onClose,
}: {
  seleccion: Seleccion | null;
  rango: DateRange;
  onClose: () => void;
}) {
  const [detalle, setDetalle] = useState<RespuestaDetalle | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!seleccion || !rango.from || !rango.to) return;
    let cancelado = false;
    setCargando(true);
    setDetalle(null);
    api
      .get<RespuestaDetalle>(`/reportes/rondas/instalaciones/${seleccion.id}`, {
        params: { desde: aFechaISOLocal(rango.from), hasta: aFechaISOLocal(rango.to) },
      })
      .then((res) => {
        if (!cancelado) setDetalle(res.data);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [seleccion, rango]);

  const r = detalle?.resumen;
  const cumplRondas = r && r.rondas_programadas > 0 ? (r.rondas_realizadas / r.rondas_programadas) * 100 : null;
  const cumplPuntos = r && r.puntos_totales > 0 ? (r.puntos_realizados / r.puntos_totales) * 100 : null;

  return (
    <Dialog open={!!seleccion} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {seleccion?.cecos ? `${seleccion.cecos} — ` : ''}
            {seleccion?.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 overflow-x-hidden">
          {cargando || !detalle ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatTile
                  size="sm"
                  className="min-w-0"
                  label="% Rondas"
                  value={cumplRondas === null ? 'Sin cuota' : formatPorcentaje(cumplRondas)}
                />
                <StatTile size="sm" className="min-w-0" label="% Puntos" value={formatPorcentaje(cumplPuntos)} />
                <DualStatTile
                  size="sm"
                  className="min-w-0"
                  items={[
                    { label: 'Realizadas', value: formatEntero(r?.rondas_realizadas) },
                    { label: 'Programadas', value: formatEntero(r?.rondas_programadas) },
                  ]}
                />
              </div>

              {!detalle.instalacion.activa && (
                <p className="text-xs text-muted-foreground">
                  Instalación inactiva: no se exige cuota, solo se muestra su actividad histórica.
                </p>
              )}

              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Guardias</h4>
                {detalle.guardias.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin rondas en este período.</p>
                ) : (
                  <div className="divide-y rounded-md border">
                    {detalle.guardias.map((g) => (
                      <div
                        key={g.colaborador_id ?? `sm-${g.nombre}`}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">{g.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {g.cargo ?? 'Sin cargo'}
                            {g.colaborador_id === null && ' · sin match en RRHH'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">{formatEntero(g.rondas_realizadas)} rondas</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatPorcentaje(g.cumplimiento_puntos)} puntos
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
