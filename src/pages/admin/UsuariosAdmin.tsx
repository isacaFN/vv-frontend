import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { History, Search, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { DOMINIO_CORREO } from '@/config/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';

/* ───────────────────────── Tipos (contrato de /usuarios) ───────────────────────── */

type UsuarioFila = {
  id: number;
  name: string;
  email: string;
  activo: boolean;
  last_login_at: string | null;
  must_change_password: boolean;
  created_at: string | null;
  colaborador: { id: number; nombre: string; documento: string | null } | null;
  permissions: string[];
};

type GrupoPermisos = {
  clave: string;
  etiqueta: string;
  permisos: { name: string; etiqueta: string; sensible: boolean }[];
};

type Movimiento = {
  id: number;
  accion: string;
  user_id: number | null;
  usuario: string | null;
  usuario_email: string | null;
  actor: string | null;
  detalle: Record<string, unknown> | null;
  created_at: string;
};

type Pagina<T> = { data: T[]; current_page: number; last_page: number; total: number };

type ColaboradorOpcion = { id: number; nombre: string; documento: string | null; cargo: string | null };

/* ───────────────────────── Helpers ───────────────────────── */

const TEXTO_ERROR = 'text-sm text-red-600 dark:text-red-400';

const SELECT_CLASE =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const PATRON_CORREO = new RegExp(`^[^@\\s]+@${DOMINIO_CORREO.replace(/\./g, '\\.')}$`, 'i');

function mensajeError(e: unknown, respaldo: string): string {
  if (isAxiosError(e)) {
    const errores = e.response?.data?.errors as Record<string, string[]> | undefined;
    const primero = errores ? Object.values(errores).flat()[0] : undefined;
    return primero ?? e.response?.data?.message ?? respaldo;
  }
  return respaldo;
}

/** Timestamp real (ISO UTC) -> hora local del navegador. */
function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

/** Minúsculas y sin tildes, para buscar sin que importe cómo se escribió. */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ETIQUETA_ACCION: Record<string, string> = {
  creado: 'Cuenta creada',
  editado: 'Datos editados',
  inhabilitado: 'Inhabilitado',
  habilitado: 'Habilitado',
  password_restablecida: 'Contraseña restablecida',
  password_cambiada: 'Cambió su contraseña',
  sesiones_cerradas: 'Sesiones cerradas',
  permisos_modificados: 'Permisos modificados',
  colaborador_vinculado: 'Colaborador vinculado',
  colaborador_desvinculado: 'Colaborador desvinculado',
};

type Etiquetas = Record<string, string>;

/** Texto legible de lo que cambió en un movimiento del historial. */
function describir(m: Movimiento, etiquetas: Etiquetas): string {
  const d = (m.detalle ?? {}) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? (v as string[]).map((n) => etiquetas[n] ?? n).join(', ') : '');

  switch (m.accion) {
    case 'creado': {
      const n = Array.isArray(d.permisos) ? d.permisos.length : 0;
      return n > 0 ? `Con ${n} permiso${n === 1 ? '' : 's'}: ${lista(d.permisos)}` : 'Sin permisos asignados';
    }
    case 'editado': {
      const a = (d.antes ?? {}) as { name?: string; email?: string };
      const b = (d.despues ?? {}) as { name?: string; email?: string };
      const partes: string[] = [];
      if (a.name !== b.name) partes.push(`Nombre: ${a.name} → ${b.name}`);
      if (a.email !== b.email) partes.push(`Correo: ${a.email} → ${b.email}`);
      return partes.join(' · ');
    }
    case 'permisos_modificados': {
      const partes: string[] = [];
      if (Array.isArray(d.agregados) && d.agregados.length) partes.push(`Agregó: ${lista(d.agregados)}`);
      if (Array.isArray(d.quitados) && d.quitados.length) partes.push(`Quitó: ${lista(d.quitados)}`);
      const origen = d.copiados_de as { name?: string } | null | undefined;
      if (origen?.name) partes.push(`(copiados de ${origen.name})`);
      return partes.join(' · ');
    }
    case 'sesiones_cerradas':
      return `${String(d.cerradas ?? 0)} sesión(es) abierta(s)`;
    case 'colaborador_vinculado':
    case 'colaborador_desvinculado': {
      const c = (d.colaborador ?? {}) as { nombre?: string; documento?: string | null };
      return c.nombre ? `${c.nombre}${c.documento ? ` (${c.documento})` : ''}` : '';
    }
    default:
      return '';
  }
}

