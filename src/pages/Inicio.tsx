import { Briefcase, LayoutDashboard, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DASHBOARD_PERMISOS } from '@/config/dashboards';
import { RRHH_PERMISOS } from '@/config/rrhh';

// Tarjetas informativas (sin enlaces). Cada una aparece solo si el usuario tiene AL MENOS un permiso del módulo,
// los mismos que usa el sidebar. Para sumar una descripción nueva: una entrada acá.
type Modulo = { titulo: string; descripcion: string; icon: LucideIcon; algunoDe: string[] };

const MODULOS: Modulo[] = [
  {
    titulo: 'Dashboards',
    descripcion:
      'Visualiza el estado de la operación con indicadores clave: horas extra, rondas, visitas de supervisores, flota y atrasos.',
    icon: LayoutDashboard,
    algunoDe: DASHBOARD_PERMISOS,
  },
  {
    titulo: 'RRHH',
    descripcion:
      'Consulta las instalaciones activas y define el costos.',
    icon: Briefcase,
    algunoDe: RRHH_PERMISOS,
  },
];

/** "ISAAC CACERES" -> "Isaac" (los nombres suelen venir en mayúsculas). */
function primerNombre(nombre: string | undefined): string {
  const primero = (nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return primero ? primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase() : '';
}

export default function Inicio() {
  const { usuario, tieneAlgunPermiso } = useAuth();
  const modulos = MODULOS.filter((m) => tieneAlgunPermiso(m.algunoDe));
  const nombre = primerNombre(usuario?.name);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-2 sm:p-0">
      {/* Banner de bienvenida (mismo azul del sidebar y del login) */}
      <section
        className="overflow-hidden rounded-2xl px-6 py-10 text-white shadow-md sm:px-10 sm:py-14"
        style={{
          backgroundColor: '#051a3d',
          backgroundImage:
            'radial-gradient(ellipse at 85% 20%, rgba(37, 99, 235, 0.35) 0%, rgba(11, 44, 107, 0.55) 40%, rgba(5, 26, 61, 0) 75%), linear-gradient(135deg, #0b2c6b 0%, #051a3d 60%, #020b1c 100%)',
        }}
      >
        <h1 className="font-heading text-4xl sm:text-5xl">
          <span className="font-light">Hola, </span>
          <span className="font-bold">{nombre || 'bienvenido'}</span>
        </h1>
        <p className="mt-6 max-w-xl text-xl font-medium leading-snug sm:text-2xl">
          Todo lo que necesitas para monitorear y tomar decisiones, en un solo lugar.
        </p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
          Centraliza la información de tus operaciones y accede a cada módulo desde el menú lateral.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-3 font-heading text-xl font-semibold">
          <span aria-hidden="true" className="h-0.5 w-6 rounded bg-primary" />
          Centro de operaciones
        </h2>

        {modulos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tu cuenta todavía no tiene módulos habilitados. Pide a un administrador que te asigne permisos.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {modulos.map((m) => (
              <article key={m.titulo} className="min-w-0 rounded-xl border bg-card p-6 shadow-sm">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <m.icon className="size-6" />
                </div>
                <h3 className="font-heading text-lg font-semibold">{m.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.descripcion}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
