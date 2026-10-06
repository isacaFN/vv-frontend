import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PERMISO_SUPERVISORES_DIAGNOSTICO } from '@/config/dashboards';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SupervisoresDashboard from './SupervisoresDashboard';
import SupervisoresDiagnostico from './SupervisoresDiagnostico';
import { ATAJOS, type Rango } from './supervisoresUtil';

type Vista = 'resumen' | 'diagnostico';

const CLASE_TRIGGER =
  'rounded-md px-3 py-1.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm';

/**
 * Contenedor del dashboard de supervisores. La sub-pestaña interna de diagnóstico solo existe
 * con el permiso PERMISO_SUPERVISORES_DIAGNOSTICO. El rango vive acá para que no se pierda al
 * cambiar de pestaña.
 */
export default function SupervisoresPage() {
  const { tienePermiso } = useAuth();
  const puedeDiagnosticar = tienePermiso(PERMISO_SUPERVISORES_DIAGNOSTICO);

  const [vista, setVista] = useState<Vista>('resumen');
  const [rango, setRango] = useState<Rango>(() => ATAJOS[0].rango());

  // Si el permiso se pierde con el diagnóstico abierto, se vuelve al resumen.
  const vistaActiva: Vista = puedeDiagnosticar ? vista : 'resumen';

  return (
    <div className="space-y-6 overflow-x-hidden">
      {puedeDiagnosticar && (
        <Tabs value={vistaActiva} onValueChange={(v) => setVista(v as Vista)}>
          <TabsList className="h-auto gap-1 rounded-lg border bg-card p-1">
            <TabsTrigger value="resumen" className={CLASE_TRIGGER}>
              Resumen
            </TabsTrigger>
            <TabsTrigger value="diagnostico" className={CLASE_TRIGGER}>
              Diagnóstico (interno)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {vistaActiva === 'resumen' ? (
        <SupervisoresDashboard rango={rango} onRango={setRango} />
      ) : (
        <SupervisoresDiagnostico rango={rango} onRango={setRango} />
      )}
    </div>
  );
}
