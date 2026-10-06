import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Home, KeyRound, LayoutDashboard, LogOut, Settings, type LucideIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { DASHBOARD_PERMISOS } from '@/config/dashboards';
import { ADMIN_PERMISOS } from '@/config/admin';
import { RRHH_PERMISOS } from '@/config/rrhh';

// `permiso`: se exige ese permiso. `algunoDe`: basta con tener AL MENOS uno de la lista.
// Sin ninguno de los dos, el ítem es visible para cualquier usuario autenticado.
type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permiso?: string;
  algunoDe?: string[];
};

const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/dashboards', label: 'Dashboards', icon: LayoutDashboard, algunoDe: DASHBOARD_PERMISOS },
  { to: '/rrhh', label: 'RRHH', icon: Briefcase, algunoDe: RRHH_PERMISOS },
  { to: '/administracion', label: 'Administración', icon: Settings, algunoDe: ADMIN_PERMISOS },
];

// Los botones del pie usan los colores del sidebar (azul fijo, no cambia con el tema claro/oscuro).
// El "!" final fuerza la clase sobre las del variante "ghost" del botón (cn() no hace merge de Tailwind).
const BOTON_SIDEBAR =
  'text-sidebar-foreground! hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground!';

// Módulo en el que estoy: fondo más claro, texto en negrita, barra azul a la izquierda e ícono en ese mismo azul
// (--sidebar-primary) y más grueso. Se decide acá con `isActive` (no depende de los atributos internos de sidebar.tsx).
// "!" para ganar sobre las clases del botón.
const ITEM_ACTIVO =
  'bg-sidebar-accent! text-sidebar-accent-foreground! font-bold! shadow-[inset_3px_0_0_0_var(--sidebar-primary)] ' +
  '[&_svg]:text-sidebar-primary! [&_svg]:[stroke-width:2.5]';
// Inactivo: SIN fondo (bg-transparent!); solo se ilumina un poco al pasar el mouse.
const ITEM_INACTIVO =
  'bg-transparent! text-sidebar-foreground/80! hover:bg-sidebar-accent/60! hover:text-sidebar-accent-foreground!';

export function AppShell() {
  const { usuario, logout, tienePermiso, tieneAlgunPermiso } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // "Inicio" ('/') solo está activo en la ruta exacta; el resto, en su ruta y sus subrutas.
  const esActivo = (item: NavItem) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);

  const puedeVer = (item: NavItem) =>
    item.algunoDe ? tieneAlgunPermiso(item.algunoDe) : item.permiso ? tienePermiso(item.permiso) : true;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="font-heading text-lg font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              V&amp;V Operaciones
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2!">
                {NAV.filter(puedeVer).map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={esActivo(item)}
                      tooltip={item.label}
                      className={esActivo(item) ? ITEM_ACTIVO : ITEM_INACTIVO}
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="truncate text-sm text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
              {usuario?.name}
            </span>
            <div className="flex items-center group-data-[collapsible=icon]:flex-col">
              <Button
                variant="ghost"
                size="icon"
                className={BOTON_SIDEBAR}
                onClick={() => navigate('/cuenta/password')}
                title="Cambiar mi contraseña"
              >
                <KeyRound className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className={BOTON_SIDEBAR} onClick={() => logout()} title="Cerrar sesión">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-auto lg:p-6 p-2">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
