import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AlertTriangle, FileSpreadsheet, History, Loader2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { SELECT_CLASE, fechaHora, mensajeError } from '@/pages/admin/utils';

/* ───────────────────────── Tipos ───────────────────────── */

type Semaforo = 'al_dia' | 'por_vencer' | 'atrasado' | 'sin_cargas' | 'manual';
type EstadoCarga = 'encolada' | 'completada' | 'fallida';

type ResumenCarga = {
  id: number;
  archivo_nombre: string | null;
  archivo_bytes: number | null;
  estado: EstadoCarga;
  sin_confirmar: boolean; // 'encolada' vieja: el proceso nunca la cerró
  descartadas: number | null;
  error: string | null;
  usuario: string | null; // null = usuario eliminado
  subida_at: string | null;
  finalizada_at: string | null;
};

type ImportFila = {
  slug: string;
  nombre: string;
  frecuencia: string;
  archivo: string; // patrón legible: "Horas_de_Colaborador_*.xlsx"
  esperado: string[]; // fragmentos normalizados del nombre de archivo
  nota: string | null;
  endpoint: string;
  limite_dias: number | null;
  semaforo: Semaforo;
  en_proceso: boolean;
  dias_sin_cargar: number | null;
  ultima: ResumenCarga | null;
  ultima_completada: ResumenCarga | null;
};

type Estado = {
  imports: ImportFila[];
  resumen: { atrasados: number; por_vencer: number; en_proceso: number };
  minutos_en_curso: number;
};

type CargaHistorial = ResumenCarga & { import: string; import_nombre: string };

type Pagina<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Descarte = {
  id: number;
  motivo: string;
  valor_buscado: string | null;
  contexto: unknown;
  detectado_en: string | null;
};

/* ───────────────────────── Helpers ───────────────────────── */

const SEGUNDOS_POLLING = 5;

const SEMAFORO: Record<Semaforo, { texto: string; color: string }> = {
  al_dia: { texto: 'Al día', color: '#16a34a' },
  por_vencer: { texto: 'Por vencer', color: '#d97706' },
  atrasado: { texto: 'Atrasado', color: '#dc2626' },
  sin_cargas: { texto: 'Sin cargas registradas', color: '#6b7280' },
  manual: { texto: 'Carga manual', color: '#6b7280' },
};

const ESTADO_CARGA: Record<EstadoCarga, { texto: string; color: string }> = {
  encolada: { texto: 'Procesando', color: '#2563eb' },
  completada: { texto: 'Completada', color: '#16a34a' },
  fallida: { texto: 'Fallida', color: '#dc2626' },
};

/** Minúsculas, sin tildes, espacios -> "_": para comparar el nombre del archivo con lo esperado. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function tamano(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function haceCuanto(dias: number | null): string {
  if (dias == null) return '';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

function duracion(c: ResumenCarga): string {
  if (!c.subida_at || !c.finalizada_at) return '';
  const seg = Math.max(0, Math.round((new Date(c.finalizada_at).getTime() - new Date(c.subida_at).getTime()) / 1000));
  return seg < 60 ? `${seg} s` : `${Math.round(seg / 60)} min`;
}

function Etiqueta({ texto, color }: { texto: string; color: string }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
      {texto}
    </Badge>
  );
}

/* ───────────────────────── Componente principal ───────────────────────── */

