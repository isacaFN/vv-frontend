import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { LINEAS, LINEAS_MOVIL, aPath, extender, largo } from '@/components/login/circuitos';
import { GLOBO_CX, GLOBO_CY, GLOBO_PUNTOS, GLOBO_R } from '@/components/login/globoPuntos';

/*
 * Fondo animado del login (siempre oscuro). Dos capas SVG con el mismo lienzo de 1536x1024:
 *   1. ArteEstatico: globo, anillos, escudo y las líneas tenues. No se anima, así se pinta una sola vez.
 *   2. PulsosCircuito: solo los destellos que viajan por las líneas y el parpadeo de los nodos.
 *
 * Los pulsos están SINCRONIZADOS: las 16 líneas salen a la vez y llegan a la vez a su nodo (misma duración;
 * las más largas van un poco más rápido). Todo el ritmo sale de la variable CSS --vv-ciclo y de los
 * porcentajes de los keyframes (el destello viaja del 0% al 62% del ciclo; el resto es pausa).
 *
 * Con "reducir movimiento" activado en el sistema, los destellos se ocultan y las líneas quedan quietas.
 */

const AZUL_LINEA = '#1f6fe6';
const AZUL_NODO = '#3fc1ff';

/** Ancho mínimo de pantalla para dibujar las líneas laterales (más angosto, el formulario las taparía). */
const ANCHO_MIN_LINEAS = 900;

function useAnchoMinimo(min: number): boolean {
  const consulta = `(min-width: ${min}px)`;
  const [cumple, setCumple] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);

  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const alCambiar = () => setCumple(mq.matches);
    alCambiar();
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, [consulta]);

  return cumple;
}

/*
 * Dos escenas sobre el mismo lienzo de 1536x1024 (mismo escudo, globo y anillos):
 *  - escritorio (≥900px, ajuste "meet"): 16 líneas que entran por los costados.
 *  - celular/tablet (ajuste "slice": el escudo llena la pantalla como telón): 12 líneas que entran por ARRIBA y por
 *    ABAJO y terminan en nodos junto al contorno del escudo. Como comparten lienzo y ajuste con el escudo, siempre
 *    quedan alineadas con él, sea cual sea la proporción de la pantalla.
 */
type Escena = {
  ancho: number;
  alto: number;
  ajuste: string;
  extension: number;
  lineas: readonly (typeof LINEAS)[number][];
};

const ESCRITORIO: Escena = { ancho: 1536, alto: 1024, ajuste: 'xMidYMid meet', extension: 700, lineas: LINEAS };
const MOVIL: Escena = { ancho: 1536, alto: 1024, ajuste: 'xMidYMid slice', extension: 400, lineas: LINEAS_MOVIL };

// Contorno del escudo (lienzo 1536x1024, centro 768,~470).
const ESCUDO =
  'M768 96 L1075 215 C1090 330 1098 430 1086 520 C1070 650 960 770 768 834 C576 770 466 650 450 520 C438 430 446 330 461 215 Z';

export default function FondoLogin() {
  const ancho = useAnchoMinimo(ANCHO_MIN_LINEAS);
  const escena = ancho ? ESCRITORIO : MOVIL;

  const lineas = useMemo(
    () =>
      escena.lineas.map((l) => {
        const puntos = extender(l.puntos, escena.extension);
        return { ...l, ruta: aPath(puntos), largo: largo(puntos) };
      }),
    [escena],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <style>{CSS}</style>
      <ArteEstatico escena={escena} lineas={lineas} />
      <PulsosCircuito escena={escena} lineas={lineas} />
    </div>
  );
}

type LineaLista = (typeof LINEAS)[number] & { ruta: string; largo: number };

/* ───────────── Capa 1: arte estático ───────────── */

