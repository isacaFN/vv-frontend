import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import Login from '@/pages/Login';
import Inicio from '@/pages/Inicio';
import CambiarPassword from '@/pages/CambiarPassword';
import ColaboradoresList from '@/pages/colaboradores/ColaboradoresList';
import DashboardsPage, { DashboardIndexRedirect } from '@/pages/dashboards/DashboardsPage';
import HorasExtraInstalacionDashboard from '@/pages/dashboards/HorasExtraInstalacionDashboard';
import HorasExtraColaboradorDashboard from '@/pages/dashboards/HorasExtraColaboradorDashboard';
import RondasPage from '@/pages/dashboards/RondasPage';
import SupervisoresPage from '@/pages/dashboards/SupervisoresPage';
import FlotaDashboard from '@/pages/dashboards/FlotaDashboard';
import AtrasosDashboard from '@/pages/dashboards/AtrasosDashboard';
import AdministracionPage from '@/pages/admin/AdministracionPage';
import RrhhPage from '@/pages/rrhh/RrhhPage';
import { DASHBOARD_PERMISOS } from '@/config/dashboards';
import { ADMIN_PERMISOS } from '@/config/admin';
import { RRHH_PERMISOS } from '@/config/rrhh';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route path="/" element={<Inicio />} />
            <Route path="/colaboradores" element={<ColaboradoresList />} />
            <Route path="/cuenta/password" element={<CambiarPassword />} />

            <Route
              path="/dashboards"
              element={
                <ProtectedRoute permisos={DASHBOARD_PERMISOS}>
                  <DashboardsPage />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardIndexRedirect />} />

              <Route
                path="horas-extra-instalacion"
                element={
                  <ProtectedRoute permiso="dashboards.horas_extra_instalacion">
                    <HorasExtraInstalacionDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="horas-extra-colaborador"
                element={
                  <ProtectedRoute permiso="dashboards.horas_extra_colaborador">
                    <HorasExtraColaboradorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="rondas"
                element={
                  <ProtectedRoute permiso="dashboards.rondas">
                    <RondasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="gastos-supervisores"
                element={
                  <ProtectedRoute permiso="dashboards.gastos_supervisores">
                    <SupervisoresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="combustible-km"
                element={
                  <ProtectedRoute permiso="dashboards.combustible_km">
                    <FlotaDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="atrasos"
                element={
                  <ProtectedRoute permiso="dashboards.atrasos">
                    <AtrasosDashboard />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Panel de administración: visible con al menos uno de sus permisos; cada pestaña exige el suyo. */}
            <Route
              path="/administracion"
              element={
                <ProtectedRoute permisos={ADMIN_PERMISOS}>
                  <AdministracionPage />
                </ProtectedRoute>
              }
            />

            {/* RRHH: visible con rrhh.ver o rrhh.costos_hora_extra; el backend valida igual cada llamada. */}
            <Route
              path="/rrhh"
              element={
                <ProtectedRoute permisos={RRHH_PERMISOS}>
                  <RrhhPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
