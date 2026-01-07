import { IEmpresaBulto } from "../../actions/empresaBultoActions";

const clampPos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

function dimsInternasFromEmpresaBulto(b: IEmpresaBulto) {
  const e = Number(b.espesor_pared_mm ?? 0);
  const largo = clampPos(Number(b.largo_mm) - 2 * e);
  const ancho = clampPos(Number(b.ancho_mm) - 2 * e);
  const alto = clampPos(Number(b.alto_mm) - 2 * e);

  return {
    dimExternaMm: {
      largo: Number(b.largo_mm),
      ancho: Number(b.ancho_mm),
      alto: Number(b.alto_mm),
    },
    dimInternaMm: { largo, ancho, alto },
  };
}