export default function ImportacionesAdmin() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [elegido, setElegido] = useState<{ imp: ImportFila; archivo: File } | null>(null);
  const [descartesDe, setDescartesDe] = useState<{ id: number; titulo: string } | null>(null);
  const [recarga, setRecarga] = useState(0); // sube cuando hay que refrescar el historial

  const selectorArchivo = useRef<HTMLInputElement | null>(null);
  const importParaSubir = useRef<ImportFila | null>(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get<Estado>('/importaciones');
      setEstado(data);
      setError(null);
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar el estado de las importaciones.'));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Mientras algún import se está procesando, refresca solo cada pocos segundos.
  const hayEnProceso = (estado?.resumen.en_proceso ?? 0) > 0;
  useEffect(() => {
    if (!hayEnProceso) return;
    const t = window.setInterval(() => void cargar(), SEGUNDOS_POLLING * 1000);
    return () => window.clearInterval(t);
  }, [hayEnProceso, cargar]);

  const alElegirArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    const imp = importParaSubir.current;
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (archivo && imp) setElegido({ imp, archivo });
  };

  const abrirSelector = (imp: ImportFila) => {
    importParaSubir.current = imp;
    selectorArchivo.current?.click();
  };

  const atrasados = estado?.imports.filter((i) => i.semaforo === 'atrasado') ?? [];
  const porVencer = estado?.imports.filter((i) => i.semaforo === 'por_vencer') ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">Importaciones</h2>
        <p className="text-sm text-muted-foreground">
          Sube los Excel de cada fuente. Cada carga queda registrada con quién la subió y cómo terminó.
        </p>
      </div>

      <input ref={selectorArchivo} type="file" accept=".xlsx,.xls" className="hidden" onChange={alElegirArchivo} />

      {error && <p className="text-sm text-red-600 dark:text-red-800">{error}</p>}

      {(atrasados.length > 0 || porVencer.length > 0) && (
        <div
          className="flex items-start gap-2 rounded-lg border p-3 text-sm"
          style={{ borderColor: atrasados.length ? '#dc2626' : '#d97706' }}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: atrasados.length ? '#dc2626' : '#d97706' }} />
          <div className="space-y-0.5">
            {atrasados.length > 0 && (
              <p>
                <span className="font-medium">Atrasados:</span> {atrasados.map((i) => i.nombre).join(', ')}.
              </p>
            )}
            {porVencer.length > 0 && (
              <p>
                <span className="font-medium">Por vencer:</span> {porVencer.map((i) => i.nombre).join(', ')}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Semanales: atrasados desde 8 días sin carga. Mensuales: desde 31 días.
            </p>
          </div>
        </div>
      )}

      {aviso && <p className="text-sm text-muted-foreground">{aviso}</p>}

      {!estado ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {estado.imports.map((imp) => (
            <TarjetaImport key={imp.slug} imp={imp} onSubir={() => abrirSelector(imp)} onDescartes={setDescartesDe} />
          ))}
        </div>
      )}

      {estado && <Historial imports={estado.imports} recarga={recarga} onDescartes={setDescartesDe} />}

      {elegido && (
        <DialogSubir
          imp={elegido.imp}
          archivo={elegido.archivo}
          onCerrar={() => setElegido(null)}
          onSubido={() => {
            setElegido(null);
            setAviso(`«${elegido.imp.nombre}» recibido: se está procesando. El estado se actualiza solo.`);
            void cargar();
          }}
        />
      )}

      {descartesDe && <DialogDescartes carga={descartesDe} onCerrar={() => setDescartesDe(null)} />}
    </div>
  );
}

/* ───────────────────────── Tarjeta de cada import ───────────────────────── */

