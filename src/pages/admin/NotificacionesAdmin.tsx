import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { AlertTriangle, ChevronDown, ChevronUp, Mail, Plus, RefreshCw, RotateCcw, Save, Send, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/* ───────────────────────── Tipos (lo que devuelve /api/notificaciones) ───────────────────────── */

type Evento = {
  clave: string;
  etiqueta: string;
  cuando: string;
  solicitante: 'nunca' | 'opcional';
  nota_solicitante: string | null;
  guardado: boolean;
  actualizado_en: string | null;
  actualizado_por: string | null;
  por_defecto: { asunto: string; mensaje: string };
  activo: boolean;
  destinatarios: string[];
  incluir_solicitante: boolean;
  asunto: string;
  mensaje: string;
};

type Variable = { clave: string; etiqueta: string; ejemplo: string | null };

type Panel = {
  eventos: Evento[];
  variables: Variable[];
  reply_to: string | null;
  dominio: string;
  limites: { asunto: number; mensaje: number; destinatarios: number };
  pie: string;
  envio: { real: boolean; mailer: string; remitente: string | null };
};

type Borrador = {
  activo: boolean;
  destinatarios: string[];
  incluir_solicitante: boolean;
  asunto: string;
  mensaje: string;
};

type Envio = {
  id: number;
  evento: string;
  evento_etiqueta: string;
  folio: string | null;
  destinatario: string;
  asunto: string;
  resultado: 'enviado' | 'fallido' | 'omitido' | 'simulado';
  detalle: string | null;
  resend_id: string | null;
  es_prueba: boolean;
  created_at: string | null;
};

type ListaEnvios = { envios: Envio[]; pagina: number; paginas: number; total: number };

type CambioHistorial = {
  id: number;
  evento_etiqueta: string;
  user_nombre: string;
  campos: string[];
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
  created_at: string | null;
};

type Aviso = { clave: string; ok: boolean; texto: string };

/* ───────────────────────── Utilidades ───────────────────────── */

const CLASE_TRIGGER =
  'rounded-md px-3 py-1.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';
const CLASE_CAMPO =
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50';
const CLASE_SELECT =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const CLASE_ERROR = 'text-sm text-destructive';

const CLASE_RESULTADO: Record<Envio['resultado'], string> = {
  enviado: 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400',
  simulado: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  omitido: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  fallido: 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400',
};

function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Santiago' });
}

/** Mensaje general + errores por campo (el backend responde 422 con { message, errors }). */
function leerError(e: unknown, defecto: string): { general: string; campos: Record<string, string> } {
  if (!isAxiosError(e)) return { general: defecto, campos: {} };
  const d = e.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
  const campos: Record<string, string> = {};
  for (const [clave, mensajes] of Object.entries(d?.errors ?? {})) {
    const base = clave.split('.')[0] ?? clave;
    if (!(base in campos) && mensajes[0]) campos[base] = mensajes[0];
  }
  const primero = Object.values(campos)[0];
  return { general: primero ?? d?.message ?? defecto, campos };
}

function variablesDesconocidas(texto: string, validas: Set<string>): string[] {
  const malas = new Set<string>();
  for (const m of texto.matchAll(/\{(\w+)\}/g)) {
    const nombre = m[1];
    if (nombre && !validas.has(nombre)) malas.add(nombre);
  }
  return [...malas];
}

const mismoBorrador = (a: Borrador, b: Borrador) =>
  a.activo === b.activo &&
  a.incluir_solicitante === b.incluir_solicitante &&
  a.asunto === b.asunto &&
  a.mensaje === b.mensaje &&
  [...a.destinatarios].sort().join('|') === [...b.destinatarios].sort().join('|');

/* ───────────────────────── Pantalla ───────────────────────── */

type Vista = 'avisos' | 'envios' | 'historial';

