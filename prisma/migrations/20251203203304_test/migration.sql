/*
  Warnings:

  - You are about to alter the column `ocupacion_interna` on the `cubicacion_producto_bulto` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(5,2)`.
  - You are about to alter the column `altura_max_carga_m` on the `cubicacion_producto_contenedor` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(6,2)`.
  - You are about to alter the column `ocupacion_volumen` on the `cubicacion_producto_contenedor` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(5,2)`.

*/
-- AlterTable
ALTER TABLE `cubicacion_producto_bulto` MODIFY `ocupacion_interna` DECIMAL(5, 2) NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE `cubicacion_producto_contenedor` MODIFY `altura_max_carga_m` DECIMAL(6, 2) NULL,
    MODIFY `ocupacion_volumen` DECIMAL(5, 2) NOT NULL;

-- CreateTable
CREATE TABLE `cubicacion_regla` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `tipo_producto_id` INTEGER NULL,
    `tipo_contenedor_id` INTEGER NULL,
    `transporte_clasificacion_id` INTEGER NULL,
    `max_codigos_por_pallet` INTEGER NULL,
    `max_altura_m` DECIMAL(6, 2) NULL,
    `permitir_mezcla` BOOLEAN NOT NULL DEFAULT true,
    `orientacion_forzada` ENUM('LARGO', 'ANCHO', 'ALTO') NULL,
    `observaciones` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_empresa_producto_contenedor_transporte`(`empresa_id`, `tipo_producto_id`, `tipo_contenedor_id`, `transporte_clasificacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empresa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo_empresa` VARCHAR(255) NOT NULL,
    `razon_social` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL,
    `deleted_at` DATETIME(0) NULL,
    `habilitado` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transporte` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `clase_de_transporte_id` INTEGER NULL,
    `transporte_clasificacion_id` INTEGER NULL,
    `dominio` VARCHAR(255) NOT NULL,
    `motor` VARCHAR(255) NOT NULL,
    `chasis` VARCHAR(255) NOT NULL,
    `ano` VARCHAR(255) NOT NULL,
    `descripcion` VARCHAR(255) NOT NULL,

    INDEX `IDX_TRANSPORTE_EMPRESA`(`empresa_id`),
    INDEX `IDX_336ADCB45F23D074`(`clase_de_transporte_id`),
    INDEX `IDX_336ADCB4CLASF`(`transporte_clasificacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cubicacion_regla` ADD CONSTRAINT `cubicacion_regla_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_regla` ADD CONSTRAINT `cubicacion_regla_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_regla` ADD CONSTRAINT `cubicacion_regla_tipo_contenedor_id_fkey` FOREIGN KEY (`tipo_contenedor_id`) REFERENCES `tipo_contenedor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_regla` ADD CONSTRAINT `cubicacion_regla_transporte_clasificacion_id_fkey` FOREIGN KEY (`transporte_clasificacion_id`) REFERENCES `transporte_clasificacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte` ADD CONSTRAINT `transporte_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte` ADD CONSTRAINT `transporte_clase_de_transporte_id_fkey` FOREIGN KEY (`clase_de_transporte_id`) REFERENCES `transporte_clase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte` ADD CONSTRAINT `transporte_transporte_clasificacion_id_fkey` FOREIGN KEY (`transporte_clasificacion_id`) REFERENCES `transporte_clasificacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
