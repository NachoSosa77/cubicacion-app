// app/cubicacion/page.tsx
import { getTipoProductos } from "./actions/productoActions";
import {
  SaveCubicacionProductoBultoItemInput,
  saveCubicacionProductoBulto,
} from "./actions/saveCubicacionProductoBulto";
import { saveCubicacionProductoContenedor } from "./actions/saveCubicacionProductoContenedor";
import { getTipoContenedores } from "./actions/tipoContenedorActions";
import { getTransporteClasificaciones, ITransporteClasificacion } from "./actions/transporteActions";
import CubicacionUI from "./components/CubicacionUi";

export default async function CubicacionPage() {
  const productos = await getTipoProductos();
  const contenedores = await getTipoContenedores();
  const camiones: ITransporteClasificacion[] = await getTransporteClasificaciones();

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

    const productosJson = formData.get("productos");
    let productos: SaveCubicacionProductoBultoItemInput[] = [];

    if (productosJson && typeof productosJson === "string") {
      try {
        const parsed = JSON.parse(productosJson);
        if (Array.isArray(parsed)) {
          productos = parsed.map((item) => ({
            tipoProductoId: Number(item.tipoProductoId ?? tipoProductoId),
            cantidad: Number(item.cantidad),
            largoUnidadMm: Number(item.largoUnidadMm),
            anchoUnidadMm: Number(item.anchoUnidadMm),
            altoUnidadMm: Number(item.altoUnidadMm),
            unidadesEjeX: Number(item.unidadesEjeX ?? unidadesEjeX),
            unidadesEjeY: Number(item.unidadesEjeY ?? unidadesEjeY),
            unidadesEjeZ: Number(item.unidadesEjeZ ?? unidadesEjeZ),
            orientLargoMm: Number(item.orientLargoMm ?? orientLargoMm),
            orientAnchoMm: Number(item.orientAnchoMm ?? orientAnchoMm),
            orientAltoMm: Number(item.orientAltoMm ?? orientAltoMm),
          }));
        }
      } catch (error) {
        console.error("No se pudo parsear la lista de productos", error);
      }
    }

    if (productos.length === 0) {
      const cantidadUnidad = Number(formData.get("cantidadUnidad"));
      const cantidadCalculada =
        Number.isFinite(cantidadUnidad) && cantidadUnidad > 0
          ? cantidadUnidad
          : unidadesEjeX * unidadesEjeY * unidadesEjeZ;

      productos = [
        {
          tipoProductoId,
          cantidad: cantidadCalculada,
          largoUnidadMm,
          anchoUnidadMm,
          altoUnidadMm,
          unidadesEjeX,
          unidadesEjeY,
          unidadesEjeZ,
          orientLargoMm,
          orientAnchoMm,
          orientAltoMm,
        },
      ];
    }

    await saveCubicacionProductoBulto({
      tipoProductoId,
      grosorParedMm,
      ocupacionInterna,
      productos,
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

  return <CubicacionUI contenedores={contenedores} productos={productos} camiones={camiones} />;
}
