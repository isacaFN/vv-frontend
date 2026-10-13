import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { EVENTO_VACACIONES_CAMBIO } from './tipos';

const CADA_MS = 60_000;

/** Cuántas solicitudes esperan un paso del usuario. Se recarga al volver a la pestaña, cada minuto y cuando algo cambia. */
export default function ContadorPendientes() {
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    let vigente = true;
    const cargar = () => {
      api
        .get<{ pendientes: number }>('/vacaciones/resumen')
        .then((res) => vigente && setPendientes(res.data.pendientes))
        .catch(() => undefined); // un contador que no carga no debe molestar
    };
    cargar();
    const intervalo = setInterval(cargar, CADA_MS);
    window.addEventListener(EVENTO_VACACIONES_CAMBIO, cargar);
    return () => {
      vigente = false;
      clearInterval(intervalo);
      window.removeEventListener(EVENTO_VACACIONES_CAMBIO, cargar);
    };
  }, []);

  if (pendientes === 0) return null;

  return <Badge className="ml-2 h-5 min-w-5 justify-center px-1.5 text-xs">{pendientes}</Badge>;
}
