import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function RankingCard({
  titulo,
  nota,
  cargando,
  vacio,
  alturaMaxima,
  children,
}: {
  titulo: string;
  nota?: ReactNode;
  cargando: boolean;
  vacio: boolean;
  // Si se pasa, el contenido scrollea dentro de la card (px). Útil para listas largas.
  alturaMaxima?: number;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold text-muted-foreground">{titulo}</h3>
        {nota}
      </div>
      {cargando ? (
        <Skeleton className="h-64 w-full" />
      ) : vacio ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Sin datos en el período seleccionado.</p>
      ) : alturaMaxima ? (
        <div className="overflow-y-auto overflow-x-hidden pr-1" style={{ maxHeight: alturaMaxima }}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}