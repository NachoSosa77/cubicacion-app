import { crearSimulacion } from "@/app/cubicacion/actions/simulacionActions";
import { redirect } from "next/navigation";

export default function SimulacionesPage() {
  async function crear() {
    "use server";

    const simulacion = await crearSimulacion({
  empresaId: 1,
  titulo: "Simulación nueva",
  descripcion: "Descripción de la simulación",
});

    redirect(`/cubicacion/simulacion/${simulacion.id}`);
  }

  

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">
        Simulaciones de cubicación
      </h1>

      <form action={crear}>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Nueva simulación
        </button>
      </form>
    </div>
  );
}
