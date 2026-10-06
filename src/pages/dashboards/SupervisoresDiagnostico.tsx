import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FiltroRangoSupervisores from './FiltroRangoSupervisores';
import { TEXTO_ERROR, entero, errorDeRango, fechaCL, fechaCorta, mensajeError, porcentaje, type Rango } from './supervisoresUtil';

/**
 * Pestaña interna (permiso dashboards.gastos_supervisores_diagnostico): todo lo que el dashboard
 * de supervisores descarta o no puede atribuir, y por qué. No es para usuarios finales.
 */

/* ───────────────────────── Tipos (contrato de GET /reportes/supervisores-diagnostico) ───────────────────────── */

type FilaRazon = {
  colaborador_id: number;
  visitante: string;
  cargo: string | null;
  instalacion_id: number | null;
  instalacion: string | null;
  cecos: string | null;
  instalacion_activa: boolean | null;
  visitas: number;
  dias: string[];
};

type Razon = {
  clave: string;
  etiqueta: string;
  explicacion: string;
  visitas: number;
  grupos: number;
  filas: FilaRazon[];
  truncado: boolean;
};

type Cobertura = { desde: string | null; hasta: string | null; filas: number };

type Diagnostico = {
  conciliacion: {
    visitas_archivo: number;
    contadas: number;
    no_atribuidas: number;
    por_cargo: { cargo: string; visitas: number }[];
  };
  razones: Razon[];
  visitantes: {
    colaborador_id: number;
    nombre: string;
    cargo: string | null;
    es_supervisor: boolean;
    total: number;
    contadas: number;
    no_atribuidas: number;
  }[];
  cobertura_datos: { visitas: Cobertura; km: Cobertura; combustible: Cobertura };
  instalaciones_activas_sin_supervisor: { total: number; filas: { id: number; nombre: string; cecos: string | null }[] };
  asignaciones_a_instalaciones_inactivas: {
    supervisor: string;
    instalacion: string;
    cecos: string | null;
    desde: string;
    hasta: string | null;
  }[];
  vehiculo: { sin_movil: string[]; sin_km: string[]; sin_combustible: string[] };
};

/* ───────────────────────── Piezas ───────────────────────── */

