import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import FiltroRangoSupervisores from './FiltroRangoSupervisores';
import {
  SELECT_CLASE,
  TEXTO_ERROR,
  aFecha,
  decimal1,
  decimal2,
  entero,
  errorDeRango,
  fechaCL,
  fechaCorta,
  mensajeError,
  nf1,
  pesos,
  porcentaje,
  type Rango,
} from './supervisoresUtil';

/* ───────────────────────── Tipos (contrato de GET /reportes/supervisores) ───────────────────────── */

type FilaRanking = {
  colaborador_id: number;
  nombre: string;
  cargo: string | null;
  instalaciones_asignadas: number;
  instalaciones_visitadas: number;
  efectividad: number | null;
  visitas: number;
  dias_con_visita: number;
  km: number | null;
  gasto: number | null;
  litros: number | null;
  tiene_movil: boolean;
};

type Ranking = {
  umbral_critico: number;
  resumen: {
    supervisores: number;
    instalaciones_asignadas: number;
    instalaciones_visitadas: number;
    efectividad: number | null;
    visitas: number;
    instalaciones_activas: number;
    instalaciones_sin_supervisor: number;
  };
  supervisores: FilaRanking[];
};

type InstalacionDetalle = {
  instalacion_id: number;
  nombre: string;
  cecos: string | null;
  ventanas: { desde: string; hasta: string }[];
  visitada: boolean;
  visitas: number;
  dias_visita: string[];
  ultima_visita: string | null;
  visitada_por_otros: { colaborador_id: number; nombre: string; visitas: number }[];
};

type MovilDetalle = {
  movil_id: number;
  placa: string;
  alias: string | null;
  desde: string;
  hasta: string;
  compartido_con: string[];
  km: number | null;
  dias_con_km: number;
  litros: number | null;
  gasto: number | null;
  cargas: number;
  costo_por_km: number | null;
  km_por_litro: number | null;
};

type Detalle = {
  umbral_critico: number;
  supervisor: { colaborador_id: number; nombre: string; documento: string | null; cargo: string | null };
  resumen: {
    instalaciones_asignadas: number;
    instalaciones_visitadas: number;
    efectividad: number | null;
    visitas: number;
    dias_con_visita: number;
  };
  dias: string[];
  visitas_por_dia: { fecha: string; visitas: number; instalaciones_visitadas: number }[];
  instalaciones: InstalacionDetalle[];
  vehiculo: {
    tiene_movil: boolean;
    km: number | null;
    litros: number | null;
    gasto: number | null;
    costo_por_km: number | null;
    km_por_litro: number | null;
  };
  moviles: MovilDetalle[];
  km_por_dia: { fecha: string; km: number }[];
};

/* ───────────────────────── Helpers ───────────────────────── */

const INICIAL_DIA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/* ───────────────────────── Dashboard ───────────────────────── */

