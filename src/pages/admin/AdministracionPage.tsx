import { useState, type ComponentType } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  PERMISOS_IMPORTACIONES,
  PERMISO_ADMIN_ASIGNACIONES,
  PERMISO_ADMIN_COMBUSTIBLE,
  PERMISO_ADMIN_RESPONSABLES,
  PERMISO_ADMIN_USUARIOS,
} from '@/config/admin';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AsignacionesAdmin from '@/pages/admin/AsignacionesAdmin';
import CombustibleAdmin from '@/pages/admin/CombustibleAdmin';
import ImportacionesAdmin from '@/pages/admin/ImportacionesAdmin';
import ResponsablesAdmin from '@/pages/admin/ResponsablesAdmin';
import UsuariosAdmin from '@/pages/admin/UsuariosAdmin';

// `permisos`: la pestaña se muestra si el usuario tiene AL MENOS uno.
type Pestana = { value: string; label: string; permisos: string[]; Vista: ComponentType };

// Para sumar una pestaña: una entrada acá con su permiso. Solo se muestran las
// que el usuario puede usar.
const PESTANAS: Pestana[] = [
  { value: 'importaciones', label: 'Importaciones', permisos: PERMISOS_IMPORTACIONES, Vista: ImportacionesAdmin },
  { value: 'combustible', label: 'Combustible', permisos: [PERMISO_ADMIN_COMBUSTIBLE], Vista: CombustibleAdmin },
  { value: 'asignaciones', label: 'Asignación de móviles', permisos: [PERMISO_ADMIN_ASIGNACIONES], Vista: AsignacionesAdmin },
  { value: 'responsables', label: 'Responsables', permisos: [PERMISO_ADMIN_RESPONSABLES], Vista: ResponsablesAdmin },
  { value: 'usuarios', label: 'Usuarios', permisos: [PERMISO_ADMIN_USUARIOS], Vista: UsuariosAdmin },
];

const CLASE_TRIGGER =
  'rounded-md px-3 py-1.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';

export default function AdministracionPage() {
  const { tieneAlgunPermiso } = useAuth();
  const visibles = PESTANAS.filter((p) => tieneAlgunPermiso(p.permisos));
  const [valor, setValor] = useState<string | null>(null);

  // Si la pestaña elegida deja de estar disponible (permiso perdido), cae a la primera.
  const activa = visibles.find((p) => p.value === valor) ?? visibles[0];

  if (!activa) {
    return <p className="text-sm text-muted-foreground">No tienes permisos para ninguna sección de administración.</p>;
  }

  const Vista = activa.Vista;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Importaciones, combustible, asignación de móviles, responsables de instalación y usuarios.
        </p>
      </div>

      <Tabs value={activa.value} onValueChange={setValor}>
        <TabsList className="h-auto gap-1 rounded-lg border bg-card p-1">
          {visibles.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className={CLASE_TRIGGER}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Vista />
    </div>
  );
}
