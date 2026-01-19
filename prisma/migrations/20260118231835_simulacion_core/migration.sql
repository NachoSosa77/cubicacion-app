/*
  Warnings:

  - Added the required column `empresa_id` to the `cubicacion_simulacion` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `cubicacion_simulacion` DROP FOREIGN KEY `cubicacion_simulacion_lote_id_fkey`;

-- AlterTable
ALTER TABLE `cubicacion_simulacion` ADD COLUMN `bultos_totales` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `descripcion` VARCHAR(191) NULL,
    ADD COLUMN `empresa_id` INTEGER NOT NULL,
    ADD COLUMN `meta` JSON NULL,
    ADD COLUMN `unidades_totales` INTEGER NOT NULL DEFAULT 0,
    MODIFY `lote_id` INTEGER NULL,
    MODIFY `titulo` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `cubicacion_producto_plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `simulacion_id` INTEGER NOT NULL,
    `lote_id` INTEGER NOT NULL,
    `tipo_producto_id` INTEGER NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `cantidad_unidades` INTEGER NOT NULL DEFAULT 0,
    `cantidad_bultos` INTEGER NOT NULL DEFAULT 0,
    `unidades_por_bulto` INTEGER NULL,
    `dim_unidad_mm` JSON NULL,
    `peso_unidad_kg` DOUBLE NULL,
    `dim_bulto_mm` JSON NULL,
    `peso_bulto_kg` DOUBLE NULL,
    `volumen_total_m3` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cubicacion_producto_plan_simulacion_id_idx`(`simulacion_id`),
    INDEX `cubicacion_producto_plan_lote_id_idx`(`lote_id`),
    INDEX `cubicacion_producto_plan_tipo_producto_id_idx`(`tipo_producto_id`),
    UNIQUE INDEX `uq_producto_plan_simulacion_codigo`(`simulacion_id`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cubicacion_bulto_plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `simulacion_id` INTEGER NOT NULL,
    `lote_id` INTEGER NULL,
    `tipo_bulto` ENUM('PRODUCTO_ESTANDAR', 'EMPRESA_BULTO') NOT NULL DEFAULT 'EMPRESA_BULTO',
    `bulto_empresa_id` INTEGER NULL,
    `unidades_totales` INTEGER NOT NULL DEFAULT 0,
    `bultos_totales` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('BORRADOR', 'SELECCIONADO', 'DESCARTADO') NOT NULL DEFAULT 'BORRADOR',
    `layout` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cubicacion_bulto_plan_simulacion_id_idx`(`simulacion_id`),
    INDEX `cubicacion_bulto_plan_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `cubicacion_simulacion_empresa_id_idx` ON `cubicacion_simulacion`(`empresa_id`);

-- AddForeignKey
ALTER TABLE `cubicacion_simulacion` ADD CONSTRAINT `cubicacion_simulacion_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_simulacion` ADD CONSTRAINT `cubicacion_simulacion_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `cubicacion_lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_plan` ADD CONSTRAINT `cubicacion_producto_plan_simulacion_id_fkey` FOREIGN KEY (`simulacion_id`) REFERENCES `cubicacion_simulacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_plan` ADD CONSTRAINT `cubicacion_producto_plan_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `cubicacion_lote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_plan` ADD CONSTRAINT `cubicacion_producto_plan_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_bulto_plan` ADD CONSTRAINT `cubicacion_bulto_plan_simulacion_id_fkey` FOREIGN KEY (`simulacion_id`) REFERENCES `cubicacion_simulacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_bulto_plan` ADD CONSTRAINT `cubicacion_bulto_plan_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `cubicacion_lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_bulto_plan` ADD CONSTRAINT `cubicacion_bulto_plan_bulto_empresa_id_fkey` FOREIGN KEY (`bulto_empresa_id`) REFERENCES `empresa_bulto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
