// Permisos del panel de administración. Son permisos de ACCIÓN (ya existían en el
// backend), no de dashboard: no van en DASHBOARDS/DASHBOARD_PERMISOS.
export const PERMISO_ADMIN_COMBUSTIBLE = 'combustibles.gestionar';
export const PERMISO_ADMIN_ASIGNACIONES = 'asignaciones.gestionar';
export const PERMISO_ADMIN_RESPONSABLES = 'responsables.gestionar';
export const PERMISO_ADMIN_USUARIOS = 'usuarios.gestionar';

// Solo se aceptan correos de este dominio (el backend lo valida igual: config/usuarios.php).
export const DOMINIO_CORREO = 'vvsecurity.cl';

// La pestaña "Importaciones" se ve con CUALQUIERA de los permisos de subida; cada usuario
// ve solo los imports que puede subir (el backend filtra con config/importaciones.php).
export const PERMISOS_IMPORTACIONES = [
  'imports.ejecutar',
  'colaboradores.editar',
  'asistencias.gestionar',
  'horas_extra.gestionar',
  'atrasos.gestionar',
  'dashboards.rondas_editar',
];

// El ítem "Administración" aparece si el usuario tiene AL MENOS uno.
export const ADMIN_PERMISOS = [
  PERMISO_ADMIN_COMBUSTIBLE,
  PERMISO_ADMIN_ASIGNACIONES,
  PERMISO_ADMIN_RESPONSABLES,
  PERMISO_ADMIN_USUARIOS,
  ...PERMISOS_IMPORTACIONES,
];
