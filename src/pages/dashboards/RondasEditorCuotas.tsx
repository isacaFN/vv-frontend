import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatEntero } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';

/* ───────────────────────── Tipos ───────────────────────── */

type Cuota = { dia_semana: number; cantidad: number };
type CambioInfo = { usuario: string; fecha: string | null } | null;

type FilaEditor = {
  instalacion_id: number;
  instalacion_nombre: string;
  instalacion_cecos: string | null;
  tiene_cuota_configurada: boolean;
  cuotas: Cuota[];
  ultimo_cambio: CambioInfo;
};

type DatosGuardados = Pick<FilaEditor, 'cuotas' | 'tiene_cuota_configurada' | 'ultimo_cambio'>;
type AlGuardar = (instalacionId: number, datos: DatosGuardados) => void;

const DIAS = [
  { n: 1, label: 'Lunes', abrev: 'Lun', corto: 'L' },
  { n: 2, label: 'Martes', abrev: 'Mar', corto: 'M' },
  { n: 3, label: 'Miércoles', abrev: 'Mié', corto: 'X' },
  { n: 4, label: 'Jueves', abrev: 'Jue', corto: 'J' },
  { n: 5, label: 'Viernes', abrev: 'Vie', corto: 'V' },
  { n: 6, label: 'Sábado', abrev: 'Sáb', corto: 'S' },
  { n: 7, label: 'Domingo', abrev: 'Dom', corto: 'D' },
];

const MAX_CUOTA = 1000; // mismo tope que valida el backend
const TAMANO_PAGINA = 25;

function totalGuardado(fila: FilaEditor) {
  return fila.cuotas.reduce((suma, c) => suma + c.cantidad, 0);
}

function formatFechaHora(iso: string | null) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

/* ───────────────────────── Lógica de una fila (compartida por tabla y tarjeta) ───────────────────────── */

function useFilaCuotas(fila: FilaEditor, alGuardar: AlGuardar) {
  const guardadas = useMemo(
    () => Object.fromEntries(fila.cuotas.map((c) => [c.dia_semana, String(c.cantidad)])) as Record<number, string>,
    [fila.cuotas]
  );
  const [valores, setValores] = useState<Record<number, string>>(guardadas);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalido = DIAS.some((d) => {
    const v = valores[d.n] ?? '';
    return v === '' || Number(v) > MAX_CUOTA;
  });
  const modificado = DIAS.some((d) => (valores[d.n] ?? '') !== guardadas[d.n]);
  const total = DIAS.reduce((suma, d) => suma + (Number(valores[d.n]) || 0), 0);

  // Solo dígitos: sin signos, decimales ni letras.
  const cambiarValor = (dia: number, texto: string) => {
    setValores((prev) => ({ ...prev, [dia]: texto.replace(/\D/g, '').slice(0, 4) }));
  };

  const descartar = () => {
    setValores(guardadas);
    setError(null);
  };

  const guardar = () => {
    setGuardando(true);
    setError(null);
    api
      .put<DatosGuardados>(`/reportes/rondas/programadas/${fila.instalacion_id}`, {
        cuotas: DIAS.map((d) => ({ dia_semana: d.n, cantidad: Number(valores[d.n]) })),
      })
      .then((res) => alGuardar(fila.instalacion_id, res.data))
      .catch((e) => {
        const mensaje = isAxiosError(e) ? e.response?.data?.message : null;
        setError(mensaje ?? 'No se pudieron guardar las cuotas. Intenta de nuevo.');
      })
      .finally(() => setGuardando(false));
  };

  return { valores, cambiarValor, modificado, invalido, total, guardando, error, guardar, descartar };
}

function CampoDia({
  valor,
  onChange,
  etiqueta,
  ancho,
  invalido,
}: {
  valor: string;
  onChange: (texto: string) => void;
  etiqueta: string;
  ancho: number | string;
  invalido: boolean;
}) {
  // El ancho y el padding van inline: cn() del proyecto no hace merge de Tailwind,
  // así que w-14/px-1 no ganarían contra las clases base de Input.
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      aria-label={etiqueta}
      aria-invalid={invalido}
      style={{ width: ancho, paddingInline: 6, textAlign: 'center' }}
      className="tabular-nums"
    />
  );
}

