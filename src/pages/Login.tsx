import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import FondoLogin from '@/components/login/FondoLogin';

// El login es SIEMPRE oscuro, sin importar el tema del resto del sistema.
const FONDO =
  'radial-gradient(ellipse at 50% 42%, #0b2c6b 0%, #051a3d 42%, #020b1c 100%)';
const CUADRICULA =
  'linear-gradient(rgba(70,130,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(70,130,255,0.045) 1px, transparent 1px)';

const CLASE_INPUT =
  'h-14 w-full rounded-xl border border-[rgba(120,160,255,0.35)] bg-[rgba(8,24,58,0.55)] pl-12 pr-12 text-base text-white ' +
  'placeholder:text-[#aab9d8] outline-none transition focus:border-[#3b8cff] focus:ring-2 focus:ring-[rgba(59,140,255,0.35)]';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // El servidor distingue "credenciales incorrectas" de "cuenta inhabilitada": se muestra su mensaje.
      const delServidor = isAxiosError(err) ? (err.response?.data?.errors?.email?.[0] as string | undefined) : undefined;
      setError(delServidor ?? 'Correo o contraseña incorrectos.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-20 pt-6 sm:pb-24"
      style={{ backgroundColor: '#020b1c', backgroundImage: `${CUADRICULA}, ${FONDO}`, backgroundSize: '44px 44px, 44px 44px, auto' }}
    >
      <style>{`
        .vv-login input:-webkit-autofill,
        .vv-login input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff;
          caret-color: #fff;
          box-shadow: 0 0 0 1000px #0a1d44 inset;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>

      <FondoLogin />

      <main className="vv-login relative z-10 flex w-full max-w-[410px] flex-col items-center">
        {/* Marca (texto; sin archivo de logo) */}
        <div className="select-none text-center leading-none" aria-label="V&V Operaciones">
          <div
            className="font-heading text-white"
            style={{ fontSize: 'clamp(72px, 9vw, 104px)', fontWeight: 800, letterSpacing: '-0.045em' }}
          >
            V<span style={{ color: '#1a6bff' }}>&amp;</span>V
          </div>
          <div
            className="mt-2 text-white"
            style={{ fontSize: 'clamp(14px, 1.4vw, 19px)', fontWeight: 700, letterSpacing: '0.34em', paddingLeft: '0.34em' }}
          >
            OPERACIONES
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 w-full space-y-4 rounded-2xl p-6 sm:p-8"
          style={{
            background: 'rgba(9, 28, 66, 0.45)',
            border: '1px solid rgba(86, 140, 255, 0.28)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 0 48px rgba(20, 90, 255, 0.14)',
          }}
        >
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#d4e2ff]" aria-hidden="true" />
            <input
              type="email"
              name="email"
              autoComplete="username"
              placeholder="Correo electrónico"
              aria-label="Correo electrónico"
              className={CLASE_INPUT}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#d4e2ff]" aria-hidden="true" />
            <input
              type={verPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              aria-label="Contraseña"
              className={CLASE_INPUT}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={verPassword}
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#d4e2ff] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#3b8cff]"
            >
              {verPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
            </button>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="h-14 w-full rounded-xl text-base font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8cff] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: 'linear-gradient(90deg, #0a62f5 0%, #1c8cff 100%)', boxShadow: '0 6px 24px rgba(20, 110, 255, 0.35)' }}
          >
            {cargando ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      </main>
    </div>
  );
}
