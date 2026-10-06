import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PERMISO_RONDAS_EDITAR } from '@/config/dashboards';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RondasDashboard from '@/pages/dashboards/RondasDashboard';
import RondasEditorCuotas from '@/pages/dashboards/RondasEditorCuotas';

type Vista = 'resumen' | 'editor';

// Contenedor de la pestaña "Rondas": subpestañas Resumen | Editor de cuotas.
// Quien no tiene el permiso de edición ve solo el resumen, sin subpestañas.
export default function RondasPage() {
  const { tienePermiso } = useAuth();
  const puedeEditar = tienePermiso(PERMISO_RONDAS_EDITAR);
  const [vista, setVista] = useState<Vista>('resumen');

  // Si el permiso se pierde con el editor abierto, se vuelve al resumen.
  const vistaActiva: Vista = puedeEditar ? vista : 'resumen';

  return (
    <div className="space-y-6 overflow-x-hidden">
      {puedeEditar && (
        <Tabs value={vistaActiva} onValueChange={(v) => setVista(v as Vista)}>
          <TabsList className="h-auto gap-1 rounded-lg border bg-card p-1">
            <TabsTrigger
              value="resumen"
              className="rounded-md px-3 py-1.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              Resumen
            </TabsTrigger>
            <TabsTrigger
              value="editor"
              className="rounded-md px-3 py-1.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              Editor de cuotas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Se monta una sola vista a la vez: al volver al resumen se recargan los datos y reflejan las cuotas editadas. */}
      {vistaActiva === 'resumen' ? <RondasDashboard /> : <RondasEditorCuotas />}
    </div>
  );
}
