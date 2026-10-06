// Parte un texto largo en hasta dos líneas, cortando en el último espacio
// antes del límite para no partir palabras a la mitad.
export function partirTexto(texto: string, maxCharsPorLinea: number): [string, string?] {
  if (texto.length <= maxCharsPorLinea) return [texto];

  let corte = texto.lastIndexOf(' ', maxCharsPorLinea);
  if (corte <= 0) corte = maxCharsPorLinea;

  const linea1 = texto.slice(0, corte).trim();
  let linea2 = texto.slice(corte).trim();

  if (linea2.length > maxCharsPorLinea) {
    linea2 = `${linea2.slice(0, maxCharsPorLinea - 1)}…`;
  }

  return [linea1, linea2];
}

export function CategoryTick({
  y,
  payload,
  isMobile,
  margenIzquierdo,
}: {
  y?: number;
  payload?: { value: string };
  isMobile: boolean;
  margenIzquierdo: number;
}) {
  const texto = payload?.value ?? '';
  const maxCharsPorLinea = isMobile ? 11 : 20;
  const [linea1, linea2] = partirTexto(texto, maxCharsPorLinea);
  const x = margenIzquierdo + 4;
  const fontSize = isMobile ? 10 : 12;

  if (!linea2) {
    return (
      <text x={x} y={y} dy={4} textAnchor="start" fontSize={fontSize} fill="var(--muted-foreground)">
        {linea1}
      </text>
    );
  }

  return (
    <text x={x} y={y} textAnchor="start" fontSize={fontSize} fill="var(--muted-foreground)">
      <tspan x={x} dy={isMobile ? -2 : -3}>{linea1}</tspan>
      <tspan x={x} dy={isMobile ? 11 : 13}>{linea2}</tspan>
    </text>
  );
}