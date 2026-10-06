// Líneas del circuito del login, trazadas sobre el lienzo de 1536x1024 del diseño (centro 768,512).
// Solo se define el lado IZQUIERDO: el derecho es su espejo exacto (FondoLogin lo refleja).
// Cada línea nace en el borde izquierdo del lienzo (x=0) y termina en un nodo luminoso cerca del escudo.
// Para que en pantallas más anchas que 3:2 la línea siga llegando al borde de la pantalla, se prolonga hacia
// atrás por EXTENSION px siguiendo la dirección de su primer tramo.

export type Punto = readonly [number, number];

export type Linea = {
  id: string;
  puntos: readonly Punto[];
  /** true: lleva el destello viajero. false: solo se dibuja la línea tenue. */
  pulso: boolean;
  /** Nodo final (punto luminoso). null: la línea termina sin punto. */
  nodo: Punto | null;
  /** Punto fijo intermedio, tenue, sin animación. */
  puntoIntermedio?: Punto;
};

/** Cuánto se prolonga cada línea hacia afuera del lienzo (px del lienzo). */
export const EXTENSION = 700;
/** Alto del lienzo (las líneas que nacen en y=1024 también se prolongan hacia afuera). */
const ALTO_LIENZO = 1024;

export const LINEAS: readonly Linea[] = [
  { id: 'L1', pulso: true, nodo: [398, 302], puntos: [[0, 145], [75, 217], [273, 217], [358, 302], [398, 302]] },
  { id: 'L2', pulso: true, nodo: [123, 311], puntos: [[0, 200], [123, 311]] },
  { id: 'L3', pulso: true, nodo: [387, 373], puntos: [[0, 305], [42, 305], [72, 333], [204, 333], [214, 325], [278, 325], [325, 373], [387, 373]] },
  { id: 'L3b', pulso: true, nodo: [397, 392], puntos: [[0, 305], [42, 305], [72, 333], [204, 333], [214, 339], [268, 339], [320, 392], [397, 392]] },
  { id: 'L4', pulso: true, nodo: [376, 430], puntos: [[0, 363], [205, 363], [271, 429], [376, 430]] },
  { id: 'L5', pulso: false, nodo: null, puntos: [[60, 490], [85, 490], [120, 453], [395, 453]] },
  { id: 'L5b', pulso: true, nodo: [400, 476], puntos: [[0, 549], [163, 549], [237, 476], [400, 476]] },
  { id: 'L6', pulso: true, nodo: [404, 501], puntos: [[0, 618], [236, 618], [340, 516], [390, 516], [404, 501]] },
  { id: 'L7', pulso: true, nodo: [411, 538], puntos: [[0, 786], [35, 786], [177, 643], [255, 643], [355, 538], [411, 538]], puntoIntermedio: [165, 655] },
];

/*
 * Versión CELULAR/TABLET: mismo lienzo de 1536x1024 pero con ajuste "slice", así que en pantalla solo se ve la franja
 * central (aprox. x 530-1005 en un celular). Las líneas entran por el borde SUPERIOR (y=0) y el INFERIOR (y=1024) y
 * terminan en un nodo junto al contorno del escudo. Solo se define el lado izquierdo; el derecho es el espejo.
 */
export const LINEAS_MOVIL: readonly Linea[] = [
  // Arriba: bajan hasta quedar por encima de los hombros del escudo.
  { id: 'A1', pulso: true, nodo: [590, 122], puntos: [[566, 0], [566, 56], [590, 80], [590, 122]] },
  { id: 'A2', pulso: true, nodo: [646, 106], puntos: [[622, 0], [622, 44], [646, 68], [646, 106]] },
  { id: 'A3', pulso: true, nodo: [702, 80], puntos: [[678, 0], [678, 34], [702, 58], [702, 80]] },
  // Abajo: suben hasta quedar por debajo de la curva inferior del escudo.
  { id: 'B1', pulso: true, nodo: [590, 780], puntos: [[566, 1024], [566, 880], [590, 856], [590, 780]] },
  { id: 'B2', pulso: true, nodo: [646, 826], puntos: [[622, 1024], [622, 930], [646, 906], [646, 826]] },
  { id: 'B3', pulso: true, nodo: [702, 850], puntos: [[678, 1024], [678, 950], [702, 926], [702, 850]] },
];

/** Prolonga la línea hacia atrás, en la dirección de su primer tramo. Solo las que nacen en un borde del lienzo (x=0, y=0 o y=alto). */
export function extender(puntos: readonly Punto[], extension: number = EXTENSION): Punto[] {
  const [p0, p1] = puntos;
  if (p0[0] > 0 && p0[1] > 0 && p0[1] < ALTO_LIENZO) return [...puntos];
  const dx = p0[0] - p1[0];
  const dy = p0[1] - p1[1];
  const n = Math.hypot(dx, dy) || 1;
  return [[p0[0] + (dx / n) * extension, p0[1] + (dy / n) * extension], ...puntos];
}

export function largo(puntos: readonly Punto[]): number {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) {
    total += Math.hypot(puntos[i][0] - puntos[i - 1][0], puntos[i][1] - puntos[i - 1][1]);
  }
  return total;
}

export function aPath(puntos: readonly Punto[]): string {
  return puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}
