import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ATAJOS, TEXTO_ERROR, errorDeRango, type Rango } from './supervisoresUtil';

/** Rango de fechas + atajos. `children` son filtros extra que van en la misma fila (p. ej. el supervisor). */
export default function FiltroRangoSupervisores({
  rango,
  onChange,
  children,
}: {
  rango: Rango;
  onChange: (r: Rango) => void;
  children?: ReactNode;
}) {
  const error = errorDeRango(rango);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Desde</span>
          <Input
            type="date"
            value={rango.desde}
            max={rango.hasta || undefined}
            onChange={(e) => onChange({ ...rango, desde: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Hasta</span>
          <Input
            type="date"
            value={rango.hasta}
            min={rango.desde || undefined}
            onChange={(e) => onChange({ ...rango, hasta: e.target.value })}
          />
        </label>
        {children}
      </div>

      <div className="flex flex-wrap gap-2">
        {ATAJOS.map((a) => (
          <Button key={a.clave} size="sm" variant="outline" onClick={() => onChange(a.rango())}>
            {a.etiqueta}
          </Button>
        ))}
      </div>

      {error && <p className={TEXTO_ERROR}>{error}</p>}
    </div>
  );
}
