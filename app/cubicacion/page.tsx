import { getTipoProductos } from "./actions/productoActions";
import { getTipoContenedores } from "./actions/tipoContenedorActions";
import CubicacionUI from "./components/CubicacionUi";

export default async function CubicacionPage() {
  const [contenedores, productos] = await Promise.all([
    getTipoContenedores(),
    getTipoProductos(),
  ]);

  return <CubicacionUI contenedores={contenedores} productos={productos} />;
}
