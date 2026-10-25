import { useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { RRHH_INSTALACIONES_PERMISOS } from '@/config/rrhh';
import { VACACIONES_PERMISOS_VER } from '@/config/vacaciones';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InstalacionesRrhh from '@/pages/rrhh/InstalacionesRrhh';
import ContadorPendientes from '@/pages/rrhh/vacaciones/ContadorPendientes';
import PermisosVacaciones from '@/pages/rrhh/vacaciones/PermisosVacaciones';

// `permisos`: la pestaña se muestra si el usuario tiene AL MENOS uno. `Contador`: aviso opcional junto al título.
type Pestana = { value: string; label: string; permisos: string[]; Vista: ComponentType; Contador?: ComponentType };

// Para sumar una pestaña de RRHH: una entrada acá con su permiso.
const PESTANAS: Pestana[] = [
  { value: 'instalaciones', label: 'Instalaciones', permisos: RRHH_INSTALACIONES_PERMISOS, Vista: InstalacionesRrhh },
  { value: 'vacaciones', label: 'Permisos y Vacaciones', permisos: VACACIONES_PERMISOS_VER, Vista: PermisosVacaciones, Contador: ContadorPendientes },
];

const CLASE_TRIGGER =
  'rounded-md px-3 py-1.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';

export default function RrhhPage() {
  const { tieneAlgunPermiso } = useAuth();
  const visibles = PESTANAS.filter((p) => tieneAlgunPermiso(p.permisos));
  const [params] = useSearchParams();
  // Un enlace de correo (/rrhh?solicitud=ID) abre directo la pestaña de Permisos y Vacaciones.
  // Se decide una sola vez al entrar: la pantalla de vacaciones después limpia el parámetro de la URL.
  const [valor, setValor] = useState<string | null>(() => (params.has('solicitud') ? 'vacaciones' : null));

  const activa = visibles.find((p) => p.value === valor) ?? visibles[0];

  if (!activa) {
    return <p className="text-sm text-muted-foreground">No tienes permisos para ninguna sección de RRHH.</p>;
  }

  const Vista = activa.Vista;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="font-heading text-2xl font-semibold">RRHH</h1>
        <p className="text-sm text-muted-foreground">Módulo de recursos humanos</p>
      </div>

      <Tabs value={activa.value} onValueChange={setValor}>
        <TabsList className="h-auto gap-1 rounded-lg border bg-card p-1">
          {visibles.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className={CLASE_TRIGGER}>
              {p.label}
              {p.Contador && <p.Contador />}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Vista />
    </div>
  );
}