function TarjetaImport({
  imp,
  onSubir,
  onDescartes,
}: {
  imp: ImportFila;
  onSubir: () => void;
  onDescartes: (c: { id: number; titulo: string }) => void;
}) {
  const sem = SEMAFORO[imp.semaforo];
  const comp = imp.ultima_completada;
  const ult = imp.ultima;
  // La última carga falló DESPUÉS de la última buena: hay que reintentar.
  const fallo = ult && ult.estado === 'fallida';
  const sinConfirmar = ult?.sin_confirmar;

  return (
    <div className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-base font-semibold">{imp.nombre}</p>
          <p className="text-xs text-muted-foreground">{imp.frecuencia}</p>
        </div>
        <Etiqueta texto={sem.texto} color={sem.color} />
      </div>

      <p className="flex items-center gap-1.5 break-all text-xs text-muted-foreground">
        <FileSpreadsheet className="size-3.5 shrink-0" /> {imp.archivo}
      </p>
      {imp.nota && <p className="text-xs text-muted-foreground">{imp.nota}</p>}

      <div className="rounded-md bg-muted/50 p-2 text-sm">
        {comp ? (
          <>
            <p>
              Última carga completada <span className="font-medium">{haceCuanto(imp.dias_sin_cargar)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {comp.usuario ?? 'Usuario eliminado'} · {fechaHora(comp.finalizada_at)}
              {comp.archivo_nombre ? ` · ${comp.archivo_nombre}` : ''}
            </p>
            {comp.descartadas ? (
              <button
                type="button"
                className="mt-1 text-xs underline underline-offset-2"
                onClick={() => onDescartes({ id: comp.id, titulo: `${imp.nombre} · ${fechaHora(comp.finalizada_at)}` })}
              >
                {comp.descartadas} filas descartadas — ver detalle
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">Aún no hay cargas registradas desde la aplicación.</p>
        )}
      </div>

      {imp.en_proceso && (
        <p className="flex items-center gap-2 text-sm" style={{ color: '#2563eb' }}>
          <Loader2 className="size-4 animate-spin" /> Procesando archivo
          {ult?.usuario ? ` de ${ult.usuario}` : ''}…
        </p>
      )}
      {fallo && !imp.en_proceso && (
        <p className="text-sm" style={{ color: '#dc2626' }}>
          La última carga falló ({ult?.usuario ?? 'usuario eliminado'}, {fechaHora(ult?.subida_at ?? null)})
          {ult?.error ? `: ${ult.error}` : '.'}
        </p>
      )}
      {sinConfirmar && !imp.en_proceso && (
        <p className="text-sm" style={{ color: '#d97706' }}>
          Hay una carga sin confirmar ({fechaHora(ult?.subida_at ?? null)}): el proceso no avisó que terminó. Revisa los datos antes
          de volver a subirla.
        </p>
      )}

      <Button size="sm" variant="outline" disabled={imp.en_proceso} onClick={onSubir}>
        <Upload className="size-4" /> Subir archivo
      </Button>
    </div>
  );
}

/* ───────────────────────── Diálogo de subida ───────────────────────── */

function DialogSubir({
  imp,
  archivo,
  onCerrar,
  onSubido,
}: {
  imp: ImportFila;
  archivo: File;
  onCerrar: () => void;
  onSubido: () => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Avisos que no bloquean: el usuario decide.
  const nombreNorm = normalizar(archivo.name);
  const noParece = !imp.esperado.some((fragmento) => nombreNorm.includes(fragmento));
  const comp = imp.ultima_completada;
  const repetido = !!comp && comp.archivo_nombre === archivo.name && comp.archivo_bytes === archivo.size;

  const subir = async () => {
    setSubiendo(true);
    setError(null);
    setProgreso(0);
    try {
      const form = new FormData();
      form.append('archivo', archivo);
      await api.post(imp.endpoint, form, {
        onUploadProgress: (e) => setProgreso(e.total ? Math.round((e.loaded * 100) / e.total) : null),
      });
      onSubido();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo subir el archivo.'));
      setSubiendo(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !subiendo && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir {imp.nombre}</DialogTitle>
          <DialogDescription>Revisa el archivo antes de confirmar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="break-all font-medium">{archivo.name}</p>
            <p className="text-xs text-muted-foreground">{tamano(archivo.size)}</p>
          </div>

          {noParece && (
            <p className="flex items-start gap-2" style={{ color: '#d97706' }}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                El nombre no se parece al esperado ({imp.archivo}). Confirma que es el archivo correcto.
              </span>
            </p>
          )}
          {repetido && comp && (
            <p className="flex items-start gap-2" style={{ color: '#d97706' }}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Este mismo archivo (mismo nombre y tamaño) ya se cargó el {fechaHora(comp.finalizada_at)}
                {comp.usuario ? ` por ${comp.usuario}` : ''}.
              </span>
            </p>
          )}
          {imp.slug === 'colaboradores' && (
            <p className="text-muted-foreground">
              Los colaboradores que no aparezcan en este archivo quedarán inactivos.
            </p>
          )}

          {subiendo && (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progreso ?? 100}%`, backgroundColor: '#2563eb' }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progreso != null && progreso < 100 ? `Subiendo… ${progreso}%` : 'Archivo enviado, esperando confirmación…'}
              </p>
            </div>
          )}
          {error && <p className="text-red-600 dark:text-red-800">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={subiendo} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button disabled={subiendo} onClick={() => void subir()}>
            {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Historial ───────────────────────── */

function Historial({
  imports,
  recarga,
  onDescartes,
}: {
  imports: ImportFila[];
  recarga: number;
  onDescartes: (c: { id: number; titulo: string }) => void;
}) {
  const [datos, setDatos] = useState<Pagina<CargaHistorial> | null>(null);
  const [pagina, setPagina] = useState(1);
  const [filtroImport, setFiltroImport] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api
      .get<Pagina<CargaHistorial>>('/importaciones/historial', {
        params: { page: pagina, import: filtroImport || undefined, estado: filtroEstado || undefined },
      })
      .then(({ data }) => {
        if (!vigente) return;
        setDatos(data);
        setError(null);
      })
      .catch((e) => vigente && setError(mensajeError(e, 'No se pudo cargar el historial.')))
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
  }, [pagina, filtroImport, filtroEstado, recarga]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
          <History className="size-4" /> Historial de cargas
        </h3>
        <div className="flex flex-wrap gap-2">
          <select
            className={SELECT_CLASE + ' !w-auto'}
            value={filtroImport}
            onChange={(e) => {
              setFiltroImport(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos los imports</option>
            {imports.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.nombre}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASE + ' !w-auto'}
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="completada">Completadas</option>
            <option value="fallida">Fallidas</option>
            <option value="encolada">Procesando</option>
          </select>
        </div>
      </div>

      {error && <p className="px-4 pb-3 text-sm text-red-600 dark:text-red-800">{error}</p>}

      {!datos && cargando ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : datos && datos.data.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Aún no hay cargas registradas. Se registran desde esta versión en adelante.
        </p>
      ) : (
        <ul className="divide-y border-t">
          {datos?.data.map((c) => {
            const est = c.sin_confirmar ? { texto: 'Sin confirmar', color: '#d97706' } : ESTADO_CARGA[c.estado];
            return (
              <li key={c.id} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Etiqueta texto={est.texto} color={est.color} />
                  <span className="text-sm font-medium">{c.import_nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.usuario ?? 'Usuario eliminado'} · {fechaHora(c.subida_at)}
                    {duracion(c) ? ` · ${duracion(c)}` : ''}
                  </span>
                </div>
                <p className="break-all text-sm text-muted-foreground">
                  {c.archivo_nombre ?? 'Sin nombre de archivo'}
                  {c.archivo_bytes ? ` (${tamano(c.archivo_bytes)})` : ''}
                </p>
                {c.error && <p className="text-sm" style={{ color: '#dc2626' }}>{c.error}</p>}
                {c.descartadas ? (
                  <button
                    type="button"
                    className="text-xs underline underline-offset-2"
                    onClick={() => onDescartes({ id: c.id, titulo: `${c.import_nombre} · ${fechaHora(c.subida_at)}` })}
                  >
                    {c.descartadas} filas descartadas — ver detalle
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {datos && datos.last_page > 1 && (
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <Button variant="outline" size="sm" disabled={pagina <= 1 || cargando} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {datos.current_page} de {datos.last_page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= datos.last_page || cargando}
            onClick={() => setPagina(pagina + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Descartes de una carga ───────────────────────── */

function DialogDescartes({ carga, onCerrar }: { carga: { id: number; titulo: string }; onCerrar: () => void }) {
  const [datos, setDatos] = useState<{ total: number; data: Descarte[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api
      .get<{ total: number; data: Descarte[] }>(`/importaciones/cargas/${carga.id}/descartes`)
      .then(({ data }) => vigente && setDatos(data))
      .catch((e) => vigente && setError(mensajeError(e, 'No se pudo cargar el detalle.')));
    return () => {
      vigente = false;
    };
  }, [carga.id]);

  const texto = (valor: unknown): string => {
    if (valor == null || valor === '') return '—';
    return typeof valor === 'string' ? valor : JSON.stringify(valor);
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filas descartadas</DialogTitle>
          <DialogDescription>{carga.titulo}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-red-600 dark:text-red-800">{error}</p>}
        {!datos && !error && <Skeleton className="h-24 w-full" />}
        {datos && (
          <div className="space-y-2">
            {datos.total > datos.data.length && (
              <p className="text-xs text-muted-foreground">
                Mostrando las primeras {datos.data.length} de {datos.total}.
              </p>
            )}
            <ul className="divide-y rounded-md border">
              {datos.data.map((d) => (
                <li key={d.id} className="space-y-0.5 p-2 text-sm">
                  <p className="font-medium">{d.motivo}</p>
                  <p className="break-all text-xs text-muted-foreground">Valor buscado: {texto(d.valor_buscado)}</p>
                  {d.contexto != null && d.contexto !== '' && (
                    <p className="break-all text-xs text-muted-foreground">{texto(d.contexto)}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
