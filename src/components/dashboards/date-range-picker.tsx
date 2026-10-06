import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const PRESETS = [
  { label: 'Últimos 7 días', dias: 7 },
  { label: 'Últimos 30 días', dias: 30 },
  { label: 'Últimos 90 días', dias: 90 },
];

function rangoDesdeUltimosDias(dias: number): DateRange {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - (dias - 1));
  return { from: desde, to: hasta };
}

function etiquetaFecha(fecha: Date) {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha);
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange | undefined;
  onChange: (rango: DateRange) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('justify-start text-left font-normal', !value && 'text-muted-foreground')}>
          <CalendarIcon className="size-4" />
          {value?.from ? (
            value.to ? (
              <>
                {etiquetaFecha(value.from)} – {etiquetaFecha(value.to)}
              </>
            ) : (
              etiquetaFecha(value.from)
            )
          ) : (
            'Selecciona un rango de fechas'
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-1 p-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.dias}
              variant="ghost"
              className="justify-start font-normal"
              onClick={() => {
                onChange(rangoDesdeUltimosDias(preset.dias));
                setAbierto(false);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="border-t p-2">
          <Calendar
            mode="range"
            selected={value}
            onSelect={(rango) => {
              if (rango?.from && rango?.to) {
                onChange(rango);
                setAbierto(false);
              }
            }}
            numberOfMonths={2}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
