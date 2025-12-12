import { PrismaClient } from "@prisma/client";
import { seedDivisionServicio } from "./seeds/seedDivisionServicio";
import { seedEmpresa } from "./seeds/seedEmpresa";
import { seedEmpresaBulto } from "./seeds/seedEmpresaBulto";
import { seedTipoContenedor } from "./seeds/seedTipoContenedor";
import { seedTipoProductoEjemplo } from "./seeds/seedTipoProductoEjemplo";

const prisma = new PrismaClient();

async function main() {
  await seedEmpresa();
  await seedEmpresaBulto(prisma);
  await seedTipoContenedor(prisma);
  await seedDivisionServicio(prisma);
  await seedTipoProductoEjemplo(prisma);
}

main()
  .then(async () => {
    console.log("🌱 Seed ejecutado correctamente");
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("❌ Error ejecutando seed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