export default function SupervisoresDashboard({ rango, onRango }: { rango: Rango; onRango: (r: Rango) => void }) {
  const isMobile = useIsMobile();

  const [supervisorId, setSupervisorId] = useState<number | null>(null);

  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [cargandoRanking, setCargandoRanking] = useState(true);
  const [errorRanking, setErrorRanking] = useState<string | null>(null);

  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const errorRango = errorDeRango(rango);

  // Ranking: siempre se carga (alimenta el selector y la vista inicial).
  useEffect(() => {
    if (errorRango) return;
    let cancelado = false;
    setCargandoRanking(true);
    api
      .get<Ranking>('/reportes/supervisores', { params: rango })
      .then((res) => {
        if (cancelado) return;
        setRanking(res.data);
        setErrorRanking(null);
      })
      .catch((e) => !cancelado && setErrorRanking(mensajeError(e, 'No se pudo cargar el ranking de supervisores.')))
      .finally(() => !cancelado && setCargandoRanking(false));
    return () => {
      cancelado = true;
    };
  }, [rango, errorRango]);

  // Detalle: solo con un supervisor elegido.
  useEffect(() => {
    if (supervisorId === null || errorRango) {
      setDetalle(null);
      return;
    }
    let cancelado = false;
    setCargandoDetalle(true);
    api
      .get<Detalle>(`/reportes/supervisores/${supervisorId}`, { params: rango })
      .then((res) => {
        if (cancelado) return;
        setDetalle(res.data);
        setErrorDetalle(null);
      })
      .catch((e) => !cancelado && setErrorDetalle(mensajeError(e, 'No se pudo cargar el detalle del supervisor.')))
      .finally(() => !cancelado && setCargandoDetalle(false));
    return () => {
      cancelado = true;
    };
  }, [supervisorId, rango, errorRango]);

  const umbral = detalle?.umbral_critico ?? ranking?.umbral_critico ?? 70;

  const opcionesSupervisor = useMemo(() => {
    const lista = [...(ranking?.supervisores ?? [])]
      .map((s) => ({ id: s.colaborador_id, nombre: s.nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    // Si el supervisor elegido no tiene cartera en este rango, se mantiene como opción.
    if (supervisorId !== null && !lista.some((s) => s.id === supervisorId) && detalle) {
      lista.push({ id: supervisorId, nombre: detalle.supervisor.nombre });
    }
    return lista;
  }, [ranking, supervisorId, detalle]);

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* ── Encabezado y filtros ── */}
      <div className="space-y-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Visitas, combustible y km de supervisores</h1>
          <p className="text-sm text-muted-foreground">
            Efectividad = instalaciones visitadas al menos una vez ÷ instalaciones asignadas al supervisor.
          </p>
        </div>

        <FiltroRangoSupervisores rango={rango} onChange={onRango}>
          <label className="min-w-56 flex-1 space-y-1 sm:max-w-sm">
            <span className="text-xs text-muted-foreground">Supervisor</span>
            <select
              className={`${SELECT_CLASE} w-full`}
              value={supervisorId ?? ''}
              onChange={(e) => setSupervisorId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Todos (ranking)</option>
              {opcionesSupervisor.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        </FiltroRangoSupervisores>
      </div>

      {supervisorId === null ? (
        <VistaRanking
          ranking={ranking}
          cargando={cargandoRanking}
          error={errorRanking}
          umbral={umbral}
          isMobile={isMobile}
          onElegir={setSupervisorId}
        />
      ) : (
        <VistaDetalle
          detalle={detalle}
          cargando={cargandoDetalle}
          error={errorDetalle}
          umbral={umbral}
          isMobile={isMobile}
          onVolver={() => setSupervisorId(null)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Piezas compartidas ───────────────────────── */

function Tarjeta({ titulo, derecha, children }: { titulo: string; derecha?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-heading text-base font-semibold">{titulo}</h2>
        {derecha}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Kpi({ titulo, valor, nota, rojo }: { titulo: string; valor: string; nota?: ReactNode; rojo?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 truncate text-2xl font-semibold tabular-nums" style={rojo ? { color: 'var(--destructive)' } : undefined}>
        {valor}
      </p>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}

function BarraEfectividad({ valor, umbral }: { valor: number | null; umbral: number }) {
  const critica = valor !== null && valor < umbral;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(valor ?? 0, 100)}%`,
          background: critica ? 'var(--destructive)' : 'var(--chart-1)',
        }}
      />
    </div>
  );
}

function PanelEfectividad({
  valor,
  visitadas,
  asignadas,
  umbral,
  titulo = 'Efectividad',
}: {
  valor: number | null;
  visitadas: number;
  asignadas: number;
  umbral: number;
  titulo?: string;
}) {
  const critica = valor !== null && valor < umbral;
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4 col-span-2">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p
        className="mt-1 text-4xl font-semibold tabular-nums"
        style={{ color: critica ? 'var(--destructive)' : 'var(--primary)' }}
      >
        {porcentaje(valor)}
      </p>
      <div className="mt-2">
        <BarraEfectividad valor={valor} umbral={umbral} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {valor === null
          ? 'Sin instalaciones asignadas en el rango.'
          : `${visitadas} de ${asignadas} instalaciones visitadas · rojo bajo ${umbral}%`}
      </p>
    </div>
  );
}

/* ───────────────────────── Vista: ranking de todos los supervisores ───────────────────────── */

function VistaRanking({
  ranking,
  cargando,
  error,
  umbral,
  isMobile,
  onElegir,
}: {
  ranking: Ranking | null;
  cargando: boolean;
  error: string | null;
  umbral: number;
  isMobile: boolean;
  onElegir: (id: number) => void;
}) {
  if (error) return <p className={TEXTO_ERROR}>{error}</p>;

  if (cargando && !ranking) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ranking) return null;

  const r = ranking.resumen;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <PanelEfectividad
          titulo="Efectividad global"
          valor={r.efectividad}
          visitadas={r.instalaciones_visitadas}
          asignadas={r.instalaciones_asignadas}
          umbral={umbral}
        />
        <Kpi titulo="Supervisores con cartera" valor={entero(r.supervisores)} />
        <Kpi titulo="Visitas" valor={entero(r.visitas)} />
        <Kpi
          titulo="Instalaciones sin supervisor"
          valor={entero(r.instalaciones_sin_supervisor)}
          nota={`de ${entero(r.instalaciones_activas)} activas`}
          rojo={r.instalaciones_sin_supervisor > 0}
        />
      </div>

      <Tarjeta
        titulo="Efectividad por supervisor"
        derecha={<span className="text-xs text-muted-foreground">Peor efectividad primero · clic para ver el detalle</span>}
      >
        {ranking.supervisores.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ningún supervisor tiene instalaciones asignadas en este rango. Asígnalas en Administración → Responsables.
          </p>
        ) : isMobile ? (
          <div className="space-y-2">
            {ranking.supervisores.map((s) => (
              <button
                key={s.colaborador_id}
                type="button"
                onClick={() => onElegir(s.colaborador_id)}
                className="w-full space-y-2 rounded-md border p-3 text-left hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{s.nombre}</span>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={s.efectividad !== null && s.efectividad < umbral ? { color: 'var(--destructive)' } : undefined}
                  >
                    {porcentaje(s.efectividad)}
                  </span>
                </div>
                <BarraEfectividad valor={s.efectividad} umbral={umbral} />
                <p className="text-xs text-muted-foreground">
                  {s.instalaciones_visitadas} de {s.instalaciones_asignadas} instalaciones · {s.visitas} visitas · {decimal1(s.km)} km ·{' '}
                  {pesos(s.gasto)}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supervisor</TableHead>
                <TableHead className="w-64">Efectividad</TableHead>
                <TableHead className="text-right">Visitadas / asignadas</TableHead>
                <TableHead className="text-right">Visitas</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead className="text-right">Combustible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.supervisores.map((s) => (
                <TableRow
                  key={s.colaborador_id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => onElegir(s.colaborador_id)}
                  onKeyDown={(e) => e.key === 'Enter' && onElegir(s.colaborador_id)}
                >
                  <TableCell className="font-medium">{s.nombre}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <BarraEfectividad valor={s.efectividad} umbral={umbral} />
                      </div>
                      <span
                        className="w-14 text-right text-sm font-semibold tabular-nums"
                        style={s.efectividad !== null && s.efectividad < umbral ? { color: 'var(--destructive)' } : undefined}
                      >
                        {porcentaje(s.efectividad)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.instalaciones_visitadas} / {s.instalaciones_asignadas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{entero(s.visitas)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.tiene_movil ? decimal1(s.km) : 'Sin móvil'}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.tiene_movil ? pesos(s.gasto) : 'Sin móvil'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Tarjeta>
    </div>
  );
}

/* ───────────────────────── Vista: detalle de un supervisor ───────────────────────── */

function VistaDetalle({
  detalle,
  cargando,
  error,
  umbral,
  isMobile,
  onVolver,
}: {
  detalle: Detalle | null;
  cargando: boolean;
  error: string | null;
  umbral: number;
  isMobile: boolean;
  onVolver: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const noVisitadas = useMemo(() => detalle?.instalaciones.filter((i) => !i.visitada) ?? [], [detalle]);
  const visitadas = useMemo(
    () =>
      [...(detalle?.instalaciones.filter((i) => i.visitada) ?? [])].sort((a, b) => b.visitas - a.visitas || a.nombre.localeCompare(b.nombre, 'es')),
    [detalle],
  );

  const cabecera = (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={onVolver}>
      <ArrowLeft className="mr-1 h-4 w-4" /> Volver al ranking
    </Button>
  );

  if (error) {
    return (
      <div className="space-y-3">
        {cabecera}
        <p className={TEXTO_ERROR}>{error}</p>
      </div>
    );
  }

  if (!detalle || (cargando && !detalle)) {
    return (
      <div className="space-y-3">
        {cabecera}
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { resumen, vehiculo } = detalle;
  const termino = normalizar(busqueda.trim());
  const coincide = (i: InstalacionDetalle) => !termino || normalizar(`${i.nombre} ${i.cecos ?? ''}`).includes(termino);

  return (
    <div className={`space-y-6 ${cargando ? 'opacity-60 transition-opacity' : ''}`}>
      <div className="space-y-1">
        {cabecera}
        <h2 className="font-heading text-xl font-semibold">{detalle.supervisor.nombre}</h2>
        <p className="text-sm text-muted-foreground">
          {detalle.supervisor.cargo ?? 'Sin cargo'}
          {detalle.supervisor.documento ? ` · RUT ${detalle.supervisor.documento}` : ''}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <PanelEfectividad
          valor={resumen.efectividad}
          visitadas={resumen.instalaciones_visitadas}
          asignadas={resumen.instalaciones_asignadas}
          umbral={umbral}
        />
        <Kpi
          titulo="Visitas"
          valor={entero(resumen.visitas)}
          nota={`en ${resumen.dias_con_visita} día(s) con visita`}
        />
        <Kpi titulo="Km recorridos" valor={vehiculo.tiene_movil ? decimal1(vehiculo.km) : 'Sin móvil'} nota={vehiculo.km === null && vehiculo.tiene_movil ? 'sin km cargados en el rango' : undefined} />
        <Kpi
          titulo="Combustible"
          valor={vehiculo.tiene_movil ? pesos(vehiculo.gasto) : 'Sin móvil'}
          nota={vehiculo.litros !== null ? `${decimal1(vehiculo.litros)} litros` : vehiculo.tiene_movil ? 'sin cargas en el rango' : undefined}
        />
        <Kpi
          titulo="Costo y rendimiento"
          valor={vehiculo.costo_por_km !== null ? `${pesos(vehiculo.costo_por_km)}/km` : '—'}
          nota={vehiculo.km_por_litro !== null ? `${decimal2(vehiculo.km_por_litro)} km/L` : 'km/L no disponible'}
        />
      </div>

      {/* Listas de instalaciones */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 sm:max-w-sm"
          placeholder="Buscar instalación o CECOS…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta
          titulo="Instalaciones no visitadas"
          derecha={<Badge variant={noVisitadas.length > 0 ? 'destructive' : 'outline'}>{noVisitadas.length}</Badge>}
        >
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: isMobile ? 360 : 460 }}>
            {noVisitadas.filter(coincide).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {noVisitadas.length === 0 ? 'Visitó todas sus instalaciones en el rango.' : 'Sin coincidencias.'}
              </p>
            ) : (
              noVisitadas.filter(coincide).map((i) => (
                <div key={i.instalacion_id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{i.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.cecos ? `CECOS ${i.cecos} · ` : ''}
                    {i.ultima_visita ? `Última visita registrada: ${fechaCL(i.ultima_visita)}` : 'Sin visitas registradas'}
                  </p>
                  {i.visitada_por_otros.length > 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Visitada por otro: {i.visitada_por_otros.map((o) => `${o.nombre} (${o.visitas})`).join(', ')}. No cuenta para este
                      supervisor.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Instalaciones visitadas" derecha={<Badge variant="outline">{visitadas.length}</Badge>}>
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: isMobile ? 360 : 460 }}>
            {visitadas.filter(coincide).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {visitadas.length === 0 ? 'Ninguna visita en el rango.' : 'Sin coincidencias.'}
              </p>
            ) : (
              visitadas.filter(coincide).map((i) => (
                <div key={i.instalacion_id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{i.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.cecos ? `CECOS ${i.cecos} · ` : ''}
                      {i.dias_visita.map(fechaCorta).join(', ')}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {i.visitas} visita{i.visitas === 1 ? '' : 's'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Tarjeta>
      </div>

      {/* Matriz instalación × día */}
      <Tarjeta
        titulo="Visitas por instalación y día"
        derecha={<span className="text-xs text-muted-foreground">● visitada · gris: sin visita · punteado: no era su instalación ese día</span>}
      >
        <MatrizVisitas detalle={detalle} filas={detalle.instalaciones.filter(coincide)} />
      </Tarjeta>

      {/* Gráficos por día */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Instalaciones visitadas por día">
          <GraficoDias
            datos={detalle.dias.map((fecha) => ({
              fecha,
              valor: detalle.visitas_por_dia.find((d) => d.fecha === fecha)?.instalaciones_visitadas ?? 0,
            }))}
            unidad="instalaciones"
            vacio="Sin visitas en el rango."
            isMobile={isMobile}
          />
        </Tarjeta>
        <Tarjeta titulo="Km recorridos por día">
          <GraficoDias
            datos={detalle.dias.map((fecha) => ({
              fecha,
              valor: detalle.km_por_dia.find((d) => d.fecha === fecha)?.km ?? null,
            }))}
            unidad="km"
            vacio={vehiculo.tiene_movil ? 'Sin km cargados en el rango.' : 'Sin móvil asignado en el rango.'}
            isMobile={isMobile}
          />
        </Tarjeta>
      </div>

      {/* Móviles */}
      <Tarjeta titulo="Móvil, km y combustible">
        {detalle.moviles.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Este supervisor no tuvo móvil asignado en el rango.</p>
        ) : isMobile ? (
          <div className="space-y-2">
            {detalle.moviles.map((m, idx) => (
              <div key={`${m.movil_id}-${idx}`} className="space-y-1 rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {m.placa}
                  {m.alias ? ` · ${m.alias}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fechaCL(m.desde)} → {fechaCL(m.hasta)}
                  {m.compartido_con.length > 0 ? ` · compartido con ${m.compartido_con.join(', ')}` : ''}
                </p>
                <p className="tabular-nums">
                  {decimal1(m.km)} km · {decimal1(m.litros)} L · {pesos(m.gasto)}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {m.costo_por_km !== null ? `${pesos(m.costo_por_km)}/km` : '—'} ·{' '}
                  {m.km_por_litro !== null ? `${decimal2(m.km_por_litro)} km/L` : '—'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Móvil</TableHead>
                <TableHead>Período con el móvil</TableHead>
                <TableHead>Compartido con</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead className="text-right">Litros</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Cargas</TableHead>
                <TableHead className="text-right">$/km</TableHead>
                <TableHead className="text-right">km/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalle.moviles.map((m, idx) => (
                <TableRow key={`${m.movil_id}-${idx}`}>
                  <TableCell className="font-medium">
                    {m.placa}
                    {m.alias ? <span className="text-muted-foreground"> · {m.alias}</span> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {fechaCL(m.desde)} → {fechaCL(m.hasta)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.compartido_con.length > 0 ? m.compartido_con.join(', ') : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{decimal1(m.km)}</TableCell>
                  <TableCell className="text-right tabular-nums">{decimal1(m.litros)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pesos(m.gasto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.cargas}</TableCell>
                  <TableCell className="text-right tabular-nums">{pesos(m.costo_por_km)}</TableCell>
                  <TableCell className="text-right tabular-nums">{decimal2(m.km_por_litro)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Tarjeta>
    </div>
  );
}

/* ───────────────────────── Matriz instalación × día ───────────────────────── */

function MatrizVisitas({ detalle, filas }: { detalle: Detalle; filas: InstalacionDetalle[] }) {
  if (filas.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Sin instalaciones para mostrar.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-48 max-w-64 bg-card px-2 pb-2 text-left font-medium text-muted-foreground">
              Instalación
            </th>
            {detalle.dias.map((dia) => {
              const f = aFecha(dia);
              return (
                <th key={dia} className="min-w-7 px-0.5 pb-2 text-center font-normal text-muted-foreground">
                  <div className="tabular-nums">{String(f.getDate()).padStart(2, '0')}</div>
                  <div className="text-[10px] opacity-70">{INICIAL_DIA[f.getDay()]}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((i) => {
            const dias = new Set(i.dias_visita);
            return (
              <tr key={i.instalacion_id}>
                <td className="sticky left-0 z-10 min-w-48 max-w-64 truncate bg-card px-2 py-0.5 text-sm" title={i.nombre}>
                  {i.nombre}
                </td>
                {detalle.dias.map((dia) => {
                  const enVentana = i.ventanas.some((v) => dia >= v.desde && dia <= v.hasta);
                  const visitada = dias.has(dia);
                  return (
                    <td key={dia} className="px-0.5 py-0.5 text-center">
                      <div
                        className={`mx-auto flex h-6 w-6 items-center justify-center rounded text-[10px] ${
                          !enVentana ? 'border border-dashed border-muted-foreground/30' : visitada ? 'text-primary-foreground' : 'bg-muted'
                        }`}
                        style={enVentana && visitada ? { background: 'var(--chart-1)' } : undefined}
                        title={`${i.nombre} · ${fechaCL(dia)} · ${!enVentana ? 'no era su instalación' : visitada ? 'visitada' : 'sin visita'}`}
                      >
                        {enVentana && visitada ? '●' : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Gráfico de barras por día ───────────────────────── */

function GraficoDias({
  datos,
  unidad,
  vacio,
  isMobile,
}: {
  datos: { fecha: string; valor: number | null }[];
  unidad: string;
  vacio: string;
  isMobile: boolean;
}) {
  const hayDatos = datos.some((d) => d.valor !== null && d.valor > 0);
  if (!hayDatos) return <p className="py-8 text-center text-sm text-muted-foreground">{vacio}</p>;

  const serie = datos.map((d) => ({ etiqueta: fechaCorta(d.fecha), fecha: d.fecha, valor: d.valor }));
  // Con muchos días se salta alguna etiqueta para que no se encimen.
  const saltar = serie.length > 20 ? Math.ceil(serie.length / (isMobile ? 6 : 14)) - 1 : 0;

  return (
    <div style={{ height: isMobile ? 220 : 260 }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={serie} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} interval={saltar} />
          <YAxis tick={{ fontSize: 11 }} width={40} allowDecimals={unidad !== 'instalaciones'} />
          <Tooltip
            formatter={(valor) => [`${typeof valor === 'number' ? nf1.format(valor) : valor} ${unidad}`, '']}
            labelFormatter={(_, payload) => {
              const fecha = payload?.[0]?.payload?.fecha as string | undefined;
              return fecha ? fechaCL(fecha) : '';
            }}
          />
          <Bar dataKey="valor" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
