import type { AccionVacaciones } from '@/config/vacaciones';

export type Etapa = { clave: string; etiqueta: string; etiqueta_rechazo?: string };

export type TipoSolicitud = {
  id: number;
  numero_control_rol: number;
  codigo: string;
  nombre: string;
  descuenta_vacaciones: boolean;
  permite_retroactivo: boolean;
};

export type Catalogo = {
  tipos: TipoSolicitud[];
  etapas: Etapa[];
  estados: Record<string, { etiqueta: string; abierta: boolean }>;
  comentario: { max: number; min_rechazo: number };
  adjuntos: { habilitado: boolean; max_mb: number; mimes: string[] };
  hoy: string; // "2026-10-12"
};

export type DiaExcluido = {
  fecha: string; // "2026-10-17"
  dia_semana: string;
  motivo: 'sabado' | 'domingo' | 'festivo';
  detalle: string | null; // nombre del feriado, si lo hay
};

export type Evento = {
  id: number;
  accion: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  comentario: string | null;
  user_nombre: string;
  created_at: string | null; // ISO UTC
};

export type Solicitud = {
  id: number;
  folio: string;
  colaborador: { id: number; nombre: string; documento: string | null; instalacion: string | null };
  tipo: { id: number; codigo: string; nombre: string };
  fecha_desde: string;
  fecha_hasta: string;
  dias_corridos: number;
  // Solo las vacaciones (V1/V2) se calculan; en el resto de los permisos son null y RRHH valida.
  dias_habiles: number | null;
  dias_descontados: number;
  descuenta_vacaciones: boolean;
  mensaje: string;
  estado: string;
  estado_etiqueta: string;
  abierta: boolean;
  folio_control_rol: string | null;
  solicitante: string;
  created_at: string | null;
  acciones: AccionVacaciones[];
  // Solo en el detalle:
  dias_excluidos?: DiaExcluido[];
  eventos?: Evento[];
};

export type ListaSolicitudes = { solicitudes: Solicitud[]; total: number; truncado: boolean };

export type VistaPrevia = {
  tipo: { id: number; codigo: string; nombre: string };
  fecha_desde: string;
  fecha_hasta: string;
  dias_corridos: number;
  dias_habiles: number | null;
  dias_descontados: number;
  descuenta_vacaciones: boolean;
  excluidos: DiaExcluido[];
  advertencias: string[];
  problemas: string[];
  mensaje: string;
};

export type ColaboradorBusqueda = {
  id: number;
  nombre: string;
  documento: string | null;
  cargo: string | null;
  instalacion: string | null;
};

export type Vista = 'abiertas' | 'historial';

// Aviso entre componentes: algo cambió y el contador de pendientes debe recargarse.
export const EVENTO_VACACIONES_CAMBIO = 'vacaciones:cambio';
