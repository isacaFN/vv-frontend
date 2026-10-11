import { useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { mensajeError } from '@/pages/admin/utils';

/**
 * Alta de un móvil (POST /moviles/registrar, permiso moviles.gestionar).
 * Lo usan Asignación de móviles (botón) e Importaciones (alerta de placas sin registrar).
 */
export function DialogRegistrarMovil({
  placaInicial,
  onCerrar,
  onRegistrado,
}: {
  placaInicial: string;
  onCerrar: () => void;
  onRegistrado: (placa: string) => void;
}) {
  const [placa, setPlaca] = useState(placaInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valida = /^[A-Z0-9]{5,7}$/.test(placa);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const { data } = await api.post<{ movil: { placa: string } }>('/moviles/registrar', { placa });
      onRegistrado(data.movil.placa);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo registrar el móvil.'));
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !guardando && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar móvil</DialogTitle>
          <DialogDescription>Queda activo y disponible para asignaciones, combustible y la distancia recorrida.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="movil-placa">
              Placa
            </label>
            <Input
              id="movil-placa"
              autoFocus
              autoComplete="off"
              className="font-mono uppercase sm:max-w-xs"
              placeholder="Ej: ABCD12"
              maxLength={7}
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Registra solo vehículos reales de la flota. Si la placa viene mal escrita en el Excel, no la registres: corrige el
            archivo y súbelo de nuevo. Marca, modelo y año se completarán más adelante.
          </p>
          {error && <p className="text-red-600 dark:text-red-800">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button disabled={guardando || !valida} onClick={() => void guardar()}>
            {guardando ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}