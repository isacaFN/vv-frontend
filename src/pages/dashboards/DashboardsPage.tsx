import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { DASHBOARDS } from '@/config/dashboards';

export default function DashboardsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();

  const tabsPermitidas = DASHBOARDS.filter((d) => tienePermiso(d.permiso));
  const activo = tabsPermitidas.find((t) => location.pathname.endsWith(t.value))?.value ?? tabsPermitidas[0]?.value;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboards</h1>
        <p className="text-sm text-muted-foreground">Indicadores operacionales</p>
      </div>

      <Tabs value={activo} onValueChange={(v) => navigate(`/dashboards/${v}`)}>
        <div className="relative min-w-0 flex-1">
          <TabsList
            style={{ width: '100%', maxWidth: '100%' }}
            className="h-auto justify-start gap-1 overflow-x-auto overscroll-x-contain rounded-lg border bg-card p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabsPermitidas.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="shrink-0 rounded-md px-3 py-1.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-end rounded-r-lg bg-gradient-to-l from-card to-transparent sm:hidden">
            <ChevronRight className="mr-0.5 size-3.5 text-muted-foreground" />
          </div>
        </div>
      </Tabs>

      <Outlet />
    </div>
  );
}

export function DashboardProximamente({ titulo }: { titulo: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
      {titulo} — próximamente
    </div>
  );
}

export function DashboardIndexRedirect() {
  const { tienePermiso } = useAuth();
  const primero = DASHBOARDS.find((d) => tienePermiso(d.permiso));
  return <Navigate to={primero ? primero.value : '/'} replace />;
}