export default function NotificacionesAdmin() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('avisos');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await api.get<Panel>('/notificaciones');
      setPanel(res.data);
      setError(null);
    } catch (e) {
      setError(leerError(e, 'No se pudo cargar la configuración de notificaciones.').general);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Notificaciones por correo</h2>
        <p className="text-sm text-muted-foreground">
          Elige a quién le llega el aviso de cada paso de Permisos y Vacaciones y qué dice el correo.
        </p>
      </div>

      {error && <p className={CLASE_ERROR}>{error}</p>}

      {panel && !panel.envio.real && (
        <div role="status" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            El envío real todavía no está activado en el servidor (modo «{panel.envio.mailer}»): los correos se procesan pero <strong>no salen a internet</strong>.
            Se activa configurando Resend en las variables del servidor.
          </span>
        </div>
      )}

      <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
        <TabsList className="h-auto gap-1 rounded-lg border bg-card p-1">
          <TabsTrigger value="avisos" className={CLASE_TRIGGER}>Avisos</TabsTrigger>
          <TabsTrigger value="envios" className={CLASE_TRIGGER}>Envíos</TabsTrigger>
          <TabsTrigger value="historial" className={CLASE_TRIGGER}>Historial de cambios</TabsTrigger>
        </TabsList>
      </Tabs>

      {vista === 'avisos' &&
        (!panel ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {panel.eventos.map((e) => (
              <TarjetaEvento
                key={e.clave + (e.actualizado_en ?? '')}
                evento={e}
                panel={panel}
                abierto={abierto === e.clave}
                onToggle={() => setAbierto((a) => (a === e.clave ? null : e.clave))}
                aviso={aviso?.clave === e.clave ? aviso : null}
                avisar={(ok, texto) => setAviso({ clave: e.clave, ok, texto })}
                onGuardado={cargar}
              />
            ))}
            <TarjetaReplyTo panel={panel} onGuardado={cargar} />
          </div>
        ))}

      {vista === 'envios' && <Envios eventos={panel?.eventos ?? []} />}
      {vista === 'historial' && <Historial />}
    </div>
  );
}

/* ───────────────────────── Un aviso (editor) ───────────────────────── */

