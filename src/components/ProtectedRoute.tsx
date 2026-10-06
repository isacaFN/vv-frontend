import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import CambiarPassword from '@/pages/CambiarPassword';
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
  const { usuario, cargando, tienePermiso, tieneAlgunPermiso } = useAuth();

  if (cargando) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  if (!usuario) return <Navigate to="/login" replace />;

  // Contraseña temporal: no se ve nada del sistema hasta cambiarla.
  if (usuario.must_change_password) return <CambiarPassword forzado />;

  const sinAcceso =
    (permiso && !tienePermiso(permiso)) || (permisos && !tieneAlgunPermiso(permisos));

  if (sinAcceso) {
    return <div className="p-8 text-center text-destructive">No tienes permiso para ver esta sección.</div>;
  }

  return <>{children}</>;
}
