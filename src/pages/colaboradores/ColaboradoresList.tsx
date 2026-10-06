import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type Colaborador = {
  id: number;
  documento: string;
  ap_paterno: string;
  ap_materno: string;
  nombres: string;
  estado: 'Activo' | 'Inactivo';
  cargo: string | null;
  instalacion: { id: number; nombre: string } | null;
};

type Paginado<T> = { data: T[] };

export default function ColaboradoresList() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCargando(true);
      api.get<Paginado<Colaborador>>('/colaboradores', { params: { buscar } })
        .then((res) => setColaboradores(res.data.data))
        .finally(() => setCargando(false));
    }, 300);

    return () => clearTimeout(timeout);
  }, [buscar]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Colaboradores</h1>
        <Input placeholder="Buscar por RUT o nombre..." value={buscar} onChange={(e) => setBuscar(e.target.value)} className="max-w-xs" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>RUT</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Instalación</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
          ) : colaboradores.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin resultados.</TableCell></TableRow>
          ) : (
            colaboradores.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.documento}</TableCell>
                <TableCell>{c.ap_paterno} {c.ap_materno}, {c.nombres}</TableCell>
                <TableCell>{c.cargo ?? '—'}</TableCell>
                <TableCell>{c.instalacion?.nombre_instalacion ?? '—'}</TableCell>
                <TableCell><Badge variant={c.estado === 'Activo' ? 'default' : 'secondary'}>{c.estado}</Badge></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}