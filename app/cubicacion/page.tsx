// app/cubicacion/page.tsx
import { getEmpresaBultosByEmpresaId } from "./actions/empresaBultoActions";
import { getTipoProductos } from "./actions/productoActions";
import { saveMultiProductoConfiguracion } from "./actions/saveMultiProductoConfiguracion";
import { getTipoContenedores } from "./actions/tipoContenedorActions";
import {
  getTransporteClasificaciones,
  ITransporteClasificacion,
} from "./actions/transporteActions";

import type {
  MultiProductoConfiguracionInput,
} from "./actions/saveMultiProductoConfiguracion";

import { MultiProductoConfigurator } from "./components/MultiProductoConfigurator";

export default async function CubicacionPage() {
  // =============================
  // Datos base
  // =============================
  const productos = await getTipoProductos();
  const contenedores = await getTipoContenedores();
  const camiones: ITransporteClasificacion[] =
    await getTransporteClasificaciones();

  /**
   * ⚠️ TEMPORAL
   * Luego vendrá del usuario logueado
   */
  const empresaId = 1;

  const bultosEmpresa = await getEmpresaBultosByEmpresaId(empresaId);

  // =============================
  // Server Action: multi-producto
  // =============================
  async function guardarConfiguracionMultiProducto(
    input: MultiProductoConfiguracionInput
  ) {
    "use server";
    await saveMultiProductoConfiguracion(input);
  }

  // =============================
  // Render
  // =============================
  return (
    <div className="space-y-6">
      <MultiProductoConfigurator
        productos={productos}
        bultosEmpresa={bultosEmpresa}
        onSubmit={guardarConfiguracionMultiProducto}
      />
    </div>
  );
}
