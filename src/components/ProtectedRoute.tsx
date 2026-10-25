import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import CambiarPassword from '@/pages/CambiarPassword';
import { loginConVolver } from '@/lib/volver';
import type { ReactNode } from 'react';

export function ProtectedRoute({
  children,
  permiso,
  permisos,
}: {
  children: ReactNode;
  permiso?: string;
  permisos?: string[];
}) {
  const { usuario, cargando, salidaVoluntaria, tienePermiso, tieneAlgunPermiso } = useAuth();
  const location = useLocation();

  if (cargando) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  if (!usuario) {
    // Sin sesión: al login, recordando a dónde iba (p. ej. el enlace de un correo) para volver después de entrar.
    // Si la persona salió a propósito, no se recuerda nada.
    const destino = salidaVoluntaria ? '/login' : loginConVolver(location.pathname + location.search + location.hash);
    return <Navigate to={destino} replace />;
  }

  // Contraseña temporal: no se ve nada del sistema hasta cambiarla.
  if (usuario.must_change_password) return <CambiarPassword forzado />;

  const sinAcceso =
    (permiso && !tienePermiso(permiso)) || (permisos && !tieneAlgunPermiso(permisos));

  if (sinAcceso) {
    return <div className="p-8 text-center text-destructive">No tienes permiso para ver esta sección.</div>;
  }

  return <>{children}</>;
}