function TarjetaEvento({
  evento: e,
  panel,
  abierto,
  onToggle,
  aviso,
  avisar,
  onGuardado,
}: {
  evento: Evento;
  panel: Panel;
  abierto: boolean;
  onToggle: () => void;
  aviso: Aviso | null;
  avisar: (ok: boolean, texto: string) => void;
  onGuardado: () => Promise<void>;
}) {
  const inicial = useMemo<Borrador>(
    () => ({ activo: e.activo, destinatarios: [...e.destinatarios], incluir_solicitante: e.incluir_solicitante, asunto: e.asunto, mensaje: e.mensaje }),
    [e],
  );
  const [b, setB] = useState<Borrador>(inicial);
  const [correo, setCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const asuntoRef = useRef<HTMLInputElement>(null);
  const mensajeRef = useRef<HTMLTextAreaElement>(null);
  const foco = useRef<'asunto' | 'mensaje'>('mensaje');

  const sucio = !mismoBorrador(b, inicial);
  const validas = useMemo(() => new Set(panel.variables.map((v) => v.clave)), [panel.variables]);
  const malas = useMemo(
    () => [...new Set([...variablesDesconocidas(b.asunto, validas), ...variablesDesconocidas(b.mensaje, validas)])],
    [b.asunto, b.mensaje, validas],
  );
  const sufijo = `@${panel.dominio}`;

  function agregarCorreos(texto: string) {
    const trozos = texto.split(/[\s,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (trozos.length === 0) return;
    const nuevos: string[] = [];
    const malos: string[] = [];
    for (const t of trozos) {
      const valido = t.split('@').length === 2 && t.endsWith(sufijo) && t.length > sufijo.length && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
      if (!valido) malos.push(t);
      else if (!b.destinatarios.includes(t) && !nuevos.includes(t)) nuevos.push(t);
    }
    if (malos.length > 0) {
      setErrorCorreo(`No son correos válidos de la empresa (deben terminar en ${sufijo}): ${malos.join(', ')}`);
      return;
    }
    if (b.destinatarios.length + nuevos.length > panel.limites.destinatarios) {
      setErrorCorreo(`Máximo ${panel.limites.destinatarios} destinatarios por aviso.`);
      return;
    }
    setB((x) => ({ ...x, destinatarios: [...x.destinatarios, ...nuevos] }));
    setCorreo('');
    setErrorCorreo(null);
  }

  function insertarVariable(clave: string) {
    const token = `{${clave}}`;
    const donde = foco.current;
    const el = donde === 'asunto' ? asuntoRef.current : mensajeRef.current;
    const campo = donde === 'asunto' ? 'asunto' : 'mensaje';
    const actual = b[campo];
    const ini = el?.selectionStart ?? actual.length;
    const fin = el?.selectionEnd ?? actual.length;
    setB((x) => ({ ...x, [campo]: actual.slice(0, ini) + token + actual.slice(fin) }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(ini + token.length, ini + token.length);
    });
  }

  async function guardar() {
    setErrores({});
    if (b.activo && b.destinatarios.length === 0 && !b.incluir_solicitante) {
      setErrores({ destinatarios: 'Un aviso activo necesita al menos un destinatario (o incluir a quien hizo la solicitud). Agrega un correo o apaga el aviso.' });
      return;
    }
    setGuardando(true);
    try {
      const res = await api.put<{ mensaje: string }>(`/notificaciones/eventos/${e.clave}`, b);
      avisar(true, res.data.mensaje);
      await onGuardado();
    } catch (err) {
      const { general, campos } = leerError(err, 'No se pudieron guardar los cambios.');
      setErrores(campos);
      avisar(false, general);
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    try {
      const res = await api.post<{ ok: boolean; mensaje: string }>(`/notificaciones/eventos/${e.clave}/prueba`, { asunto: b.asunto, mensaje: b.mensaje });
      avisar(res.data.ok, res.data.mensaje);
    } catch (err) {
      avisar(false, leerError(err, 'No se pudo mandar la prueba.').general);
    } finally {
      setProbando(false);
    }
  }

  const ejemplos = useMemo(() => {
    const m: Record<string, string> = {};
    for (const v of panel.variables) m[v.clave] = v.ejemplo ?? '';
    m.enlace = `${window.location.origin}/rrhh?solicitud=123`;
    return m;
  }, [panel.variables]);
  const previa = (t: string) => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in ejemplos ? (ejemplos[k] ?? '') : m));

  const cantidad = e.destinatarios.length;

  return (
    <div className="rounded-lg border bg-card">
      <button type="button" onClick={onToggle} aria-expanded={abierto} className="flex w-full items-center gap-3 p-4 text-left">
        <Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{e.etiqueta}</span>
          <span className="block text-xs text-muted-foreground">{e.cuando}</span>
        </span>
        <span className="hidden text-xs text-muted-foreground sm:block">
          {cantidad} {cantidad === 1 ? 'correo' : 'correos'}
          {e.incluir_solicitante ? ' + solicitante' : ''}
        </span>
        <Badge variant="outline" className={e.activo ? CLASE_RESULTADO.enviado : CLASE_RESULTADO.omitido}>
          {e.activo ? 'Activo' : 'Apagado'}
        </Badge>
        {abierto ? <ChevronUp className="size-4 shrink-0" aria-hidden="true" /> : <ChevronDown className="size-4 shrink-0" aria-hidden="true" />}
      </button>

      {abierto && (
        <div className="space-y-5 border-t p-4">
          {!e.guardado && (
            <p className="text-sm text-muted-foreground">
              Este aviso todavía no se ha configurado: usa el texto de partida y está apagado. Agrega destinatarios, revisa el texto y actívalo.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4" checked={b.activo} onChange={(ev) => setB((x) => ({ ...x, activo: ev.target.checked }))} />
            Aviso activo
          </label>

          {/* Destinatarios */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Destinatarios</p>
            <div className="flex flex-wrap gap-2">
              {b.destinatarios.length === 0 && <span className="text-sm text-muted-foreground">Ninguno todavía.</span>}
              {b.destinatarios.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs">
                  {c}
                  <button
                    type="button"
                    aria-label={`Quitar ${c}`}
                    className="rounded-full p-0.5 hover:bg-background"
                    onClick={() => setB((x) => ({ ...x, destinatarios: x.destinatarios.filter((d) => d !== c) }))}
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-[220px] flex-1 sm:max-w-sm"
                type="text"
                inputMode="email"
                placeholder={`correo${sufijo}`}
                value={correo}
                onChange={(ev) => setCorreo(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ',') {
                    ev.preventDefault();
                    agregarCorreos(correo);
                  }
                }}
                onPaste={(ev) => {
                  const texto = ev.clipboardData.getData('text');
                  if (/[\s,;]/.test(texto.trim())) {
                    ev.preventDefault();
                    agregarCorreos(texto);
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => agregarCorreos(correo)} disabled={!correo.trim()}>
                <Plus className="size-4" /> Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Solo correos {sufijo}. Cada persona recibe su propio correo; no ve las direcciones de las demás.</p>
            {(errorCorreo || errores.destinatarios) && <p className={CLASE_ERROR}>{errorCorreo ?? errores.destinatarios}</p>}
          </div>

          {/* Quien hizo la solicitud */}
          {e.solicitante === 'opcional' ? (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={b.incluir_solicitante}
                  onChange={(ev) => setB((x) => ({ ...x, incluir_solicitante: ev.target.checked }))}
                />
                Incluir a quien hizo la solicitud
              </label>
              <p className="text-xs text-muted-foreground">
                {e.nota_solicitante ?? 'Se le avisa a su correo de usuario, salvo que haya sido esa misma persona quien hizo la acción.'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{e.nota_solicitante ?? 'A quien hizo la solicitud no se le avisa en este paso.'}</p>
          )}

          {/* Texto */}
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                El correo no es un canal seguro. Los avisos llevan el tipo de permiso, nunca las fechas; no agregues datos sensibles (salud, diagnósticos,
                datos personales) al texto. En los rechazos viaja el comentario de quien rechazó.
              </span>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Asunto</span>
              <input
                ref={asuntoRef}
                className={CLASE_CAMPO}
                maxLength={panel.limites.asunto}
                value={b.asunto}
                onFocus={() => (foco.current = 'asunto')}
                onChange={(ev) => setB((x) => ({ ...x, asunto: ev.target.value }))}
              />
              {errores.asunto && <span className={CLASE_ERROR}>{errores.asunto}</span>}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Mensaje</span>
              <textarea
                ref={mensajeRef}
                rows={9}
                className={CLASE_CAMPO}
                maxLength={panel.limites.mensaje}
                value={b.mensaje}
                onFocus={() => (foco.current = 'mensaje')}
                onChange={(ev) => setB((x) => ({ ...x, mensaje: ev.target.value }))}
              />
              <span className="block text-right text-xs text-muted-foreground">
                {b.mensaje.length} / {panel.limites.mensaje}
              </span>
              {errores.mensaje && <span className={CLASE_ERROR}>{errores.mensaje}</span>}
            </label>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Toca una variable para insertarla donde tienes el cursor (asunto o mensaje):</p>
              <div className="flex flex-wrap gap-1.5">
                {panel.variables.map((v) => (
                  <button
                    key={v.clave}
                    type="button"
                    title={v.etiqueta}
                    onClick={() => insertarVariable(v.clave)}
                    className="rounded-md border bg-muted px-2 py-1 font-mono text-xs hover:bg-accent"
                  >
                    {`{${v.clave}}`}
                  </button>
                ))}
              </div>
            </div>

            {malas.length > 0 && (
              <p className={CLASE_ERROR}>Hay variables que no existen: {malas.map((m) => `{${m}}`).join(', ')}. Corrígelas para poder guardar.</p>
            )}
          </div>

          {/* Vista previa */}
          <div className="space-y-1">
            <p className="text-sm font-medium">Así se verá (con datos de ejemplo)</p>
            <div className="space-y-2 rounded-md border bg-background p-3 text-sm">
              <p className="font-medium">{previa(b.asunto).replace(/\s+/g, ' ').trim() || '(sin asunto)'}</p>
              <p className="whitespace-pre-wrap break-words">{previa(b.mensaje)}</p>
              <p className="border-t pt-2 text-xs text-muted-foreground">{panel.pie}</p>
            </div>
          </div>

          {aviso && (
            <p role="status" className={aviso.ok ? 'text-sm text-green-700 dark:text-green-400' : CLASE_ERROR}>
              {aviso.texto}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={guardar} disabled={!sucio || guardando || malas.length > 0}>
              <Save className="size-4" /> {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setB(inicial); setErrores({}); setErrorCorreo(null); }} disabled={!sucio || guardando}>
              Descartar
            </Button>
            <Button type="button" variant="outline" onClick={probar} disabled={probando || malas.length > 0}>
              <Send className="size-4" /> {probando ? 'Enviando…' : 'Enviarme una prueba'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setB((x) => ({ ...x, asunto: e.por_defecto.asunto, mensaje: e.por_defecto.mensaje }))}
              disabled={b.asunto === e.por_defecto.asunto && b.mensaje === e.por_defecto.mensaje}
            >
              <RotateCcw className="size-4" /> Volver al texto original
            </Button>
            {sucio && <span className="text-xs text-muted-foreground">Hay cambios sin guardar.</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            La prueba se manda a tu propio correo con el texto que ves ahora (aunque no lo hayas guardado).
            {e.actualizado_en && <> Última modificación: {fechaHora(e.actualizado_en)}{e.actualizado_por ? ` por ${e.actualizado_por}` : ''}.</>}
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Correo de respuesta (Reply-To) ───────────────────────── */

function TarjetaReplyTo({ panel, onGuardado }: { panel: Panel; onGuardado: () => Promise<void> }) {
  const [valor, setValor] = useState(panel.reply_to ?? '');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const sucio = valor.trim().toLowerCase() !== (panel.reply_to ?? '');

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await api.put<{ mensaje: string }>('/notificaciones/ajustes', { reply_to: valor.trim() === '' ? null : valor.trim() });
      setMensaje({ ok: true, texto: res.data.mensaje });
      await onGuardado();
    } catch (err) {
      setMensaje({ ok: false, texto: leerError(err, 'No se pudo guardar.').general });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <p className="font-medium">Correo de respuesta (opcional)</p>
      <p className="text-xs text-muted-foreground">
        Los correos salen de {panel.envio.remitente ?? 'una dirección que no recibe respuestas'} y dicen que no se respondan. Si dejas esto vacío, nadie puede
        responderlos. Si pones un correo (por ejemplo, el de RRHH), la respuesta de quien igual conteste llegará ahí.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-[220px] flex-1 sm:max-w-sm"
          type="email"
          placeholder={`(vacío)  rrhh@${panel.dominio}`}
          value={valor}
          onChange={(ev) => setValor(ev.target.value)}
        />
        <Button type="button" onClick={guardar} disabled={!sucio || guardando}>
          <Save className="size-4" /> {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
      {mensaje && <p role="status" className={mensaje.ok ? 'text-sm text-green-700 dark:text-green-400' : CLASE_ERROR}>{mensaje.texto}</p>}
    </div>
  );
}

/* ───────────────────────── Registro de envíos ───────────────────────── */

function Envios({ eventos }: { eventos: Evento[] }) {
  const [evento, setEvento] = useState('');
  const [resultado, setResultado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<ListaEnvios | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api
      .get<ListaEnvios>('/notificaciones/envios', { params: { evento: evento || undefined, resultado: resultado || undefined, page: pagina } })
      .then((res) => {
        if (!vigente) return;
        setDatos(res.data);
        setError(null);
      })
      .catch((e) => vigente && setError(leerError(e, 'No se pudo cargar el registro de envíos.').general))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [evento, resultado, pagina, recarga]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={CLASE_SELECT} value={evento} onChange={(e) => { setEvento(e.target.value); setPagina(1); }}>
          <option value="">Todos los avisos</option>
          {eventos.map((e) => (
            <option key={e.clave} value={e.clave}>{e.etiqueta}</option>
          ))}
        </select>
        <select className={CLASE_SELECT} value={resultado} onChange={(e) => { setResultado(e.target.value); setPagina(1); }}>
          <option value="">Todos los resultados</option>
          <option value="enviado">Enviado</option>
          <option value="fallido">Fallido</option>
          <option value="omitido">Omitido</option>
          <option value="simulado">Simulado (modo de prueba)</option>
        </select>
        <Button type="button" variant="outline" onClick={() => setRecarga((n) => n + 1)}>
          <RefreshCw className="size-4" /> Actualizar
        </Button>
        {datos && <span className="text-sm text-muted-foreground">{datos.total} en total</span>}
      </div>

      {error && <p className={CLASE_ERROR}>{error}</p>}

      {cargando && !datos ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : datos && datos.envios.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay envíos con ese filtro.</p>
      ) : (
        datos && (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Aviso</TableHead>
                  <TableHead>Solicitud</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.envios.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="whitespace-nowrap text-sm">{fechaHora(x.created_at)}</TableCell>
                    <TableCell className="text-sm">
                      {x.evento_etiqueta}
                      {x.es_prueba && <Badge variant="outline" className="ml-2">Prueba</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{x.folio ?? '—'}</TableCell>
                    <TableCell className="text-sm">{x.destinatario}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CLASE_RESULTADO[x.resultado]}>{x.resultado}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                      <span className="line-clamp-2 break-words" title={x.detalle ?? undefined}>{x.detalle ?? (x.resend_id ? `Id Resend: ${x.resend_id}` : '—')}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {datos && datos.paginas > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pagina <= 1 || cargando} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {datos.pagina} de {datos.paginas}</span>
          <Button type="button" variant="outline" size="sm" disabled={pagina >= datos.paginas || cargando} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Historial de cambios ───────────────────────── */

function valorTexto(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(vacío)';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) return v.length === 0 ? '(ninguno)' : v.join(', ');
  return String(v);
}

const ETIQUETA_CAMPO: Record<string, string> = {
  activo: 'Activo',
  destinatarios: 'Destinatarios',
  incluir_solicitante: 'Incluir a quien hizo la solicitud',
  asunto: 'Asunto',
  mensaje: 'Mensaje',
  reply_to: 'Correo de respuesta',
};

function Historial() {
  const [filas, setFilas] = useState<CambioHistorial[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api
      .get<{ historial: CambioHistorial[] }>('/notificaciones/historial')
      .then((res) => vigente && setFilas(res.data.historial))
      .catch((e) => vigente && setError(leerError(e, 'No se pudo cargar el historial.').general));
    return () => {
      vigente = false;
    };
  }, []);

  if (error) return <p className={CLASE_ERROR}>{error}</p>;
  if (!filas) return <Skeleton className="h-24 w-full" />;
  if (filas.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Todavía no se ha cambiado nada.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Últimos {filas.length} cambios. El historial no se puede editar ni borrar.</p>
      {filas.map((h) => (
        <details key={h.id} className="rounded-md border bg-card p-3 text-sm">
          <summary className="cursor-pointer">
            <span className="font-medium">{h.evento_etiqueta}</span>
            <span className="text-muted-foreground"> · {fechaHora(h.created_at)} · {h.user_nombre}</span>
            <span className="block text-xs text-muted-foreground">Cambió: {h.campos.join(', ') || '—'}</span>
          </summary>
          <div className="mt-3 space-y-3">
            {Object.keys(h.despues)
              .filter((campo) => JSON.stringify(h.antes[campo] ?? null) !== JSON.stringify(h.despues[campo] ?? null))
              .map((campo) => (
                <div key={campo} className="space-y-1">
                  <p className="text-xs font-medium">{ETIQUETA_CAMPO[campo] ?? campo}</p>
                  <p className="whitespace-pre-wrap break-words rounded bg-red-500/10 p-2 text-xs">Antes: {valorTexto(h.antes[campo])}</p>
                  <p className="whitespace-pre-wrap break-words rounded bg-green-500/10 p-2 text-xs">Después: {valorTexto(h.despues[campo])}</p>
                </div>
              ))}
          </div>
        </details>
      ))}
    </div>
  );
}