function UltimoCambio({ fila }: { fila: FilaEditor }) {
  if (fila.ultimo_cambio) {
    return (
      <div className="min-w-0">
        <p className="truncate text-sm">{fila.ultimo_cambio.usuario}</p>
        <p className="text-xs text-muted-foreground">{formatFechaHora(fila.ultimo_cambio.fecha)}</p>
      </div>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">{fila.tiene_cuota_configurada ? 'Carga inicial' : 'Sin registro'}</p>
  );
}

/* ───────────────────────── Fila de tabla (desktop) ───────────────────────── */

function FilaTabla({ fila, alGuardar }: { fila: FilaEditor; alGuardar: AlGuardar }) {
  const f = useFilaCuotas(fila, alGuardar);

  return (
    <TableRow>
      <TableCell className="min-w-56">
        <p className="text-sm font-medium">{fila.instalacion_nombre}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{fila.instalacion_cecos ?? 'Sin CECOS'}</span>
          {totalGuardado(fila) === 0 && <Badge variant="outline">Sin cuota</Badge>}
        </div>
      </TableCell>
      {DIAS.map((d) => (
        <TableCell key={d.n} className="px-1.5">
          <CampoDia
            valor={f.valores[d.n] ?? ''}
            onChange={(t) => f.cambiarValor(d.n, t)}
            etiqueta={`${fila.instalacion_nombre} · ${d.label}`}
            ancho={56}
            invalido={(f.valores[d.n] ?? '') === ''}
          />
        </TableCell>
      ))}
      <TableCell className="text-right tabular-nums font-medium">{formatEntero(f.total)}</TableCell>
      <TableCell className="min-w-40">
        <UltimoCambio fila={fila} />
      </TableCell>
      <TableCell className="min-w-44">
        {f.modificado && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={f.guardar} disabled={f.invalido || f.guardando}>
              {f.guardando ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={f.descartar} disabled={f.guardando}>
              Descartar
            </Button>
          </div>
        )}
        {f.error && <p className="mt-1 text-xs text-red-600 dark:text-red-800">{f.error}</p>}
      </TableCell>
    </TableRow>
  );
}

/* ───────────────────────── Tarjeta (mobile) ───────────────────────── */

function TarjetaFila({ fila, alGuardar }: { fila: FilaEditor; alGuardar: AlGuardar }) {
  const f = useFilaCuotas(fila, alGuardar);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{fila.instalacion_nombre}</p>
          <p className="text-xs text-muted-foreground">{fila.instalacion_cecos ?? 'Sin CECOS'}</p>
        </div>
        {totalGuardado(fila) === 0 && <Badge variant="outline">Sin cuota</Badge>}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DIAS.map((d) => (
          <div key={d.n} className="min-w-0 text-center">
            <p className="mb-1 text-xs font-medium text-muted-foreground">{d.corto}</p>
            <CampoDia
              valor={f.valores[d.n] ?? ''}
              onChange={(t) => f.cambiarValor(d.n, t)}
              etiqueta={`${fila.instalacion_nombre} · ${d.label}`}
              ancho="100%"
              invalido={(f.valores[d.n] ?? '') === ''}
            />
          </div>
        ))}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total semanal</p>
          <p className="text-sm font-semibold tabular-nums">{formatEntero(f.total)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs text-muted-foreground">Último cambio</p>
          <UltimoCambio fila={fila} />
        </div>
      </div>

      {f.modificado && (
        <div className="flex gap-2">
          <Button size="sm" onClick={f.guardar} disabled={f.invalido || f.guardando}>
            {f.guardando ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={f.descartar} disabled={f.guardando}>
            Descartar
          </Button>
        </div>
      )}
      {f.error && <p className="text-xs text-red-600 dark:text-red-800">{f.error}</p>}
    </div>
  );
}

/* ───────────────────────── Pestaña completa ───────────────────────── */

export default function RondasEditorCuotas() {
  const isMobile = useIsMobile();
  const [filas, setFilas] = useState<FilaEditor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloSinCuota, setSoloSinCuota] = useState(false);
  const [cantidadVisible, setCantidadVisible] = useState(TAMANO_PAGINA);

  useEffect(() => {
    api
      .get<{ instalaciones: FilaEditor[] }>('/reportes/rondas/cuotas')
      .then((res) => setFilas(res.data.instalaciones))
      .catch(() => setErrorCarga('No se pudo cargar el listado de instalaciones.'))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    setCantidadVisible(TAMANO_PAGINA);
  }, [busqueda, soloSinCuota]);

  const alGuardar: AlGuardar = (instalacionId, datos) => {
    setFilas((prev) => prev.map((f) => (f.instalacion_id === instalacionId ? { ...f, ...datos } : f)));
  };

  const cantidadSinCuota = useMemo(() => filas.filter((f) => totalGuardado(f) === 0).length, [filas]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (soloSinCuota && totalGuardado(f) > 0) return false;
      if (!q) return true;
      return f.instalacion_nombre.toLowerCase().includes(q) || (f.instalacion_cecos ?? '').toLowerCase().includes(q);
    });
  }, [filas, busqueda, soloSinCuota]);

  const visibles = filtradas.slice(0, cantidadVisible);
  const hayMas = cantidadVisible < filtradas.length;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">Editor de cuotas</h2>
          <p className="text-sm text-muted-foreground">
            Rondas programadas por día de la semana de cada instalación activa. Con todos los días en 0, la instalación no
            exige rondas.
          </p>
        </div>
        <Badge variant="outline">{filas.length} instalaciones activas</Badge>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar instalación o CECOS..."
              className="pl-8"
            />
          </div>
          <Button
            variant={soloSinCuota ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSoloSinCuota((v) => !v)}
          >
            Solo sin cuota ({cantidadSinCuota})
          </Button>
        </div>

        {cargando ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : errorCarga ? (
          <p className="px-4 py-10 text-center text-sm text-red-600 dark:text-red-800">{errorCarga}</p>
        ) : visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {busqueda || soloSinCuota ? 'Sin resultados para el filtro actual.' : 'No hay instalaciones activas.'}
          </p>
        ) : isMobile ? (
          <div className="divide-y">
            {visibles.map((fila) => (
              <TarjetaFila key={fila.instalacion_id} fila={fila} alGuardar={alGuardar} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instalación</TableHead>
                  {DIAS.map((d) => (
                    <TableHead key={d.n} className="px-1.5 text-center" title={d.label}>
                      {d.abrev}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Último cambio</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((fila) => (
                  <FilaTabla key={fila.instalacion_id} fila={fila} alGuardar={alGuardar} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {hayMas && (
          <div className="border-t p-3 text-center">
            <Button variant="outline" size="sm" onClick={() => setCantidadVisible((n) => n + TAMANO_PAGINA)}>
              Cargar más ({filtradas.length - cantidadVisible} restantes)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
