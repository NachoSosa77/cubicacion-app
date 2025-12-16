// app/cubicacion/page.tsx
import { getEmpresaBultosByEmpresaId } from "./actions/empresaBultoActions";
import { getTipoProductos } from "./actions/productoActions";
import { saveMultiProductoConfiguracion } from "./actions/saveMultiProductoConfiguracion";
import { getTipoContenedores } from "./actions/tipoContenedorActions";
import {
  getTransporteClasificaciones,
  ITransporteClasificacion,
} from "./actions/transporteActions";

import type { MultiProductoConfiguracionInput } from "./actions/saveMultiProductoConfiguracion";

import { MultiProductoConfigurator } from "./components/MultiProductoConfigurator";
import { toPlain } from "./lib/toPlain";

export default async function CubicacionPage() {
  const productos = await getTipoProductos();
  const contenedores = await getTipoContenedores();
  const camiones: ITransporteClasificacion[] = await getTransporteClasificaciones();

  const empresaId = 1;
  const bultosEmpresa = await getEmpresaBultosByEmpresaId(empresaId);

  async function guardarConfiguracionMultiProducto(
    input: MultiProductoConfiguracionInput
  ) {
    "use server";
    await saveMultiProductoConfiguracion(input);
  }

  return (
    <div className="space-y-6">
      <MultiProductoConfigurator
        productos={toPlain(productos)}
        bultosEmpresa={toPlain(bultosEmpresa)}
        onSubmit={guardarConfiguracionMultiProducto}
      />
    </div>
  );
}
