-- CreateTable
CREATE TABLE `tipo_producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `division_servicio_id` INTEGER NOT NULL,
    `dadora_id` INTEGER NOT NULL,
    `un_venta_id` INTEGER NOT NULL,
    `un_entrega_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `habilitado` BOOLEAN NOT NULL DEFAULT true,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `unidades_por_unidad_entrega` INTEGER NOT NULL,
    `peso_por_unidad_venta` INTEGER NOT NULL,
    `peso_por_uniad_entrega` INTEGER NOT NULL,
    `volumen_por_unidad_entrega` INTEGER NOT NULL,
    `unidad_entra_por_bulto` INTEGER NOT NULL,
    `alto_por_bulto` INTEGER NOT NULL,
    `ancho_por_bulto` INTEGER NOT NULL,
    `largo_por_bulto` INTEGER NOT NULL,
    `peso_por_bulto` INTEGER NOT NULL,
    `volumen_por_bulto` INTEGER NOT NULL,

    UNIQUE INDEX `tipo_producto_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cubicacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `descripcion` VARCHAR(191) NULL,
    `tipoProductoId` INTEGER NOT NULL,
    `cantidadBultos` INTEGER NOT NULL,
    `volumenTotalM3` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipo_contenedor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `habilitado` BOOLEAN NOT NULL DEFAULT true,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `largo_mts` DOUBLE NOT NULL,
    `ancho_mts` DOUBLE NOT NULL,
    `alto_mts` DOUBLE NOT NULL,
    `peso_pallet_kg` DOUBLE NOT NULL,
    `peso_max_kg` DOUBLE NOT NULL,
    `peso_max_lts` DOUBLE NOT NULL,

    UNIQUE INDEX `tipo_contenedor_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipo_contenedor_producto` (
    `tipo_contenedor_id` INTEGER NOT NULL,
    `tipo_producto_id` INTEGER NOT NULL,
    `cantidad_max_items` INTEGER NOT NULL,

    PRIMARY KEY (`tipo_contenedor_id`, `tipo_producto_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `division_servicio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `habilitado` BOOLEAN NOT NULL DEFAULT true,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `division_servicio_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipo_unidad_medida` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `habilitado` BOOLEAN NOT NULL DEFAULT true,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `tipo_unidad_medida_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipo_unidad_medida_entrega` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `division_servicio_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `habilitado` BOOLEAN NOT NULL DEFAULT true,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `tipo_unidad_medida_entrega_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipo_unidad_medida_venta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `division_servicio_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `habilitado` BOOLEAN NOT NULL DEFAULT true,
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `tipo_unidad_medida_venta_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transporte_clase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `transporte_clase_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transporte_clasificacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clase_transporte_id` INTEGER NULL,
    `division_servicio_id` INTEGER NOT NULL,
    `denominacion_de_vehiculo` VARCHAR(191) NOT NULL,
    `mt_largo_cub` INTEGER NOT NULL,
    `mt_ancho_cub` INTEGER NOT NULL,
    `mt_alto_cub` INTEGER NOT NULL,
    `mt_total_cub` INTEGER NOT NULL,
    `max_peso_kg` INTEGER NOT NULL,
    `max_peso_lt` INTEGER NOT NULL,
    `max_peso_xmt3` INTEGER NOT NULL,
    `pallet_europaleta_total` INTEGER NOT NULL,
    `pallet_ariog_total` VARCHAR(191) NOT NULL,
    `pallet_americano_total` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tipo_producto` ADD CONSTRAINT `tipo_producto_division_servicio_id_fkey` FOREIGN KEY (`division_servicio_id`) REFERENCES `division_servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cubicacion` ADD CONSTRAINT `Cubicacion_tipoProductoId_fkey` FOREIGN KEY (`tipoProductoId`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tipo_contenedor_producto` ADD CONSTRAINT `tipo_contenedor_producto_tipo_contenedor_id_fkey` FOREIGN KEY (`tipo_contenedor_id`) REFERENCES `tipo_contenedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tipo_contenedor_producto` ADD CONSTRAINT `tipo_contenedor_producto_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tipo_unidad_medida_entrega` ADD CONSTRAINT `tipo_unidad_medida_entrega_division_servicio_id_fkey` FOREIGN KEY (`division_servicio_id`) REFERENCES `division_servicio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tipo_unidad_medida_venta` ADD CONSTRAINT `tipo_unidad_medida_venta_division_servicio_id_fkey` FOREIGN KEY (`division_servicio_id`) REFERENCES `division_servicio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte_clasificacion` ADD CONSTRAINT `transporte_clasificacion_clase_transporte_id_fkey` FOREIGN KEY (`clase_transporte_id`) REFERENCES `transporte_clase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte_clasificacion` ADD CONSTRAINT `transporte_clasificacion_division_servicio_id_fkey` FOREIGN KEY (`division_servicio_id`) REFERENCES `division_servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