function Seccion({
  titulo,
  badge,
  descripcion,
  abiertaInicial = true,
  children,
}: {
  titulo: string;
  badge?: ReactNode;
  descripcion?: string;
  abiertaInicial?: boolean;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  return (
    <section className="min-w-0 rounded-lg border bg-card">
      <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left" onClick={() => setAbierta((a) => !a)}>
        {abierta ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <span className="font-heading text-base font-semibold">{titulo}</span>
        {badge}
      </button>
      {abierta && (
        <div className="space-y-3 border-t p-4">
          {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

function Tile({ titulo, valor, nota, rojo }: { titulo: string; valor: string; nota?: string; rojo?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={rojo ? { color: 'var(--destructive)' } : undefined}>
        {valor}
      </p>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}

function estadoCobertura(c: Cobertura, rango: Rango): { texto: string; rojo: boolean } {
  if (!c.desde || !c.hasta || c.filas === 0) return { texto: 'Sin datos cargados', rojo: true };
  if (rango.hasta < c.desde || rango.desde > c.hasta) return { texto: 'El rango consultado queda fuera de lo cargado', rojo: true };
  if (rango.desde < c.desde || rango.hasta > c.hasta) return { texto: 'Cubre solo una parte del rango consultado', rojo: true };
  return { texto: 'Cubre todo el rango consultado', rojo: false };
}

function ListaNombres({ titulo, nombres, vacio }: { titulo: string; nombres: string[]; vacio: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">
        {titulo} <Badge variant={nombres.length > 0 ? 'destructive' : 'outline'}>{nombres.length}</Badge>
      </p>
      <p className="text-sm text-muted-foreground">{nombres.length > 0 ? nombres.join(' · ') : vacio}</p>
    </div>
  );
}

/* ───────────────────────── Vista ───────────────────────── */

export default function SupervisoresDiagnostico({ rango, onRango }: { rango: Rango; onRango: (r: Rango) => void }) {
  const [datos, setDatos] = useState<Diagnostico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [razonAbierta, setRazonAbierta] = useState<string | null>(null);

  const errorRango = errorDeRango(rango);

  useEffect(() => {
    if (errorRango) return;
    let cancelado = false;
    setCargando(true);
    api
      .get<Diagnostico>('/reportes/supervisores-diagnostico', { params: rango })
      .then((res) => {
        if (cancelado) return;
        setDatos(res.data);
        setError(null);
      })
      .catch((e) => !cancelado && setError(mensajeError(e, 'No se pudo cargar el diagnóstico.')))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [rango, errorRango]);

  const c = datos?.conciliacion;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="space-y-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Diagnóstico interno de supervisores</h1>
          <p className="text-sm text-muted-foreground">
            Qué visitas y datos no entran al dashboard y por qué. Solo para desarrollo: no se muestra a usuarios finales.
          </p>
        </div>
        <FiltroRangoSupervisores rango={rango} onChange={onRango} />
      </div>

      {error && <p className={TEXTO_ERROR}>{error}</p>}

      {cargando && !datos ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        datos &&
        c && (
          <div className={`space-y-6 ${cargando ? 'opacity-60 transition-opacity' : ''}`}>
            {/* Conciliación */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile titulo="Visitas del archivo en el rango" valor={entero(c.visitas_archivo)} />
                <Tile titulo="Contadas" valor={entero(c.contadas)} nota="atribuidas a un supervisor" />
                <Tile
                  titulo="No atribuidas"
                  valor={entero(c.no_atribuidas)}
                  nota="no suman a nadie"
                  rojo={c.no_atribuidas > 0}
                />
                <Tile
                  titulo="% no atribuidas"
                  valor={c.visitas_archivo > 0 ? porcentaje((c.no_atribuidas / c.visitas_archivo) * 100) : '—'}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Siempre se cumple: visitas del archivo = contadas + no atribuidas. Cada visita cae en exactamente un motivo (abajo).
                {c.por_cargo.length > 0 && ` No atribuidas por cargo de quien visitó: ${c.por_cargo.map((x) => `${x.cargo} (${x.visitas})`).join(' · ')}.`}
              </p>
            </div>

            {/* Motivos */}
            <Seccion
              titulo="Por qué se cuenta o no cada visita"
              descripcion="Se evalúa en este orden y la primera regla que aplica decide el motivo. Clic en un motivo para ver quién visitó qué."
            >
              <div className="space-y-2">
                {datos.razones.map((r) => {
                  const abierta = razonAbierta === r.clave;
                  const expandible = r.clave !== 'contada' && r.visitas > 0;
                  return (
                    <div key={r.clave} className="rounded-md border">
                      <button
                        type="button"
                        disabled={!expandible}
                        onClick={() => setRazonAbierta(abierta ? null : r.clave)}
                        className="flex w-full items-start gap-2 p-3 text-left disabled:cursor-default"
                      >
                        {expandible ? (
                          abierta ? <ChevronDown className="mt-0.5 size-4 shrink-0" /> : <ChevronRight className="mt-0.5 size-4 shrink-0" />
                        ) : (
                          <span className="size-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{r.etiqueta}</span>
                            <Badge variant={r.clave === 'contada' ? 'outline' : r.visitas > 0 ? 'destructive' : 'outline'}>
                              {entero(r.visitas)} visita{r.visitas === 1 ? '' : 's'}
                            </Badge>
                            {r.clave !== 'contada' && r.grupos > 0 && (
                              <span className="text-xs text-muted-foreground">{r.grupos} combinación(es) visitante-instalación</span>
                            )}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">{r.explicacion}</span>
                        </span>
                      </button>

                      {abierta && (
                        <div className="border-t p-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Visitante</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Instalación</TableHead>
                                <TableHead className="text-right">Visitas</TableHead>
                                <TableHead>Días</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {r.filas.map((f) => (
                                <TableRow key={`${f.colaborador_id}-${f.instalacion_id ?? 0}`}>
                                  <TableCell className="font-medium">{f.visitante}</TableCell>
                                  <TableCell className="text-muted-foreground">{f.cargo ?? '—'}</TableCell>
                                  <TableCell>
                                    {f.instalacion ?? '—'}
                                    {f.cecos ? <span className="text-muted-foreground"> · {f.cecos}</span> : null}
                                    {f.instalacion_activa === false ? <Badge variant="outline" className="ml-2">inactiva</Badge> : null}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{f.visitas}</TableCell>
                                  <TableCell className="text-muted-foreground">{f.dias.map(fechaCorta).join(', ')}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {r.truncado && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Se muestran las {r.filas.length} combinaciones con más visitas de {r.grupos}.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Seccion>

            {/* Por visitante */}
            <Seccion
              titulo="Visitas por visitante"
              badge={<Badge variant="outline">{datos.visitantes.length}</Badge>}
              descripcion="Todos los colaboradores que aparecen en el archivo en el rango, con cuántas de sus visitas cuentan."
              abiertaInicial={false}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitante</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Cartera de supervisor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Contadas</TableHead>
                    <TableHead className="text-right">No atribuidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.visitantes.map((v) => (
                    <TableRow key={v.colaborador_id}>
                      <TableCell className="font-medium">{v.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">{v.cargo ?? '—'}</TableCell>
                      <TableCell>{v.es_supervisor ? 'Sí' : 'No'}</TableCell>
                      <TableCell className="text-right tabular-nums">{v.total}</TableCell>
                      <TableCell className="text-right tabular-nums">{v.contadas}</TableCell>
                      <TableCell className="text-right tabular-nums">{v.no_atribuidas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Seccion>

            {/* Cobertura */}
            <Seccion
              titulo="Cobertura de datos cargados"
              descripcion="Qué fechas hay realmente en cada tabla frente al rango consultado. Un dashboard vacío casi siempre es esto."
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datos</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead>Hasta</TableHead>
                    <TableHead className="text-right">Filas</TableHead>
                    <TableHead>Frente al rango consultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    [
                      ['Visitas', datos.cobertura_datos.visitas],
                      ['Kilómetros', datos.cobertura_datos.km],
                      ['Combustible', datos.cobertura_datos.combustible],
                    ] as const
                  ).map(([nombre, cob]) => {
                    const est = estadoCobertura(cob, rango);
                    return (
                      <TableRow key={nombre}>
                        <TableCell className="font-medium">{nombre}</TableCell>
                        <TableCell>{cob.desde ? fechaCL(cob.desde) : '—'}</TableCell>
                        <TableCell>{cob.hasta ? fechaCL(cob.hasta) : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{entero(cob.filas)}</TableCell>
                        <TableCell style={est.rojo ? { color: 'var(--destructive)' } : undefined}>{est.texto}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Seccion>

            {/* Instalaciones sin supervisor */}
            <Seccion
              titulo="Instalaciones activas sin supervisor en el rango"
              badge={<Badge variant={datos.instalaciones_activas_sin_supervisor.total > 0 ? 'destructive' : 'outline'}>{datos.instalaciones_activas_sin_supervisor.total}</Badge>}
              descripcion="No están en la cartera de nadie, así que sus visitas no cuentan y no pueden salir como 'no visitadas'."
              abiertaInicial={false}
            >
              {datos.instalaciones_activas_sin_supervisor.filas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todas las instalaciones activas tienen supervisor.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded-md border">
                  <Table>
                    <TableBody>
                      {datos.instalaciones_activas_sin_supervisor.filas.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>{i.nombre}</TableCell>
                          <TableCell className="text-muted-foreground">{i.cecos ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {datos.instalaciones_activas_sin_supervisor.total > datos.instalaciones_activas_sin_supervisor.filas.length && (
                <p className="text-xs text-muted-foreground">
                  Se muestran las primeras {datos.instalaciones_activas_sin_supervisor.filas.length} por nombre.
                </p>
              )}
            </Seccion>

            {/* Asignaciones a inactivas */}
            <Seccion
              titulo="Asignaciones a instalaciones inactivas"
              badge={<Badge variant="outline">{datos.asignaciones_a_instalaciones_inactivas.length}</Badge>}
              descripcion="Asignaciones que tocan el rango pero apuntan a una instalación inactiva: se excluyen de la cartera."
              abiertaInicial={false}
            >
              {datos.asignaciones_a_instalaciones_inactivas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Instalación</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead>Hasta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos.asignaciones_a_instalaciones_inactivas.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{a.supervisor}</TableCell>
                        <TableCell>
                          {a.instalacion}
                          {a.cecos ? <span className="text-muted-foreground"> · {a.cecos}</span> : null}
                        </TableCell>
                        <TableCell>{fechaCL(a.desde)}</TableCell>
                        <TableCell>{a.hasta ? fechaCL(a.hasta) : 'vigente'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Seccion>

            {/* Vehículo */}
            <Seccion
              titulo="Supervisores sin datos de vehículo"
              descripcion="Aparecen con '—' o 'Sin móvil' en el dashboard (null, no cero)."
              abiertaInicial={false}
            >
              <ListaNombres titulo="Sin móvil asignado en el rango" nombres={datos.vehiculo.sin_movil} vacio="Todos tienen móvil." />
              <ListaNombres titulo="Con móvil pero sin km cargados" nombres={datos.vehiculo.sin_km} vacio="Todos tienen km." />
              <ListaNombres titulo="Con móvil pero sin cargas de combustible" nombres={datos.vehiculo.sin_combustible} vacio="Todos tienen cargas." />
            </Seccion>
          </div>
        )
      )}
    </div>
  );
}
