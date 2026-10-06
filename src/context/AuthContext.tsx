import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';

export type Usuario = {
  id: number;
  name: string;
  email: string;
  permissions: string[];
  /** true = debe cambiar la contraseña temporal antes de usar el sistema. */
  must_change_password: boolean;
};

type AuthContextType = {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Reemplaza los datos del usuario en sesión (p. ej. tras cambiar la contraseña). */
  actualizarUsuario: (u: Usuario) => void;
  tienePermiso: (permiso: string) => boolean;
  tieneAlgunPermiso: (permisos: string[]) => boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setCargando(false); return; }

    api.get('/me')
      .then((res) => setUsuario(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setCargando(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post('/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUsuario(res.data.user);
  }

  async function logout() {
    try { await api.post('/logout'); }
    finally { localStorage.removeItem('token'); setUsuario(null); }
  }

  function tienePermiso(permiso: string) {
    return usuario?.permissions.includes(permiso) ?? false;
  }

  function tieneAlgunPermiso(permisos: string[]) {
    return permisos.some((p) => usuario?.permissions.includes(p) ?? false);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, login, logout, actualizarUsuario: setUsuario, tienePermiso, tieneAlgunPermiso }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
