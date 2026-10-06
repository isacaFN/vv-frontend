// Permisos del módulo RRHH. Son permisos de ACCIÓN/módulo (no de dashboard): no van en
// DASHBOARDS/DASHBOARD_PERMISOS (principio #35).
export const PERMISO_RRHH_VER = 'rrhh.ver';
export const PERMISO_RRHH_COSTOS = 'rrhh.costos_hora_extra';

// El ítem "RRHH" aparece si el usuario tiene AL MENOS uno. Quien puede definir costos
// también puede verlos (el backend lo acepta igual).
export const RRHH_PERMISOS = [PERMISO_RRHH_VER, PERMISO_RRHH_COSTOS];
