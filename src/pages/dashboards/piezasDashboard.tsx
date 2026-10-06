import type { ReactNode } from 'react';
import { fechaCorta, nf1 } from './supervisoresUtil';

/** Piezas visuales compartidas por los dashboards nuevos (flota y los que vengan). */

export function Tarjeta({ titulo, derecha, children }: { titulo: string; derecha?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-heading text-base font-semibold">{titulo}</h2>
        {derecha}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/**
 * Tarjeta de cifra con variación contra el período anterior. La variación es neutra a propósito
 * (sin rojo/verde): subir o bajar un gasto no es bueno ni malo por sí solo.
 */
export function KpiVariacion({
  titulo,
  actual,
  anterior,
  formato,
  nota,
}: {
  titulo: string;
  actual: number | null;
  anterior: number | null;
  formato: (v: number | null) => string;
  nota?: string;
}) {
  let variacion: ReactNode;
  if (actual === null) {
    variacion = 'Sin datos en el rango';
  } else if (anterior === null) {
    variacion = 'Sin dato en el período anterior';
  } else if (anterior <= 0) {
    variacion = `Período anterior: ${formato(anterior)}`;
  } else {
    const pct = ((actual - anterior) / anterior) * 100;
    const flecha = Math.abs(pct) < 0.05 ? '=' : pct > 0 ? '▲' : '▼';
    variacion = (
      <>
        <span className="font-medium text-foreground">
          {flecha} {nf1.format(Math.abs(pct))}%
        </span>{' '}
        vs {formato(anterior)}
      </>
    );
  }

  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{formato(actual)}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{variacion}</p>
      {nota && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{nota}</p>}
    </div>
  );
}

/* ───────────────────────── Personas a cargo (supervisor, administrador…) ───────────────────────── */

export type Persona = { colaborador_id: number; nombre: string; nombre_corto: string; desde: string; hasta: string; parcial: boolean };

/** "PATRICIO RENE BUSTAMANTE" -> "Patricio Rene Bustamante" (en la base vienen en mayúsculas). */
export function nombrePropio(texto: string): string {
  return texto.toLocaleLowerCase('es').replace(/(^|\s)\S/g, (m) => m.toLocaleUpperCase('es'));
}

/** Una sola línea (para un <select>, que no admite saltos): nombres cortos separados por " / ". */
export function personasEnLinea(lista: Persona[], vacio: string): string {
  return lista.length === 0 ? vacio : lista.map((p) => nombrePropio(p.nombre_corto)).join(' / ');
}

/**
 * Una persona por línea (así no parece un solo nombre largo). Nombre corto con el completo en el
 * tooltip; si no estuvo a cargo todo el rango, se agrega su tramo.
 */
export function ListaPersonas({ lista, vacio, completo = false }: { lista: Persona[]; vacio: string; completo?: boolean }) {
  if (lista.length === 0) return <span className="text-muted-foreground">{vacio}</span>;
  return (
    <ul className="space-y-0.5">
      {lista.map((p) => (
        <li key={p.colaborador_id} className="whitespace-normal leading-tight text-foreground" title={nombrePropio(p.nombre)}>
          {lista.length > 1 && <span className="mr-1 text-muted-foreground">•</span>}
          {nombrePropio(completo ? p.nombre : p.nombre_corto)}
          {p.parcial && (
            <span className="ml-1 whitespace-nowrap text-xs text-muted-foreground">
              ({fechaCorta(p.desde)} → {fechaCorta(p.hasta)})
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
