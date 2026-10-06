import { useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { Search, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCLP, formatHoras } from '@/lib/format';
import { DateRangePicker } from '@/components/dashboards/date-range-picker';
import { StatTile, DualStatTile } from '@/components/dashboards/stat-tile';
import { RankingCard } from '@/components/dashboards/ranking-card';
import { CategoryTick } from '@/components/dashboards/category-tick';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type FilaColaborador = {
  colaborador_id: number;
  colaborador_documento: string;
  colaborador_nombre: string;
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

type FilaDetalleRaw = {
  instalacion_id: number | null;
  tipo: 'EXR' | 'TVF';
  fecha: string;
  horas: string | number;
  valor_total: string | number | null; // null = turno EXR sin costo definido ese día
  instalacion_nombre: string;
  instalacion_cecos: string | null;
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

const TAMANO_PAGINA = 20;

function rangoUltimosDias(dias: number): DateRange {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - (dias - 1));
  return { from: desde, to: hasta };
}

function aFechaISO(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

export default function HorasExtraColaboradorDashboard() {
  const isMobile = useIsMobile();
  const [rango, setRango] = useState<DateRange>(() => rangoUltimosDias(30));
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [filas, setFilas] = useState<FilaColaborador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [cantidadVisible, setCantidadVisible] = useState(TAMANO_PAGINA);

  const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState<FilaColaborador | null>(null);
  const [detalle, setDetalle] = useState<FilaDetalleRaw[] | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => {
    if (!rango.from || !rango.to) return;
    setCargando(true);
    api
      .get('/reportes/horas-extra/colaboradores', {
        params: { desde: aFechaISO(rango.from), hasta: aFechaISO(rango.to) },
      })
      .then((res) => {
        setResumen(res.data.resumen);
        setFilas(res.data.por_colaborador);
      })
      .finally(() => setCargando(false));
  }, [rango]);

  useEffect(() => {
    if (!colaboradorSeleccionado || !rango.from || !rango.to) return;
    setCargandoDetalle(true);
    setDetalle(null);
    api
      .get(`/reportes/horas-extra/colaboradores/${colaboradorSeleccionado.colaborador_id}`, {
        params: { desde: aFechaISO(rango.from), hasta: aFechaISO(rango.to) },
      })
      .then((res) => setDetalle(res.data.filas))
      .finally(() => setCargandoDetalle(false));
  }, [colaboradorSeleccionado, rango]);

  useEffect(() => {
    setCantidadVisible(TAMANO_PAGINA);
  }, [busqueda, rango]);

  const topExr = useMemo(
    () => [...filas].sort((a, b) => b.horas_exr - a.horas_exr).slice(0, 10).filter((f) => f.horas_exr > 0),
    [filas]
  );
  const topTvf = useMemo(
    () => [...filas].sort((a, b) => b.horas_tvf - a.horas_tvf).slice(0, 10).filter((f) => f.horas_tvf > 0),
    [filas]
  );

  const destacado = useMemo(
    () => (filas.length ? [...filas].sort((a, b) => b.horas_totales - a.horas_totales)[0] : null),
    [filas]
  );

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (f) => f.colaborador_nombre.toLowerCase().includes(q) || f.colaborador_documento.toLowerCase().includes(q)
    );
  }, [filas, busqueda]);

  const filasVisibles = useMemo(() => filasFiltradas.slice(0, cantidadVisible), [filasFiltradas, cantidadVisible]);
  const hayMas = cantidadVisible < filasFiltradas.length;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">Horas Extra por Colaborador</h2>
          <p className="text-sm text-muted-foreground">
            Ranking de colaboradores en el período seleccionado
          </p>
        </div>
        <DateRangePicker value={rango} onChange={setRango} />
      </div>

      {destacado && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Colaborador con más horas extras
            </p>
            <p className="mt-1 truncate text-sm font-semibold">{destacado.colaborador_nombre}</p>
            <p className="text-xs text-muted-foreground">RUT {destacado.colaborador_documento}</p>
          </div>
          <p className="shrink-0 font-heading text-lg font-bold tabular-nums">{formatHoras(destacado.horas_totales)} h</p>
        </div>
      )}

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
          titulo="Top 10 — Horas Extra (EXR)"
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
                const fila = estado?.activePayload?.[0]?.payload as FilaColaborador | undefined;
                if (fila) setColaboradorSeleccionado(fila);
              }}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tickFormatter={formatHoras} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="colaborador_nombre"
                width={isMobile ? 96 : 170}
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={(props) => <CategoryTick {...props} isMobile={isMobile} margenIzquierdo={isMobile ? 4 : 12} />}
              />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)' }}
                content={<ChartTooltipContent formatter={(value) => formatHoras(Number(value))} labelKey="colaborador_nombre" />}
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

        <RankingCard titulo="Top 10 — Horas TVF" cargando={cargando} vacio={topTvf.length === 0}>
          <ChartContainer config={configTvf} style={{ height: Math.max(topTvf.length * (isMobile ? 34 : 42), 120) }} className="w-full">
            <BarChart
              data={topTvf}
              layout="vertical"
              margin={{ left: isMobile ? 4 : 12, right: isMobile ? 40 : 56 }}
              barSize={isMobile ? 14 : 20}
              onClick={(estado) => {
                const fila = estado?.activePayload?.[0]?.payload as FilaColaborador | undefined;
                if (fila) setColaboradorSeleccionado(fila);
              }}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tickFormatter={formatHoras} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="colaborador_nombre"
                width={isMobile ? 96 : 170}
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={(props) => <CategoryTick {...props} isMobile={isMobile} margenIzquierdo={isMobile ? 4 : 12} />}
              />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)' }}
                content={<ChartTooltipContent formatter={(value) => formatHoras(Number(value))} labelKey="colaborador_nombre" />}
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
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o RUT..."
              className="pl-8"
            />
          </div>
        </div>

        <div className="sm:hidden">
          <div className="flex items-center justify-between border-b px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>Colaborador</span>
            <span>Gasto Total</span>
          </div>
          <div className="divide-y">
            {filasVisibles.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {busqueda ? 'Sin resultados para tu búsqueda.' : 'Sin datos en el período seleccionado.'}
              </p>
            ) : (
              filasVisibles.map((fila) => (
                <button
                  key={fila.colaborador_id}
                  type="button"
                  onClick={() => setColaboradorSeleccionado(fila)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{fila.colaborador_documento}</p>
                    <p className="truncate text-sm font-medium">{fila.colaborador_nombre}</p>
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
                <TableHead>RUT</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-right">Horas EXR</TableHead>
                <TableHead className="text-right">Horas TVF</TableHead>
                <TableHead className="text-right">Gasto EXR</TableHead>
                <TableHead className="text-right">Gasto TVF</TableHead>
                <TableHead className="text-right">Gasto Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasVisibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    {busqueda ? 'Sin resultados para tu búsqueda.' : 'Sin datos en el período seleccionado.'}
                  </TableCell>
                </TableRow>
              ) : (
                filasVisibles.map((fila) => (
                  <TableRow
                    key={fila.colaborador_id}
                    className="cursor-pointer"
                    onClick={() => setColaboradorSeleccionado(fila)}
                  >
                    <TableCell className="text-muted-foreground tabular-nums">{fila.colaborador_documento}</TableCell>
                    <TableCell>{fila.colaborador_nombre}</TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {hayMas && (
          <div className="border-t p-3 text-center">
            <Button variant="outline" size="sm" onClick={() => setCantidadVisible((n) => n + TAMANO_PAGINA)}>
              Cargar más ({filasFiltradas.length - cantidadVisible} restantes)
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!colaboradorSeleccionado} onOpenChange={(abierto) => !abierto && setColaboradorSeleccionado(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {colaboradorSeleccionado?.colaborador_documento} — {colaboradorSeleccionado?.colaborador_nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 overflow-x-hidden">
            {colaboradorSeleccionado && (
              <div className="grid grid-cols-3 gap-3">
                <DualStatTile
                  size="sm"
                  className="min-w-0"
                  items={[
                    { label: 'Horas EXR', value: formatHoras(colaboradorSeleccionado.horas_exr) },
                    { label: 'Gasto', value: clp(colaboradorSeleccionado.gasto_exr) },
                  ]}
                />
                <DualStatTile
                  size="sm"
                  className="min-w-0"
                  items={[
                    { label: 'Horas TVF', value: formatHoras(colaboradorSeleccionado.horas_tvf) },
                    { label: 'Gasto', value: clp(colaboradorSeleccionado.gasto_tvf) },
                  ]}
                />
                <StatTile
                  label="Gasto Total"
                  value={clp(colaboradorSeleccionado.gasto_total)}
                  size="sm"
                  className="min-w-0"
                  valueClassName="text-red-600 dark:text-red-800"
                />
              </div>
            )}
            {sinValor(colaboradorSeleccionado) > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatHoras(sinValor(colaboradorSeleccionado))} h EXR sin costo definido en la fecha del turno: no están incluidas en el gasto.
              </p>
            )}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-muted-foreground">Horas EXR por instalación</h4>
              {cargandoDetalle ? (
                <Skeleton className="h-40 w-full" />
              ) : detalle && detalle.some((f) => f.tipo === 'EXR') ? (
                <DetalleInstalacionList filas={detalle} tipo="EXR" color="var(--chart-1)" />
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos para este período.</p>
              )}
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-muted-foreground">Horas TVF por instalación</h4>
              {cargandoDetalle ? (
                <Skeleton className="h-40 w-full" />
              ) : detalle && detalle.some((f) => f.tipo === 'TVF') ? (
                <DetalleInstalacionList filas={detalle} tipo="TVF" color="var(--chart-2)" />
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

type InstalacionAgrupada = {
  instalacion_id: number | null;
  instalacion_nombre: string;
  total: number;
  detalles: { fecha: string; horas: number }[];
};

function agruparPorInstalacion(filas: FilaDetalleRaw[], tipo: 'EXR' | 'TVF'): InstalacionAgrupada[] {
  const mapa = new Map<string, InstalacionAgrupada>();

  for (const f of filas) {
    if (f.tipo !== tipo) continue;
    const clave = String(f.instalacion_id ?? f.instalacion_nombre);
    const horas = Number(f.horas);

    if (!mapa.has(clave)) {
      mapa.set(clave, {
        instalacion_id: f.instalacion_id,
        instalacion_nombre: f.instalacion_nombre,
        total: 0,
        detalles: [],
      });
    }

    const grupo = mapa.get(clave)!;
    grupo.total += horas;
    grupo.detalles.push({ fecha: f.fecha, horas });
  }

  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

function formatFechaCorta(fechaISO: string) {
  const [y, m, d] = fechaISO.split('-');
  return `${d}-${m}-${y}`;
}

function DetalleInstalacionList({
  filas,
  tipo,
  color,
}: {
  filas: FilaDetalleRaw[];
  tipo: 'EXR' | 'TVF';
  color: string;
}) {
  const [expandido, setExpandido] = useState<string | null>(null);
  const grupos = useMemo(() => agruparPorInstalacion(filas, tipo), [filas, tipo]);
  const maxValor = grupos[0]?.total ?? 1;

  return (
    <div className="space-y-1.5">
      {grupos.map((grupo) => {
        const clave = String(grupo.instalacion_id ?? grupo.instalacion_nombre);
        const abierto = expandido === clave;
        const porcentaje = maxValor > 0 ? (grupo.total / maxValor) * 100 : 0;

        return (
          <div key={clave} className="rounded-md border">
            <button
              type="button"
              onClick={() => setExpandido(abierto ? null : clave)}
              className="flex w-full items-center gap-2 p-2.5 text-left"
            >
              <ChevronRight
                className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', abierto && 'rotate-90')}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm">{grupo.instalacion_nombre}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{formatHoras(grupo.total)}</p>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${porcentaje}%`, backgroundColor: color }} />
                </div>
              </div>
            </button>
            {abierto && (
              <div className="flex flex-wrap gap-1.5 border-t px-2.5 py-2.5 pl-9">
                {grupo.detalles.map((d, i) => (
                  <span key={i} className="rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">
                    {formatFechaCorta(d.fecha)} · {formatHoras(d.horas)} h
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}