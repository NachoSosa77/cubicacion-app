import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedEmpresa() {
  console.log("🌱 Seeding empresa...");

  const empresa = await prisma.empresa.create({
    data: {
      codigo_empresa: "EMP-001",
      razon_social: "Empresa Demo Logística S.A.",
      habilitado: true,
    },
  });

  console.log("✅ Empresa creada:", empresa);

  return empresa;
}
