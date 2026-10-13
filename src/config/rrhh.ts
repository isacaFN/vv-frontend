import { VACACIONES_PERMISOS_VER } from '@/config/vacaciones';

// Permisos del módulo RRHH. Son permisos de ACCIÓN/módulo (no de dashboard): no van en
// DASHBOARDS/DASHBOARD_PERMISOS (principio #35).
export const PERMISO_RRHH_VER = 'rrhh.ver';
export const PERMISO_RRHH_COSTOS = 'rrhh.costos_hora_extra';

// Pestaña "Instalaciones": se muestra si el usuario tiene AL MENOS uno. Quien puede definir costos
// también puede verlos (el backend lo acepta igual).
export const RRHH_INSTALACIONES_PERMISOS = [PERMISO_RRHH_VER, PERMISO_RRHH_COSTOS];

// El ítem "RRHH" del menú y la ruta /rrhh aparecen si el usuario puede entrar a AL MENOS una pestaña:
// Instalaciones o Permisos y Vacaciones.
export const RRHH_PERMISOS = [...RRHH_INSTALACIONES_PERMISOS, ...VACACIONES_PERMISOS_VER];
