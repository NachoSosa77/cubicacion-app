This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# cubicacion-app

## Guía rápida de Prisma (migraciones y seeds)

Como la base de datos depende de migraciones Prisma, no es necesario crear carpetas a mano dentro de `prisma/migrations`. Sigue estos pasos:

1. **Crear una nueva migración** (ejemplo: agregar una tabla pivote):
   ```bash
   npx prisma migrate dev --name add_cubicacion_producto_bulto_items
   ```
   Esto genera la carpeta y el `migration.sql` automáticamente, aplica los cambios a tu base local y actualiza el cliente de Prisma.

2. **Aplicar migraciones existentes** en tu entorno (sin regenerar datos):
   ```bash
   npx prisma migrate dev
   ```

3. **Recrear la base desde cero y volver a sembrar datos** (útil si los datos viejos no cumplen las nuevas restricciones):
   ```bash
   npx prisma migrate reset
   # Prisma ejecutará las migraciones y luego el seed configurado (por ejemplo, npm run seed)
   ```

4. **En producción/CI**, aplica sólo las migraciones sin tocar datos con:
   ```bash
   npx prisma migrate deploy
   ```

5. **Ejecutar seeds manualmente** si tu proyecto define scripts dedicados (p. ej. `npm run seed` o `npm run seed:cubicacion-test`) una vez aplicadas las migraciones.

> Tip: No borres tablas ni uses `prisma db push` en lugar de migraciones. Siempre trabaja con el flujo de `migrate` para mantener el historial consistente.
