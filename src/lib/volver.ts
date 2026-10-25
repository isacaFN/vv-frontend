// "Volver a donde ibas" después de iniciar sesión (enlaces de los correos de Permisos y Vacaciones).
// SOLO se aceptan rutas internas de esta misma aplicación: nunca otro sitio (redirección abierta).

export const PARAM_VOLVER = 'volver';

/** Devuelve la ruta si es interna y segura; si no, null. */
export function rutaInternaSegura(valor: string | null | undefined): string | null {
  if (!valor || valor.length > 500) return null;
  if (!valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) return null;
  for (const c of valor) {
    const n = c.charCodeAt(0);
    if (n < 32 || n === 127) return null; // sin saltos de línea, tabulaciones ni otros caracteres de control
  }
  try {
    const url = new URL(valor, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const ruta = url.pathname + url.search + url.hash;
    if (ruta === '/login' || ruta.startsWith('/login?') || ruta.startsWith('/login/')) return null;
    return ruta;
  } catch {
    return null;
  }
}

/** URL del login que recuerda a dónde volver. Si la ruta no es segura o es la raíz, va al login a secas. */
export function loginConVolver(ruta: string): string {
  const segura = rutaInternaSegura(ruta);
  return segura && segura !== '/' ? `/login?${PARAM_VOLVER}=${encodeURIComponent(segura)}` : '/login';
}
