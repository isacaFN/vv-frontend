import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { CLASE_ESTADO, ETIQUETA_ESTADO_CORTA, PERMISO_VAC_SOLICITAR } from '@/config/vacaciones';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import BarraProgreso from './BarraProgreso';
import DetalleSolicitudDialog from './DetalleSolicitudDialog';
import NuevaSolicitudDialog from './NuevaSolicitudDialog';
import { EVENTO_VACACIONES_CAMBIO, type Catalogo, type ListaSolicitudes, type Solicitud, type Vista } from './tipos';
import { SELECT_CLASE, TEXTO_ERROR, mensajeError, normalizar, rangoTexto } from './utilidades';

const CLASE_TRIGGER =
  'rounded-md px-3 py-1.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';

/** ¿Le toca al usuario hacer algo en una etapa (no cuenta cancelar)? */
const leToca = (s: Solicitud) => s.acciones.some((a) => a !== 'cancelar');

type Abierta = { id: number; inicial: Solicitud | null };

/** RRHH → Permisos y Vacaciones: solicitudes con un paso abierto e historial. */
export default function PermisosVacaciones() {
  const isMobile = useIsMobile();
  const { tienePermiso } = useAuth();
  const puedeSolicitar = tienePermiso(PERMISO_VAC_SOLICITAR);

  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [vista, setVista] = useState<Vista>('abiertas');
  const [lista, setLista] = useState<ListaSolicitudes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [buscar, setBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const [nueva, setNueva] = useState(false);
  const [abierta, setAbierta] = useState<Abierta | null>(null);

  useEffect(() => {
    let vigente = true;
    api
      .get<Catalogo>('/vacaciones/catalogo')
      .then((res) => vigente && setCatalogo(res.data))
      .catch((e) => vigente && setError(mensajeError(e, 'No se pudo cargar el catálogo de Permisos y Vacaciones.')));
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api
      .get<ListaSolicitudes>('/vacaciones/solicitudes', { params: { vista } })
      .then((res) => {
        if (!vigente) return;
        setLista(res.data);
        setError(null);
      })
      .catch((e) => vigente && setError(mensajeError(e, 'No se pudieron cargar las solicitudes.')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [vista, recarga]);

  const huboCambio = useCallback(() => {
    setRecarga((n) => n + 1);
    window.dispatchEvent(new Event(EVENTO_VACACIONES_CAMBIO));
  }, []);

  function cambiarVista(valor: string) {
    setVista(valor as Vista);
    setFiltroEstado('todos');
    setLista(null);
  }

  const filas = useMemo(() => {
    if (!lista) return [];
    const termino = normalizar(buscar.trim());
    return lista.solicitudes.filter((s) => {
      if (filtroEstado !== 'todos' && s.estado !== filtroEstado) return false;
      if (!termino) return true;
      return normalizar(`${s.folio} ${s.colaborador.nombre} ${s.colaborador.documento ?? ''} ${s.tipo.codigo} ${s.tipo.nombre} ${s.solicitante}`).includes(termino);
    });
  }, [lista, buscar, filtroEstado]);

  const estadosDeLaVista = useMemo(() => {
    if (!catalogo) return [];
    return Object.entries(catalogo.estados)
      .filter(([, e]) => e.abierta === (vista === 'abiertas'))
      .map(([clave]) => clave);
  }, [catalogo, vista]);

  const cantidadTe = lista?.solicitudes.filter(leToca).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-lg font-semibold">Permisos y Vacaciones</h2>
          <p className="text-sm text-muted-foreground">Solicitudes de permisos y vacaciones de los colaboradores y el estado de cada una.</p>
        </div>
        {puedeSolicitar && catalogo && (
          <Button className="ml-auto" onClick={() => setNueva(true)}>
            <Plus className="size-4" /> Nueva solicitud
          </Button>
        )}
      </div>

      <Tabs value={vista} onValueChange={cambiarVista}>
        <TabsList className="h-auto gap-1 rounded-lg border bg-card p-1">
          <TabsTrigger value="abiertas" className={CLASE_TRIGGER}>
            Con paso abierto
          </TabsTrigger>
          <TabsTrigger value="historial" className={CLASE_TRIGGER}>
            Historial
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error && <p className={TEXTO_ERROR}>{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por folio, colaborador o tipo…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        {catalogo && (
          <select className={SELECT_CLASE} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            {estadosDeLaVista.map((clave) => (
              <option key={clave} value={clave}>
                {ETIQUETA_ESTADO_CORTA[clave] ?? clave}
              </option>
            ))}
          </select>
        )}
        <span className="text-sm text-muted-foreground">
          {filas.length} de {lista?.total ?? 0}
        </span>
        {vista === 'abiertas' && cantidadTe > 0 && <Badge>{cantidadTe} te esperan</Badge>}
      </div>

      {lista?.truncado && (
        <p className="text-xs text-muted-foreground">Se muestran las {lista.solicitudes.length} más recientes de {lista.total}. Usa el buscador para acotar.</p>
      )}

      {cargando && !lista ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {vista === 'abiertas' ? 'No hay solicitudes con un paso abierto.' : 'No hay solicitudes en el historial con ese filtro.'}
        </p>
      ) : isMobile ? (
        <div className="space-y-2">
          {filas.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAbierta({ id: s.id, inicial: null })}
              className="flex w-full items-center gap-3 rounded-md border p-3 text-left hover:bg-muted/40"
            >
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{s.colaborador.nombre}</span>
                  {leToca(s) && <Badge>Te toca</Badge>}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {s.folio} · {s.tipo.codigo} · {rangoTexto(s.fecha_desde, s.fecha_hasta)}
                </span>
                <span className="block text-xs">
                  {s.descuenta_vacaciones ? `Se descuentan ${s.dias_descontados} día(s)` : 'RRHH valida los días'}
                </span>
                <Badge variant="outline" className={CLASE_ESTADO[s.estado]}>
                  {ETIQUETA_ESTADO_CORTA[s.estado] ?? s.estado}
                </Badge>
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
                <TableHead>Folio</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead className="text-right">Días a descontar</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => setAbierta({ id: s.id, inicial: null })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setAbierta({ id: s.id, inicial: null });
                  }}
                >
                  <TableCell className="whitespace-nowrap text-sm">{s.folio}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {s.colaborador.nombre}
                      {leToca(s) && <Badge>Te toca</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.colaborador.instalacion ?? s.colaborador.documento ?? '—'}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{s.tipo.codigo}</div>
                    <div className="text-xs text-muted-foreground">{s.tipo.nombre}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{rangoTexto(s.fecha_desde, s.fecha_hasta)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {s.descuenta_vacaciones ? (
                      <span className="font-medium">{s.dias_descontados}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{catalogo && <BarraProgreso compacta estado={s.estado} etapas={catalogo.etapas} />}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={CLASE_ESTADO[s.estado]}>
                      {ETIQUETA_ESTADO_CORTA[s.estado] ?? s.estado}
                    </Badge>
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

      {nueva && catalogo && (
        <NuevaSolicitudDialog
          catalogo={catalogo}
          onClose={() => setNueva(false)}
          onCreada={(s) => {
            setNueva(false);
            huboCambio();
            setAbierta({ id: s.id, inicial: s }); // se muestra el comprobante
          }}
        />
      )}

      {abierta && catalogo && (
        <DetalleSolicitudDialog catalogo={catalogo} id={abierta.id} inicial={abierta.inicial} onClose={() => setAbierta(null)} onCambio={huboCambio} />
      )}
    </div>
  );
}
