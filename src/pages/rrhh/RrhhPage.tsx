import { useState, type ComponentType } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RRHH_PERMISOS } from '@/config/rrhh';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InstalacionesRrhh from '@/pages/rrhh/InstalacionesRrhh';

// `permisos`: la pestaña se muestra si el usuario tiene AL MENOS uno.
type Pestana = { value: string; label: string; permisos: string[]; Vista: ComponentType };

// Para sumar una pestaña de RRHH: una entrada acá con su permiso.
const PESTANAS: Pestana[] = [{ value: 'instalaciones', label: 'Instalaciones', permisos: RRHH_PERMISOS, Vista: InstalacionesRrhh }];

const CLASE_TRIGGER =
  'rounded-md px-3 py-1.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';

export default function RrhhPage() {
  const { tieneAlgunPermiso } = useAuth();
  const visibles = PESTANAS.filter((p) => tieneAlgunPermiso(p.permisos));
  const [valor, setValor] = useState<string | null>(null);

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
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Vista />
    </div>
  );
}
