// RRHH → Permisos y Vacaciones. Permisos de ACCIÓN/módulo (no de dashboard): no van en DASHBOARDS (principio #35).
export const PERMISO_VAC_VER_PROPIAS = 'vacaciones.ver_propias';
export const PERMISO_VAC_VER_TODAS = 'vacaciones.ver_todas';
export const PERMISO_VAC_SOLICITAR = 'vacaciones.solicitar';
export const PERMISO_VAC_ACEPTAR = 'vacaciones.aceptar';
export const PERMISO_VAC_APROBAR = 'vacaciones.aprobar';
export const PERMISO_VAC_CARGAR = 'vacaciones.cargar';

// Para ENTRAR a la pestaña basta con uno de estos dos. Los permisos de etapa y el de solicitar
// actúan dentro de la pestaña (y el backend los vuelve a exigir).
export const VACACIONES_PERMISOS_VER = [PERMISO_VAC_VER_PROPIAS, PERMISO_VAC_VER_TODAS];

export type AccionVacaciones = 'aceptar' | 'aprobar' | 'cargar' | 'rechazar' | 'cancelar';

export const ETIQUETA_ACCION: Record<AccionVacaciones, string> = {
  aceptar: 'Aceptar solicitud',
  aprobar: 'Aprobar solicitud',
  cargar: 'Marcar como cargada',
  rechazar: 'Rechazar',
  cancelar: 'Cancelar solicitud',
};

// Lo que se muestra en el historial de una solicitud (según la acción y el estado al que llevó).
export const ETIQUETA_EVENTO: Record<string, string> = {
  solicitar: 'Solicitud creada',
  aceptar: 'Aceptada por RRHH',
  aprobar: 'Aprobada por el Jefe de Operaciones',
  cargar: 'Cargada en Control Rol',
  cancelar: 'Cancelada por quien la solicitó',
  'rechazar:rechazada_rrhh': 'Rechazada por RRHH',
  'rechazar:rechazada_jefe': 'Rechazada por el Jefe de Operaciones',
};

export function etiquetaEvento(accion: string, estadoNuevo: string): string {
  return ETIQUETA_EVENTO[`${accion}:${estadoNuevo}`] ?? ETIQUETA_EVENTO[accion] ?? accion;
}

// Colores del estado (se combinan con <Badge variant="outline">).
export const CLASE_ESTADO: Record<string, string> = {
  solicitada: 'border-amber-500 text-amber-700 dark:text-amber-400',
  aceptada: 'border-sky-500 text-sky-700 dark:text-sky-400',
  aprobada: 'border-indigo-500 text-indigo-700 dark:text-indigo-400',
  cargada: 'border-emerald-600 text-emerald-700 dark:text-emerald-400',
  rechazada_rrhh: 'border-red-500 text-red-700 dark:text-red-400',
  rechazada_jefe: 'border-red-500 text-red-700 dark:text-red-400',
  cancelada: 'border-muted-foreground text-muted-foreground',
};

// Etiqueta corta para tablas y tarjetas.
export const ETIQUETA_ESTADO_CORTA: Record<string, string> = {
  solicitada: 'Solicitada',
  aceptada: 'Aceptada por RRHH',
  aprobada: 'Aprobada',
  cargada: 'Cargada',
  rechazada_rrhh: 'Rechazada por RRHH',
  rechazada_jefe: 'Rechazada por Jefe Ops.',
  cancelada: 'Cancelada',
};
