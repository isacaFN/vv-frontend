import { useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import { useAuth, type Usuario } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MINIMO = 8; // igual que config/usuarios.php (el servidor es quien manda)
const TEXTO_ERROR = 'text-sm text-red-600 dark:text-red-400';

function mensajeError(e: unknown): string {
  if (isAxiosError(e)) {
    const errores = e.response?.data?.errors as Record<string, string[]> | undefined;
    const primero = errores ? Object.values(errores).flat()[0] : undefined;
    return primero ?? e.response?.data?.message ?? 'No se pudo cambiar la contraseña.';
  }
  return 'No se pudo cambiar la contraseña.';
}

/** Mensaje si la nueva contraseña no cumple las reglas; null si está bien. */
function validar(actual: string, nueva: string, repetida: string): string | null {
  if (!actual) return 'Escribe tu contraseña actual.';
  if (nueva.length < MINIMO) return `La nueva contraseña debe tener al menos ${MINIMO} caracteres.`;
  if (!/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) return 'La nueva contraseña debe tener al menos una letra y un número.';
  if (nueva === actual) return 'La nueva contraseña debe ser distinta de la actual.';
  if (nueva !== repetida) return 'La confirmación no coincide con la nueva contraseña.';
  return null;
}

/**
 * Cambio de contraseña. `forzado` = primer ingreso (o contraseña restablecida): ocupa toda la
 * pantalla y no deja usar el sistema hasta completarlo. Sin `forzado` es el cambio voluntario.
 */
export default function CambiarPassword({ forzado = false }: { forzado?: boolean }) {
  const { usuario, actualizarUsuario, logout } = useAuth();

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setListo(false);
    const problema = validar(actual, nueva, repetida);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const res = await api.post<Usuario>('/cambiar-password', {
        password_actual: actual,
        password: nueva,
        password_confirmation: repetida,
      });
      setActual('');
      setNueva('');
      setRepetida('');
      setListo(true);
      actualizarUsuario(res.data); // en modo forzado, esto libera el resto del sistema
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  const formulario = (
    <form onSubmit={enviar} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm">{forzado ? 'Contraseña temporal' : 'Contraseña actual'}</span>
        <Input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm">Nueva contraseña</span>
        <Input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <span className="block text-xs text-muted-foreground">Al menos {MINIMO} caracteres, con letras y números.</span>
      </label>
      <label className="block space-y-1">
        <span className="text-sm">Repite la nueva contraseña</span>
        <Input type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
      </label>

      {error && <p className={TEXTO_ERROR}>{error}</p>}
      {listo && !forzado && <p className="text-sm text-green-700 dark:text-green-400">Contraseña actualizada. Tus otras sesiones se cerraron.</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Cambiar contraseña'}
        </Button>
        {forzado && (
          <Button type="button" variant="outline" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        )}
      </div>
    </form>
  );

  if (!forzado) {
    return (
      <div className="max-w-md space-y-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Cambiar mi contraseña</h1>
          <p className="text-sm text-muted-foreground">{usuario?.email}</p>
        </div>
        {formulario}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Elige tu contraseña</CardTitle>
          <CardDescription>
            Ingresaste con una contraseña temporal. Por seguridad debes cambiarla antes de continuar.
            {usuario ? ` Cuenta: ${usuario.email}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>{formulario}</CardContent>
      </Card>
    </div>
  );
}