function ArteEstatico({ escena, lineas }: { escena: Escena; lineas: LineaLista[] }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${escena.ancho} ${escena.alto}`}
      preserveAspectRatio={escena.ajuste}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="vv-globo-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="70%" stopColor="#fff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="vv-globo-mask" maskUnits="userSpaceOnUse" x={GLOBO_CX - GLOBO_R} y={GLOBO_CY - GLOBO_R} width={GLOBO_R * 2} height={GLOBO_R * 2}>
          <circle cx={GLOBO_CX} cy={GLOBO_CY} r={GLOBO_R} fill="url(#vv-globo-fade)" />
        </mask>
        <linearGradient id="vv-escudo-relleno" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a5ae0" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#04132e" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="vv-escudo-borde" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a86ff" />
          <stop offset="100%" stopColor="#1646b8" />
        </linearGradient>
        <filter id="vv-brillo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

    {/* Globo de puntos (estático, centrado en Chile) */}
    <circle cx={GLOBO_CX} cy={GLOBO_CY} r={GLOBO_R} fill="#0a2a66" fillOpacity="0.28" mask="url(#vv-globo-mask)" />
    <path
      d={GLOBO_PUNTOS}
      fill="none"
      stroke="#5a9dff"
      strokeWidth="3.2"
      strokeLinecap="round"
      mask="url(#vv-globo-mask)"
      opacity="0.75"
    />

    {/* Anillos con marcas, alrededor del escudo */}
    <g fill="none" stroke="#2f78f5">
      <circle cx="768" cy="470" r="395" strokeWidth="1" strokeOpacity="0.32" strokeDasharray="1.5 6" />
      <circle cx="768" cy="470" r="372" strokeWidth="7" strokeOpacity="0.10" strokeDasharray="2 9" />
      <circle cx="768" cy="470" r="418" strokeWidth="1" strokeOpacity="0.24" />
      <circle cx="768" cy="470" r="436" strokeWidth="2" strokeOpacity="0.14" strokeDasharray="90 170" />
    </g>

    {/* Escudo: brillo, relleno, contorno doble */}
    <path d={ESCUDO} fill="none" stroke="#2f78f5" strokeWidth="16" strokeOpacity="0.4" filter="url(#vv-brillo)" />
    <path d={ESCUDO} fill="url(#vv-escudo-relleno)" stroke="url(#vv-escudo-borde)" strokeWidth="6" strokeLinejoin="round" />
    <path
      d={ESCUDO}
      fill="none"
      stroke="#3a86ff"
      strokeOpacity="0.55"
      strokeWidth="2"
      strokeLinejoin="round"
      transform="translate(768 470) scale(0.92) translate(-768 -470)"
    />

      {/* Líneas tenues y nodos (el lado derecho es el espejo del izquierdo) */}
      <LadoLineas lineas={lineas} />
      <g transform={`translate(${escena.ancho} 0) scale(-1 1)`}>
        <LadoLineas lineas={lineas} />
      </g>
    </svg>
  );
}

function LadoLineas({ lineas }: { lineas: LineaLista[] }) {
  return (
    <g fill="none">
      {lineas.map((l) => (
        <g key={l.id}>
          <path d={l.ruta} stroke={AZUL_LINEA} strokeWidth={l.pulso ? 1.6 : 1.1} strokeOpacity={l.pulso ? 0.75 : 0.35} strokeLinejoin="round" />
          {l.puntoIntermedio && (
            <>
              <circle cx={l.puntoIntermedio[0]} cy={l.puntoIntermedio[1]} r="7" fill={AZUL_NODO} fillOpacity="0.18" />
              <circle cx={l.puntoIntermedio[0]} cy={l.puntoIntermedio[1]} r="3.2" fill={AZUL_NODO} />
            </>
          )}
          {l.nodo && (
            <>
              <circle cx={l.nodo[0]} cy={l.nodo[1]} r="9" fill={AZUL_NODO} fillOpacity="0.2" />
              <circle cx={l.nodo[0]} cy={l.nodo[1]} r="3.6" fill={AZUL_NODO} />
            </>
          )}
        </g>
      ))}
    </g>
  );
}

/* ───────────── Capa 2: destellos y parpadeo de nodos ───────────── */

function PulsosCircuito({ escena, lineas }: { escena: Escena; lineas: LineaLista[] }) {
  const conPulso = lineas.filter((l) => l.pulso);

  return (
    <svg
      className="vv-pulsos absolute inset-0 h-full w-full"
      viewBox={`0 0 ${escena.ancho} ${escena.alto}`}
      preserveAspectRatio={escena.ajuste}
      style={{ overflow: 'visible' }}
    >
      <Lado lineas={conPulso} />
      <g transform={`translate(${escena.ancho} 0) scale(-1 1)`}>
        <Lado lineas={conPulso} />
      </g>
    </svg>
  );
}

function Lado({ lineas }: { lineas: LineaLista[] }) {
  return (
    <g fill="none">
      {lineas.map((l) => {
        const largoPx = { '--len': `${l.largo.toFixed(1)}px` } as CSSProperties;
        return (
          <g key={l.id} style={largoPx}>
            {/* Halo ancho, cola y cabeza: las tres terminan en el mismo punto (misma animación, largos distintos) */}
            <path className="vv-pulso" d={l.ruta} stroke="#3b9bff" strokeWidth="9" strokeOpacity="0.16" style={{ '--d': '34px' } as CSSProperties} />
            <path className="vv-pulso" d={l.ruta} stroke="#3b9bff" strokeWidth="2.2" strokeOpacity="0.55" style={{ '--d': '130px' } as CSSProperties} />
            <path className="vv-pulso" d={l.ruta} stroke="#d4ebff" strokeWidth="3" style={{ '--d': '24px' } as CSSProperties} />
            {l.nodo && (
              <>
                <circle className="vv-llegada-halo" cx={l.nodo[0]} cy={l.nodo[1]} r="12" fill="#3fc1ff" />
                <circle className="vv-llegada-nucleo" cx={l.nodo[0]} cy={l.nodo[1]} r="4" fill="#eaf6ff" />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/*
 * --vv-ciclo: duración total (viaje + pausa). El destello viaja del 0% al 62% (≈2,6 s con 4,2 s) y el
 * nodo parpadea al llegar. Para ajustar el ritmo basta con tocar estos números.
 */
const CSS = `
.vv-pulsos { --vv-ciclo: 4.2s; }
.vv-pulso {
  stroke-linecap: round;
  stroke-dasharray: var(--d) 100000px;
  stroke-dashoffset: var(--d);
  animation: vv-viaje var(--vv-ciclo) linear infinite;
}
@keyframes vv-viaje {
  0%   { stroke-dashoffset: var(--d); }
  62%  { stroke-dashoffset: calc(var(--len) * -1); }
  100% { stroke-dashoffset: calc(var(--len) * -1); }
}
.vv-llegada-halo, .vv-llegada-nucleo {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: vv-llegada var(--vv-ciclo) ease-out infinite;
}
.vv-llegada-nucleo { animation-name: vv-llegada-nucleo; }
@keyframes vv-llegada {
  0%, 58% { opacity: 0; transform: scale(0.5); }
  62%     { opacity: 0.85; transform: scale(1); }
  82%     { opacity: 0; transform: scale(2.2); }
  100%    { opacity: 0; transform: scale(2.2); }
}
@keyframes vv-llegada-nucleo {
  0%, 58% { opacity: 0; transform: scale(1); }
  62%     { opacity: 1; transform: scale(1.5); }
  80%     { opacity: 0; transform: scale(1); }
  100%    { opacity: 0; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .vv-pulso, .vv-llegada-halo, .vv-llegada-nucleo { display: none; }
}
`;