function EstadoBadge({ u }: { u: Pick<UsuarioFila, 'activo' | 'must_change_password'> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {u.activo ? (
        <Badge variant="outline" className="border-green-600/40 text-green-700 dark:text-green-400">
          Activo
        </Badge>
      ) : (
        <Badge variant="destructive">Inhabilitado</Badge>
      )}
      {u.must_change_password && (
        <Badge variant="outline" className="text-muted-foreground">
          Contraseña temporal
        </Badge>
      )}
    </span>
  );
}

/** Botón de dos pasos: el primer clic pide confirmar, así no se ejecuta algo delicado por error. */
function BotonConfirmar({
  texto,
  pregunta,
  onConfirmar,
  disabled,
  motivoDeshabilitado,
  variant = 'outline',
}: {
  texto: string;
  pregunta: string;
  onConfirmar: () => void | Promise<void>;
  disabled?: boolean;
  motivoDeshabilitado?: string;
  variant?: 'outline' | 'destructive';
}) {
  const [armado, setArmado] = useState(false);

  if (!armado) {
    return (
      <span title={disabled ? motivoDeshabilitado : undefined}>
        <Button size="sm" variant={variant} disabled={disabled} onClick={() => setArmado(true)}>
          {texto}
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-sm">
      {pregunta}
      <Button
        size="sm"
        variant={variant}
        onClick={async () => {
          setArmado(false);
          await onConfirmar();
        }}
      >
        Sí, continuar
      </Button>
      <Button size="sm" variant="outline" onClick={() => setArmado(false)}>
        Cancelar
      </Button>
    </span>
  );
}

/* ───────────────────────── Pestaña Usuarios ───────────────────────── */

export default function UsuariosAdmin() {
  const isMobile = useIsMobile();
  const { usuario: yo } = useAuth();

  const [vista, setVista] = useState<'usuarios' | 'historial'>('usuarios');
  const [usuarios, setUsuarios] = useState<UsuarioFila[] | null>(null);
  const [catalogo, setCatalogo] = useState<GrupoPermisos[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState<'todos' | 'activos' | 'inhabilitados' | 'sin_ingresar'>('todos');

  const [creando, setCreando] = useState(false);
  const [creado, setCreado] = useState<{ usuario: UsuarioFila; password: string } | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api
      .get<UsuarioFila[]>('/usuarios')
      .then((res) => {
        if (!vigente) return;
        setUsuarios(res.data);
        setError(null);
      })
      .catch((e) => vigente && setError(mensajeError(e, 'No se pudo cargar la lista de usuarios.')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [recarga]);

  useEffect(() => {
    let vigente = true;
    api
      .get<GrupoPermisos[]>('/usuarios/catalogo-permisos')
      .then((res) => vigente && setCatalogo(res.data))
      .catch(() => undefined); // sin catálogo no hay nombres legibles, pero la lista sigue sirviendo
    return () => {
      vigente = false;
    };
  }, []);

  const etiquetas = useMemo<Etiquetas>(() => {
    const mapa: Etiquetas = {};
    for (const g of catalogo) for (const p of g.permisos) mapa[p.name] = p.etiqueta;
    return mapa;
  }, [catalogo]);

  const filtrados = useMemo(() => {
    const q = normalizar(buscar.trim());
    return (usuarios ?? []).filter((u) => {
      if (q && !normalizar(`${u.name} ${u.email}`).includes(q)) return false;
      if (estado === 'activos') return u.activo;
      if (estado === 'inhabilitados') return !u.activo;
      if (estado === 'sin_ingresar') return u.last_login_at === null;
      return true;
    });
  }, [usuarios, buscar, estado]);

  const seleccionado = detalleId === null ? null : (usuarios?.find((u) => u.id === detalleId) ?? null);

  function hecho(mensaje: string) {
    setAviso(mensaje);
    setRecarga((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant={vista === 'usuarios' ? 'default' : 'outline'} onClick={() => setVista('usuarios')}>
            Usuarios
          </Button>
          <Button size="sm" variant={vista === 'historial' ? 'default' : 'outline'} onClick={() => setVista('historial')}>
            <History className="mr-1 h-4 w-4" /> Historial de cambios
          </Button>
        </div>
        {vista === 'usuarios' && (
          <Button size="sm" onClick={() => setCreando(true)}>
            <UserPlus className="mr-1 h-4 w-4" /> Nuevo usuario
          </Button>
        )}
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
          <span>{aviso}</span>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setAviso(null)}>
            Cerrar
          </button>
        </div>
      )}

      {vista === 'historial' ? (
        <HistorialUsuarios etiquetas={etiquetas} recarga={recarga} isMobile={isMobile} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-56 flex-1 space-y-1 sm:max-w-sm">
              <span className="text-xs text-muted-foreground">Buscar</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Nombre o correo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              </span>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Estado</span>
              <select className={`${SELECT_CLASE} block`} value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inhabilitados">Inhabilitados</option>
                <option value="sin_ingresar">Nunca han ingresado</option>
              </select>
            </label>
            {usuarios && (
              <p className="pb-2 text-xs text-muted-foreground">
                {filtrados.length} de {usuarios.length} usuarios
              </p>
            )}
          </div>

          {error && <p className={TEXTO_ERROR}>{error}</p>}

          {cargando && !usuarios ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay usuarios con ese filtro.</p>
          ) : isMobile ? (
            <div className="space-y-2">
              {filtrados.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setDetalleId(u.id)}
                  className="w-full space-y-1 rounded-md border p-3 text-left"
                >
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <EstadoBadge u={u} />
                  <p className="text-xs text-muted-foreground">
                    Último ingreso: {u.last_login_at ? fechaHora(u.last_login_at) : 'Nunca ha ingresado'} · {u.permissions.length} permisos
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último ingreso</TableHead>
                    <TableHead className="text-right">Permisos</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((u) => (
                    <TableRow key={u.id} className="cursor-pointer" onClick={() => setDetalleId(u.id)}>
                      <TableCell className="whitespace-normal font-medium">
                        {u.name}
                        {yo?.id === u.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(tú)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <EstadoBadge u={u} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {u.last_login_at ? fechaHora(u.last_login_at) : <span className="text-muted-foreground">Nunca ha ingresado</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.permissions.length}</TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">{u.colaborador?.nombre ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetalleId(u.id);
                          }}
                        >
                          Gestionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {creando && (
        <DialogNuevo
          onClose={() => setCreando(false)}
          onCreado={(usuario, password) => {
            setCreando(false);
            setCreado({ usuario, password });
            setRecarga((n) => n + 1);
          }}
        />
      )}

      {creado && (
        <Dialog open onOpenChange={(abierto) => !abierto && setCreado(null)}>
          <DialogContent style={{ maxWidth: 'min(32rem, calc(100% - 2rem))' }}>
            <DialogHeader>
              <DialogTitle>Usuario creado</DialogTitle>
              <DialogDescription>{creado.usuario.name} ({creado.usuario.email})</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p>
                Contraseña temporal: <span className="rounded bg-muted px-2 py-0.5 font-mono">{creado.password}</span>
              </p>
              <p className="text-muted-foreground">
                En su primer ingreso el sistema le pedirá elegir una contraseña propia. Todavía no tiene permisos: asígnalos para que pueda ver algo.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreado(null)}>
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  setDetalleId(creado.usuario.id);
                  setCreado(null);
                }}
              >
                Asignar permisos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {seleccionado && (
        <DialogUsuario
          usuario={seleccionado}
          todos={usuarios ?? []}
          catalogo={catalogo}
          etiquetas={etiquetas}
          esYo={yo?.id === seleccionado.id}
          onClose={() => setDetalleId(null)}
          onHecho={hecho}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Diálogo: nuevo usuario ───────────────────────── */

function DialogNuevo({ onClose, onCreado }: { onClose: () => void; onCreado: (u: UsuarioFila, password: string) => void }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre es obligatorio.');
    if (!correo.trim()) return setError('El correo es obligatorio.');
    if (!PATRON_CORREO.test(correo.trim())) {
      return setError(`El correo no pertenece a la empresa: debe terminar en @${DOMINIO_CORREO}.`);
    }

    setError(null);
    setEnviando(true);
    try {
      const res = await api.post<UsuarioFila & { password_temporal: string }>('/usuarios', {
        name: nombre.trim(),
        email: correo.trim().toLowerCase(),
      });
      onCreado(res.data, res.data.password_temporal);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear el usuario.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !enviando && onClose()}>
      <DialogContent style={{ maxWidth: 'min(32rem, calc(100% - 2rem))' }}>
        <form onSubmit={enviar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              Se crea con una contraseña temporal y deberá cambiarla en su primer ingreso.
            </DialogDescription>
          </DialogHeader>

          <label className="block space-y-1">
            <span className="text-sm">Nombre completo</span>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={255} autoFocus />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Correo corporativo</span>
            <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder={`nombre@${DOMINIO_CORREO}`} maxLength={255} />
          </label>

          {error && <p className={TEXTO_ERROR}>{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Creando...' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Diálogo: gestionar un usuario ───────────────────────── */

type Seccion = 'permisos' | 'cuenta' | 'historial';

function DialogUsuario({
  usuario,
  todos,
  catalogo,
  etiquetas,
  esYo,
  onClose,
  onHecho,
}: {
  usuario: UsuarioFila;
  todos: UsuarioFila[];
  catalogo: GrupoPermisos[];
  etiquetas: Etiquetas;
  esYo: boolean;
  onClose: () => void;
  onHecho: (mensaje: string) => void;
}) {
  const [seccion, setSeccion] = useState<Seccion>('permisos');

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" style={{ maxWidth: 'min(52rem, calc(100% - 2rem))' }}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {usuario.name}
            <EstadoBadge u={usuario} />
          </DialogTitle>
          <DialogDescription>
            {usuario.email} · Último ingreso: {usuario.last_login_at ? fechaHora(usuario.last_login_at) : 'nunca ha ingresado'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['permisos', 'Permisos'],
              ['cuenta', 'Cuenta'],
              ['historial', 'Historial'],
            ] as [Seccion, string][]
          ).map(([clave, texto]) => (
            <Button key={clave} size="sm" variant={seccion === clave ? 'default' : 'outline'} onClick={() => setSeccion(clave)}>
              {texto}
            </Button>
          ))}
        </div>

        {seccion === 'permisos' && (
          <SeccionPermisos
            key={[...usuario.permissions].sort().join('|')}
            usuario={usuario}
            todos={todos}
            catalogo={catalogo}
            esYo={esYo}
            onHecho={onHecho}
          />
        )}
        {seccion === 'cuenta' && <SeccionCuenta usuario={usuario} esYo={esYo} onHecho={onHecho} />}
        {seccion === 'historial' && <HistorialUsuarios userId={usuario.id} etiquetas={etiquetas} recarga={0} isMobile />}
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Sección: permisos ───────────────────────── */

function SeccionPermisos({
  usuario,
  todos,
  catalogo,
  esYo,
  onHecho,
}: {
  usuario: UsuarioFila;
  todos: UsuarioFila[];
  catalogo: GrupoPermisos[];
  esYo: boolean;
  onHecho: (mensaje: string) => void;
}) {
  // El padre monta esta sección con key = permisos del servidor: al confirmarse un cambio, el
  // borrador se reinicia solo.
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(usuario.permissions));
  const [copiadoDe, setCopiadoDe] = useState<UsuarioFila | null>(null);
  const [origenId, setOrigenId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const actuales = useMemo(() => new Set(usuario.permissions), [usuario.permissions]);
  const agregados = [...marcados].filter((p) => !actuales.has(p));
  const quitados = [...actuales].filter((p) => !marcados.has(p));
  const hayCambios = agregados.length > 0 || quitados.length > 0;

  // Lo que está en la base y no en el catálogo igual se muestra (el servidor lo agrupa en "Otros").
  const totalCatalogo = catalogo.reduce((n, g) => n + g.permisos.length, 0);

  function alternar(nombre: string) {
    setMarcados((prev) => {
      const sig = new Set(prev);
      if (sig.has(nombre)) sig.delete(nombre);
      else sig.add(nombre);
      return sig;
    });
  }

  function marcarGrupo(g: GrupoPermisos, valor: boolean) {
    setMarcados((prev) => {
      const sig = new Set(prev);
      for (const p of g.permisos) {
        if (esYo && p.name === 'usuarios.gestionar') continue; // no puede quitárselo a sí mismo
        if (valor) sig.add(p.name);
        else sig.delete(p.name);
      }
      return sig;
    });
  }

  function copiar() {
    const origen = todos.find((u) => String(u.id) === origenId);
    if (!origen) return;
    const nuevo = new Set(origen.permissions);
    // Quien se edita a sí mismo no puede perder su permiso de administrar.
    if (esYo && actuales.has('usuarios.gestionar')) nuevo.add('usuarios.gestionar');
    setMarcados(nuevo);
    setCopiadoDe(origen);
  }

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await api.put(`/usuarios/${usuario.id}/permisos`, {
        permissions: [...marcados],
        copiados_de: copiadoDe?.id ?? null,
      });
      onHecho(`Permisos de ${usuario.name} actualizados (${agregados.length} agregados, ${quitados.length} quitados).`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron guardar los permisos.'));
    } finally {
      setGuardando(false);
    }
  }

  const otros = todos.filter((u) => u.id !== usuario.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <label className="min-w-56 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Copiar permisos de otro usuario</span>
          <select className={`${SELECT_CLASE} w-full`} value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
            <option value="">Elige un usuario…</option>
            {otros.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.permissions.length} permisos)
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" variant="outline" disabled={!origenId} onClick={copiar}>
          Copiar al borrador
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Reemplaza lo marcado abajo por los permisos del usuario elegido. No se guarda hasta que pulses “Guardar cambios”.
        </p>
      </div>

      {copiadoDe && (
        <p className="text-sm text-muted-foreground">Borrador copiado de {copiadoDe.name}. Puedes ajustarlo antes de guardar.</p>
      )}

      {totalCatalogo === 0 ? (
        <p className="text-sm text-muted-foreground">No se pudo cargar el catálogo de permisos.</p>
      ) : (
        <div className="space-y-4">
          {catalogo.map((g) => {
            const activos = g.permisos.filter((p) => marcados.has(p.name)).length;
            return (
              <fieldset key={g.clave} className="rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">
                  {g.etiqueta}{' '}
                  <span className="font-normal text-muted-foreground">
                    ({activos}/{g.permisos.length})
                  </span>
                </legend>
                <div className="mb-2 flex gap-3 text-xs">
                  <button type="button" className="text-primary hover:underline" onClick={() => marcarGrupo(g, true)}>
                    Marcar todos
                  </button>
                  <button type="button" className="text-primary hover:underline" onClick={() => marcarGrupo(g, false)}>
                    Quitar todos
                  </button>
                </div>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {g.permisos.map((p) => {
                    const bloqueado = esYo && p.name === 'usuarios.gestionar';
                    return (
                      <li key={p.name}>
                        <label
                          className={`flex items-start gap-2 rounded px-1 py-0.5 text-sm ${bloqueado ? 'opacity-70' : 'cursor-pointer hover:bg-muted/50'}`}
                          title={bloqueado ? 'No puedes quitarte a ti mismo este permiso' : p.name}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4"
                            checked={marcados.has(p.name)}
                            disabled={bloqueado}
                            onChange={() => alternar(p.name)}
                          />
                          <span>
                            {p.etiqueta}
                            {p.sensible && (
                              <Badge variant="outline" className="ml-2 align-middle text-[10px]">
                                Sensible
                              </Badge>
                            )}
                            {actuales.has(p.name) !== marcados.has(p.name) && (
                              <span className="ml-2 text-xs text-primary">{marcados.has(p.name) ? '+ se agrega' : '− se quita'}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>
      )}

      {error && <p className={TEXTO_ERROR}>{error}</p>}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-background pt-3">
        <p className="text-sm text-muted-foreground">
          {hayCambios ? `Cambios sin guardar: ${agregados.length} por agregar, ${quitados.length} por quitar.` : 'Sin cambios.'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!hayCambios || guardando}
            onClick={() => {
              setMarcados(new Set(usuario.permissions));
              setCopiadoDe(null);
            }}
          >
            Descartar
          </Button>
          <Button disabled={!hayCambios || guardando} onClick={() => void guardar()}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Sección: cuenta ───────────────────────── */

function SeccionCuenta({ usuario, esYo, onHecho }: { usuario: UsuarioFila; esYo: boolean; onHecho: (mensaje: string) => void }) {
  const [nombre, setNombre] = useState(usuario.name);
  const [correo, setCorreo] = useState(usuario.email);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);

  const cambiosDatos = nombre.trim() !== usuario.name || correo.trim().toLowerCase() !== usuario.email;

  async function guardarDatos(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setErrorDatos('El nombre es obligatorio.');
    if (correo.trim().toLowerCase() !== usuario.email && !PATRON_CORREO.test(correo.trim())) {
      return setErrorDatos(`El correo no pertenece a la empresa: debe terminar en @${DOMINIO_CORREO}.`);
    }
    setErrorDatos(null);
    setGuardando(true);
    try {
      await api.put(`/usuarios/${usuario.id}`, { name: nombre.trim(), email: correo.trim().toLowerCase() });
      onHecho(`Datos de ${nombre.trim()} actualizados.`);
    } catch (err) {
      setErrorDatos(mensajeError(err, 'No se pudieron guardar los datos.'));
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutar(accion: () => Promise<string>) {
    setErrorAccion(null);
    setPasswordTemporal(null);
    try {
      onHecho(await accion());
    } catch (err) {
      setErrorAccion(mensajeError(err, 'No se pudo completar la acción.'));
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={guardarDatos} className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-medium">Datos de la cuenta</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Nombre</span>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={255} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Correo</span>
            <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} maxLength={255} />
          </label>
        </div>
        {errorDatos && <p className={TEXTO_ERROR}>{errorDatos}</p>}
        <Button type="submit" size="sm" disabled={!cambiosDatos || guardando}>
          {guardando ? 'Guardando...' : 'Guardar datos'}
        </Button>
      </form>

      <SeccionColaborador usuario={usuario} onHecho={onHecho} />

      <div className="space-y-3 rounded-md border p-3">
        <h3 className="text-sm font-medium">Acceso</h3>
        <div className="flex flex-wrap items-center gap-2">
          {usuario.activo ? (
            <BotonConfirmar
              texto="Inhabilitar"
              pregunta={`¿Inhabilitar a ${usuario.name}? Se cerrarán sus sesiones.`}
              variant="destructive"
              disabled={esYo}
              motivoDeshabilitado="No puedes inhabilitar tu propia cuenta"
              onConfirmar={() =>
                ejecutar(async () => {
                  await api.patch(`/usuarios/${usuario.id}/estado`, { activo: false });
                  return `${usuario.name} fue inhabilitado.`;
                })
              }
            />
          ) : (
            <BotonConfirmar
              texto="Habilitar"
              pregunta={`¿Habilitar a ${usuario.name}?`}
              onConfirmar={() =>
                ejecutar(async () => {
                  await api.patch(`/usuarios/${usuario.id}/estado`, { activo: true });
                  return `${usuario.name} fue habilitado.`;
                })
              }
            />
          )}
          <BotonConfirmar
            texto="Restablecer contraseña"
            pregunta="¿Volver a la contraseña temporal? Tendrá que cambiarla al ingresar."
            disabled={esYo}
            motivoDeshabilitado='Para cambiar tu contraseña usa "Cambiar mi contraseña"'
            onConfirmar={async () => {
              setErrorAccion(null);
              try {
                const res = await api.post<{ password_temporal: string }>(`/usuarios/${usuario.id}/restablecer-password`);
                onHecho(`Contraseña de ${usuario.name} restablecida.`);
                setPasswordTemporal(res.data.password_temporal);
              } catch (err) {
                setErrorAccion(mensajeError(err, 'No se pudo restablecer la contraseña.'));
              }
            }}
          />
          <BotonConfirmar
            texto="Cerrar sesiones"
            pregunta="¿Cerrar todas sus sesiones abiertas?"
            disabled={esYo}
            motivoDeshabilitado='Para cerrar tu sesión usa "Salir"'
            onConfirmar={() =>
              ejecutar(async () => {
                const res = await api.post<{ cerradas: number }>(`/usuarios/${usuario.id}/cerrar-sesiones`);
                return `Se cerraron ${res.data.cerradas} sesión(es) de ${usuario.name}.`;
              })
            }
          />
        </div>
        {esYo && <p className="text-xs text-muted-foreground">Esta es tu cuenta: por seguridad no puedes inhabilitarla ni restablecerla desde aquí.</p>}
        {passwordTemporal && (
          <p className="text-sm">
            Contraseña temporal: <span className="rounded bg-muted px-2 py-0.5 font-mono">{passwordTemporal}</span>{' '}
            <span className="text-muted-foreground">Deberá cambiarla al ingresar.</span>
          </p>
        )}
        {errorAccion && <p className={TEXTO_ERROR}>{errorAccion}</p>}
      </div>
    </div>
  );
}

function SeccionColaborador({ usuario, onHecho }: { usuario: UsuarioFila; onHecho: (mensaje: string) => void }) {
  const [q, setQ] = useState('');
  const [opciones, setOpciones] = useState<ColaboradorOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setOpciones([]);
      return;
    }
    let vigente = true;
    setBuscando(true);
    // Pequeña espera para no consultar en cada tecla.
    const espera = setTimeout(() => {
      api
        .get<ColaboradorOpcion[]>('/usuarios/colaboradores', { params: { q: q.trim(), user_id: usuario.id } })
        .then((res) => vigente && setOpciones(res.data))
        .catch(() => vigente && setOpciones([]))
        .finally(() => vigente && setBuscando(false));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [q, usuario.id]);

  async function vincular(colaboradorId: number | null, mensaje: string) {
    setError(null);
    try {
      await api.put(`/usuarios/${usuario.id}/colaborador`, { colaborador_id: colaboradorId });
      setQ('');
      setOpciones([]);
      onHecho(mensaje);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo actualizar el vínculo.'));
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-medium">Colaborador vinculado</h3>
      {usuario.colaborador ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {usuario.colaborador.nombre}
            {usuario.colaborador.documento && <span className="text-muted-foreground"> · RUT {usuario.colaborador.documento}</span>}
          </span>
          <BotonConfirmar
            texto="Desvincular"
            pregunta="¿Quitar el vínculo?"
            onConfirmar={() => vincular(null, `Se quitó el colaborador vinculado a ${usuario.name}.`)}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Esta cuenta no está vinculada a ninguna ficha de colaborador.</p>
      )}

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">{usuario.colaborador ? 'Cambiar por otro colaborador' : 'Buscar colaborador (nombre, apellido o RUT)'}</span>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe al menos 2 letras" />
      </label>
      {buscando && <p className="text-xs text-muted-foreground">Buscando…</p>}
      {opciones.length > 0 && (
        <ul className="divide-y rounded-md border">
          {opciones.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {c.nombre}
                <span className="text-muted-foreground">
                  {c.documento ? ` · ${c.documento}` : ''}
                  {c.cargo ? ` · ${c.cargo}` : ''}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => void vincular(c.id, `${usuario.name} quedó vinculado a ${c.nombre}.`)}>
                Vincular
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!buscando && q.trim().length >= 2 && opciones.length === 0 && (
        <p className="text-xs text-muted-foreground">Sin resultados (solo aparecen colaboradores activos que no estén vinculados a otra cuenta).</p>
      )}
      {error && <p className={TEXTO_ERROR}>{error}</p>}
    </div>
  );
}

/* ───────────────────────── Historial (general o de un usuario) ───────────────────────── */

function HistorialUsuarios({
  userId,
  etiquetas,
  recarga,
  isMobile,
}: {
  userId?: number;
  etiquetas: Etiquetas;
  recarga: number;
  isMobile: boolean;
}) {
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<Pagina<Movimiento> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api
      .get<Pagina<Movimiento>>('/usuarios/historial', { params: { page: pagina, user_id: userId } })
      .then((res) => {
        if (!vigente) return;
        setDatos(res.data);
        setError(null);
      })
      .catch((e) => vigente && setError(mensajeError(e, 'No se pudo cargar el historial.')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [pagina, userId, recarga]);

  const nav: ReactNode = datos && datos.last_page > 1 && (
    <div className="flex items-center justify-between gap-2 pt-2 text-sm">
      <Button size="sm" variant="outline" disabled={pagina <= 1 || cargando} onClick={() => setPagina((p) => p - 1)}>
        Anterior
      </Button>
      <span className="text-muted-foreground">
        Página {datos.current_page} de {datos.last_page} · {datos.total} movimientos
      </span>
      <Button size="sm" variant="outline" disabled={pagina >= datos.last_page || cargando} onClick={() => setPagina((p) => p + 1)}>
        Siguiente
      </Button>
    </div>
  );

  if (error) return <p className={TEXTO_ERROR}>{error}</p>;
  if (cargando && !datos) return <Skeleton className="h-32 w-full" />;
  if (!datos || datos.data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay cambios registrados.</p>;
  }

  return (
    <div className={cargando ? 'opacity-60' : undefined}>
      {isMobile ? (
        <ul className="space-y-2">
          {datos.data.map((m) => (
            <li key={m.id} className="space-y-0.5 rounded-md border p-3 text-sm">
              <p className="font-medium">{ETIQUETA_ACCION[m.accion] ?? m.accion}</p>
              {!userId && <p className="text-xs text-muted-foreground">{m.usuario} ({m.usuario_email})</p>}
              <p className="text-xs text-muted-foreground">
                {fechaHora(m.created_at)} · por {m.actor ?? '—'}
              </p>
              {describir(m, etiquetas) && <p className="text-xs">{describir(m, etiquetas)}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Quién lo hizo</TableHead>
                <TableHead>Usuario afectado</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">{fechaHora(m.created_at)}</TableCell>
                  <TableCell className="whitespace-normal">{m.actor ?? '—'}</TableCell>
                  <TableCell className="whitespace-normal">
                    {m.usuario}
                    <span className="block text-xs text-muted-foreground">{m.usuario_email}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{ETIQUETA_ACCION[m.accion] ?? m.accion}</TableCell>
                  <TableCell className="min-w-48 whitespace-normal text-muted-foreground">{describir(m, etiquetas) || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {nav}
    </div>
  );
}
