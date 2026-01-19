/*
  Warnings:

  - You are about to drop the column `lote_id` on the `cubicacion_producto_plan` table. All the data in the column will be lost.
  - The values [SELECCIONADA,DESCARTADA] on the enum `cubicacion_simulacion_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- DropForeignKey
ALTER TABLE `cubicacion_producto_plan` DROP FOREIGN KEY `cubicacion_producto_plan_lote_id_fkey`;

-- DropIndex
DROP INDEX `cubicacion_producto_plan_lote_id_idx` ON `cubicacion_producto_plan`;

-- AlterTable
ALTER TABLE `cubicacion_producto_plan` DROP COLUMN `lote_id`,
    ADD COLUMN `cubicacionLoteId` INTEGER NULL;

-- AlterTable
ALTER TABLE `cubicacion_simulacion` MODIFY `status` ENUM('BORRADOR', 'SELECCIONADO', 'DESCARTADO') NOT NULL DEFAULT 'BORRADOR';

-- AddForeignKey
ALTER TABLE `cubicacion_producto_plan` ADD CONSTRAINT `cubicacion_producto_plan_cubicacionLoteId_fkey` FOREIGN KEY (`cubicacionLoteId`) REFERENCES `cubicacion_lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
