import { useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { formatCLP, formatFecha, formatHoras } from '@/lib/format';
import { DateRangePicker } from '@/components/dashboards/date-range-picker';
import { StatTile, DualStatTile } from '@/components/dashboards/stat-tile';
import { RankingCard } from '@/components/dashboards/ranking-card';
import { CategoryTick } from '@/components/dashboards/category-tick';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { Area, AreaChart } from 'recharts';

type FilaInstalacion = {
  instalacion_id: number | null;
  instalacion_nombre: string;
  instalacion_cecos: string | null;
  horas_totales: number;
  horas_exr: number;
  horas_tvf: number;
  horas_exr_sin_valor: number;
  gasto_total: number | null;
  gasto_exr: number | null;
  gasto_tvf: number | null;
};

type Resumen = {
  horas_totales: number;
  horas_exr: number;
  horas_tvf: number;
  horas_exr_sin_valor: number;
  gasto_total: number | null;
  gasto_exr: number | null;
  gasto_tvf: number | null;
};

type FilaDetalle = {
  fecha: string;
  horas_totales: number;
  horas_exr: number;
  horas_tvf: number;
  horas_exr_sin_valor: number;
  gasto_total: number | null;
  gasto_exr: number | null;
  gasto_tvf: number | null;
};

/** Monto en pesos; null/undefined = sin dato → "—" (no 0). */
const clp = (v: number | string | null | undefined) => (v === null || v === undefined ? '—' : formatCLP(Number(v)));

/** Horas EXR que no entran en los montos por no tener costo definido ese día. */
const sinValor = (v: { horas_exr_sin_valor: number | string } | null | undefined) => Number(v?.horas_exr_sin_valor ?? 0);

const configExr = {
  horas_exr: { label: 'Horas EXR', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const configTvf = {
  horas_tvf: { label: 'Horas TVF', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function rangoUltimosDias(dias: number): DateRange {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - (dias - 1));
  return { from: desde, to: hasta };
}

function aFechaISO(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

export default function HorasExtraInstalacionDashboard() {
  const isMobile = useIsMobile();
  const [rango, setRango] = useState<DateRange>(() => rangoUltimosDias(30));
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [filas, setFilas] = useState<FilaInstalacion[]>([]);
  const [cargando, setCargando] = useState(true);

  const [instalacionSeleccionada, setInstalacionSeleccionada] = useState<FilaInstalacion | null>(null);
  const [detalle, setDetalle] = useState<FilaDetalle[] | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => {
    if (!rango.from || !rango.to) return;
    setCargando(true);
    api
      .get('/reportes/horas-extra/instalaciones', {
        params: { desde: aFechaISO(rango.from), hasta: aFechaISO(rango.to) },
      })
      .then((res) => {
        setResumen(res.data.resumen);
        setFilas(res.data.por_instalacion);
      })
      .finally(() => setCargando(false));
  }, [rango]);

  useEffect(() => {
    if (!instalacionSeleccionada?.instalacion_id || !rango.from || !rango.to) return;
    setCargandoDetalle(true);
    setDetalle(null);
    api
      .get(`/reportes/horas-extra/instalaciones/${instalacionSeleccionada.instalacion_id}`, {
        params: { desde: aFechaISO(rango.from), hasta: aFechaISO(rango.to) },
      })
      .then((res) => setDetalle(res.data.serie))
      .finally(() => setCargandoDetalle(false));
  }, [instalacionSeleccionada, rango]);

  const topExr = useMemo(
    () => [...filas].sort((a, b) => b.horas_exr - a.horas_exr).slice(0, 12).filter((f) => f.horas_exr > 0),
    [filas]
  );
  const topTvf = useMemo(
    () => [...filas].sort((a, b) => b.horas_tvf - a.horas_tvf).slice(0, 12).filter((f) => f.horas_tvf > 0),
    [filas]
  );

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">Horas Extra por Instalación</h2>
          <p className="text-sm text-muted-foreground">
            Ranking de instalaciones en el período seleccionado
          </p>
        </div>
        <DateRangePicker value={rango} onChange={setRango} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Gasto Total (EXR + TVF)"
          value={clp(resumen?.gasto_total)}
          hero
          className="sm:col-span-1"
          valueClassName="text-red-600 dark:text-red-800"
        />
        <DualStatTile
          items={[
            { label: 'Total horas extras', value: formatHoras(resumen?.horas_exr) },
            { label: 'Costo total', value: clp(resumen?.gasto_exr) },
          ]}
        />
        <DualStatTile
          items={[
            { label: 'Total horas TVF', value: formatHoras(resumen?.horas_tvf) },
            { label: 'Total pagado', value: clp(resumen?.gasto_tvf) },
          ]}
        />
      </div>

      {sinValor(resumen) > 0 && (
        <p className="text-sm text-muted-foreground">
          {formatHoras(sinValor(resumen))} h EXR no tienen costo imponible definido en la fecha del turno (instalación sin costo o sin
          instalación): no están incluidas en los montos.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RankingCard
          titulo="Horas Extra (EXR) por Instalación"
          nota={sinValor(resumen) > 0 ? <Badge variant="outline">{formatHoras(sinValor(resumen))} h sin costo definido</Badge> : undefined}
          cargando={cargando}
          vacio={topExr.length === 0}
        >
          <ChartContainer config={configExr} style={{ height: Math.max(topExr.length * (isMobile ? 34 : 42), 120) }} className="w-full">
            <BarChart
              data={topExr}
              layout="vertical"
              margin={{ left: isMobile ? 4 : 12, right: isMobile ? 40 : 56 }}
              barSize={isMobile ? 14 : 20}
              onClick={(estado) => {
                const fila = estado?.activePayload?.[0]?.payload as FilaInstalacion | undefined;
                if (fila) setInstalacionSeleccionada(fila);
              }}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tickFormatter={formatHoras} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="instalacion_nombre"
                width={isMobile ? 96 : 170}
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={(props) => <CategoryTick {...props} isMobile={isMobile} margenIzquierdo={isMobile ? 4 : 12} />}
              />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)' }}
                content={<ChartTooltipContent formatter={(value) => formatHoras(Number(value))} labelKey="instalacion_nombre" />}
              />
              <Bar dataKey="horas_exr" fill="var(--color-horas_exr)" radius={[0, 4, 4, 0]} cursor="pointer">
                <LabelList
                  dataKey="horas_exr"
                  position="right"
                  formatter={(v: number) => formatHoras(v)}
                  className={isMobile ? 'fill-foreground text-[10px]' : 'fill-foreground text-xs'}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </RankingCard>

        <RankingCard titulo="TVF por Instalación" cargando={cargando} vacio={topTvf.length === 0}>
          <ChartContainer config={configTvf} style={{ height: Math.max(topTvf.length * (isMobile ? 34 : 42), 120) }} className="w-full">
            <BarChart
              data={topTvf}
              layout="vertical"
              margin={{ left: isMobile ? 4 : 12, right: isMobile ? 40 : 56 }}
              barSize={isMobile ? 14 : 20}
              onClick={(estado) => {
                const fila = estado?.activePayload?.[0]?.payload as FilaInstalacion | undefined;
                if (fila) setInstalacionSeleccionada(fila);
              }}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tickFormatter={formatHoras} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="instalacion_nombre"
                width={isMobile ? 96 : 170}
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={(props) => <CategoryTick {...props} isMobile={isMobile} margenIzquierdo={isMobile ? 4 : 12} />}
              />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)' }}
                content={<ChartTooltipContent formatter={(value) => formatHoras(Number(value))} labelKey="instalacion_nombre" />}
              />
              <Bar dataKey="horas_tvf" fill="var(--color-horas_tvf)" radius={[0, 4, 4, 0]} cursor="pointer">
                <LabelList
                  dataKey="horas_tvf"
                  position="right"
                  formatter={(v: number) => formatHoras(v)}
                  className={isMobile ? 'fill-foreground text-[10px]' : 'fill-foreground text-xs'}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </RankingCard>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="sm:hidden">
          <div className="flex items-center justify-between border-b px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>Instalación</span>
            <span>Gasto Total</span>
          </div>
          <div className="divide-y">
            {filas.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Sin datos en el período seleccionado.
              </p>
            ) : (
              filas.map((fila) => (
                <button
                  key={fila.instalacion_id ?? fila.instalacion_nombre}
                  type="button"
                  onClick={() => setInstalacionSeleccionada(fila)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">
                      {fila.instalacion_cecos ?? 'Sin CECOS'}
                    </p>
                    <p className="truncate text-sm font-medium">{fila.instalacion_nombre}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{clp(fila.gasto_total)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CECOS</TableHead>
                <TableHead>Instalación</TableHead>
                <TableHead className="text-right">Horas EXR</TableHead>
                <TableHead className="text-right">Horas TVF</TableHead>
                <TableHead className="text-right">Gasto EXR</TableHead>
                <TableHead className="text-right">Gasto TVF</TableHead>
                <TableHead className="text-right">Gasto Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => (
                <TableRow
                  key={fila.instalacion_id ?? fila.instalacion_nombre}
                  className="cursor-pointer"
                  onClick={() => setInstalacionSeleccionada(fila)}
                >
                  <TableCell className="text-muted-foreground tabular-nums">{fila.instalacion_cecos ?? '—'}</TableCell>
                  <TableCell>{fila.instalacion_nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatHoras(fila.horas_exr)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatHoras(fila.horas_tvf)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {clp(fila.gasto_exr)}
                    {sinValor(fila) > 0 && (
                      <span className="block text-xs text-muted-foreground">{formatHoras(sinValor(fila))} h sin costo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{clp(fila.gasto_tvf)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{clp(fila.gasto_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!instalacionSeleccionada} onOpenChange={(abierto) => !abierto && setInstalacionSeleccionada(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {instalacionSeleccionada?.instalacion_cecos ? `${instalacionSeleccionada.instalacion_cecos} — ` : ''}
              {instalacionSeleccionada?.instalacion_nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {instalacionSeleccionada && (
              <div className="grid grid-cols-3 gap-3">
                <DualStatTile
                  size="sm"
                  items={[
                    { label: 'Horas EXR', value: formatHoras(instalacionSeleccionada.horas_exr) },
                    { label: 'Gasto', value: clp(instalacionSeleccionada.gasto_exr) },
                  ]}
                />
                <DualStatTile
                  size="sm"
                  items={[
                    { label: 'Horas TVF', value: formatHoras(instalacionSeleccionada.horas_tvf) },
                    { label: 'Gasto', value: clp(instalacionSeleccionada.gasto_tvf) },
                  ]}
                />
                <StatTile
                  label="Gasto Total"
                  value={clp(instalacionSeleccionada.gasto_total)}
                  size="sm"
                  valueClassName="text-red-600 dark:text-red-800"
                />
              </div>
            )}
            {sinValor(instalacionSeleccionada) > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatHoras(sinValor(instalacionSeleccionada))} h EXR sin costo definido en la fecha del turno: no están incluidas en el gasto.
              </p>
            )}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-muted-foreground">Horas EXR por día</h4>
              {cargandoDetalle ? (
                <Skeleton className="h-40 w-full" />
              ) : detalle && detalle.length > 0 ? (
                <DetalleDiarioChart datos={detalle} dataKey="horas_exr" color="var(--chart-1)" formatter={formatHoras} />
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos para este período.</p>
              )}
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-muted-foreground">Horas TVF por día</h4>
              {cargandoDetalle ? (
                <Skeleton className="h-40 w-full" />
              ) : detalle && detalle.length > 0 ? (
                <DetalleDiarioChart datos={detalle} dataKey="horas_tvf" color="var(--chart-2)" formatter={formatHoras} />
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos para este período.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetalleDiarioChart({
  datos,
  dataKey,
  color,
  formatter,
}: {
  datos: FilaDetalle[];
  dataKey: 'horas_exr' | 'horas_tvf' | 'gasto_tvf';
  color: string;
  formatter: (v: number) => string;
}) {
  const config = { [dataKey]: { label: dataKey, color } } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-40 w-full">
      <AreaChart data={datos} margin={{ left: 0, right: 12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="fecha" tickFormatter={formatFecha} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatter} axisLine={false} tickLine={false} width={70} tick={{ fontSize: 11 }} />
        <ChartTooltip
          cursor={{ stroke: color, strokeWidth: 1 }}
          content={<ChartTooltipContent formatter={(value) => formatter(Number(value))} labelFormatter={(v) => formatFecha(String(v))} />}
        />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}
