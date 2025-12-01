// app/cubicacion/page.tsx
import { getTipoProductos } from "./actions/productoActions";
import { saveCubicacionProductoBulto } from "./actions/saveCubicacionProductoBulto";
import { saveCubicacionProductoContenedor } from "./actions/saveCubicacionProductoContenedor";
import { getTipoContenedores } from "./actions/tipoContenedorActions";
import CubicacionUI from "./components/CubicacionUi";

export default async function CubicacionPage() {
  const productos = await getTipoProductos();
  const contenedores = await getTipoContenedores();

  // 👇 Server Action para guardar cubicación unidad → bulto
  async function guardarBultoAction(formData: FormData) {
    "use server";

    const tipoProductoId = Number(formData.get("tipoProductoId"));
    const largoUnidadMm = Number(formData.get("largoUnidadMm"));
    const anchoUnidadMm = Number(formData.get("anchoUnidadMm"));
    const altoUnidadMm = Number(formData.get("altoUnidadMm"));
    const grosorParedMm = Number(formData.get("grosorParedMm") ?? 0);

    const unidadesEjeX = Number(formData.get("unidadesEjeX"));
    const unidadesEjeY = Number(formData.get("unidadesEjeY"));
    const unidadesEjeZ = Number(formData.get("unidadesEjeZ"));
    const ocupacionInterna = Number(formData.get("ocupacionInternaPorcentaje"));
    const orientLargoMm = Number(formData.get("orientLargoMm"));
    const orientAnchoMm = Number(formData.get("orientAnchoMm"));
    const orientAltoMm = Number(formData.get("orientAltoMm"));

    await saveCubicacionProductoBulto({
      tipoProductoId,
      largoUnidadMm,
      anchoUnidadMm,
      altoUnidadMm,
      grosorParedMm,
      unidadesEjeX,
      unidadesEjeY,
      unidadesEjeZ,
      ocupacionInterna,
      orientLargoMm,
      orientAnchoMm,
      orientAltoMm,
    });
  }

  // 👇 Server Action para guardar cubicación bulto → pallet/contenedor
  async function guardarContenedorAction(formData: FormData) {
    "use server";

    const tipoProductoId = Number(formData.get("tipoProductoId"));
    const tipoContenedorId = Number(formData.get("tipoContenedorId"));
    const alturaMaxCargaMRaw = formData.get("alturaMaxCargaM");
    const alturaMaxCargaM =
      alturaMaxCargaMRaw !== null && `${alturaMaxCargaMRaw}`.trim() !== ""
        ? Number(alturaMaxCargaMRaw)
        : null;

    const cajasPorCapa = Number(formData.get("cajasPorCapa"));
    const capas = Number(formData.get("capas"));
    const cajasTotales = Number(formData.get("cajasTotales"));
    const productosPorCaja = Number(formData.get("productosPorCaja"));
    const productosTotales = Number(formData.get("productosTotales"));
    const ocupacionVolumenPorcentaje = Number(
      formData.get("ocupacionVolumenPorcentaje")
    );

    await saveCubicacionProductoContenedor({
      tipoProductoId,
      tipoContenedorId,
      alturaMaxCargaM,
      cajasPorCapa,
      capas,
      cajasTotales,
      productosPorCaja,
      productosTotales,
      ocupacionVolumenPorcentaje,
    });
  }

  return <CubicacionUI contenedores={contenedores} productos={productos} />;
}
