export type DashboardDef = {
  value: string;
  label: string;
  permiso: string;
};

export const DASHBOARDS: DashboardDef[] = [
  { value: 'horas-extra-instalacion', label: 'Horas Extra por Instalación', permiso: 'dashboards.horas_extra_instalacion' },
  { value: 'horas-extra-colaborador', label: 'Horas Extra por Colaborador', permiso: 'dashboards.horas_extra_colaborador' },
  { value: 'rondas', label: 'Rondas', permiso: 'dashboards.rondas' },
  { value: 'gastos-supervisores', label: 'Gastos y visitas supervisores', permiso: 'dashboards.gastos_supervisores' },
  { value: 'combustible-km', label: 'Combustible y kilómetros de la flota', permiso: 'dashboards.combustible_km' },
  { value: 'atrasos', label: 'Atrasos', permiso: 'dashboards.atrasos' },
];

export const DASHBOARD_PERMISOS = DASHBOARDS.map((d) => d.permiso);

export const PERMISO_RONDAS_EDITAR = 'dashboards.rondas_editar';

// Permiso de ACCIÓN (no de dashboard): habilita la pestaña interna de diagnóstico del dashboard de
// supervisores. No va en DASHBOARDS/DASHBOARD_PERMISOS (principio #35).
export const PERMISO_SUPERVISORES_DIAGNOSTICO = 'dashboards.gastos_supervisores_diagnostico';
