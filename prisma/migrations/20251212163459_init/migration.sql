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
CREATE TABLE `cubicacion_producto_bulto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_producto_id` INTEGER NOT NULL,
    `largo_unidad_mm` INTEGER NOT NULL,
    `ancho_unidad_mm` INTEGER NOT NULL,
    `alto_unidad_mm` INTEGER NOT NULL,
    `grosor_pared_mm` INTEGER NOT NULL DEFAULT 0,
    `unidades_eje_x` INTEGER NOT NULL,
    `unidades_eje_y` INTEGER NOT NULL,
    `unidades_eje_z` INTEGER NOT NULL,
    `ocupacion_interna` DECIMAL(5, 2) NOT NULL DEFAULT 0.0,
    `orient_largo_mm` INTEGER NOT NULL,
    `orient_ancho_mm` INTEGER NOT NULL,
    `orient_alto_mm` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cubicacion_producto_bulto_tipo_producto_id_key`(`tipo_producto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cubicacion_producto_bulto_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cubicacion_producto_bulto_id` INTEGER NOT NULL,
    `tipo_producto_id` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `largo_unidad_mm` INTEGER NOT NULL,
    `ancho_unidad_mm` INTEGER NOT NULL,
    `alto_unidad_mm` INTEGER NOT NULL,
    `unidades_eje_x` INTEGER NOT NULL,
    `unidades_eje_y` INTEGER NOT NULL,
    `unidades_eje_z` INTEGER NOT NULL,
    `orient_largo_mm` INTEGER NOT NULL,
    `orient_ancho_mm` INTEGER NOT NULL,
    `orient_alto_mm` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cpb_item_unique`(`cubicacion_producto_bulto_id`, `tipo_producto_id`),
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
CREATE TABLE `cubicacion_producto_contenedor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_producto_id` INTEGER NOT NULL,
    `tipo_contenedor_id` INTEGER NOT NULL,
    `altura_max_carga_m` DECIMAL(6, 2) NULL,
    `cajas_por_capa` INTEGER NOT NULL,
    `capas` INTEGER NOT NULL,
    `cajas_totales` INTEGER NOT NULL,
    `productos_por_caja` INTEGER NOT NULL,
    `productos_totales` INTEGER NOT NULL,
    `ocupacion_volumen` DECIMAL(5, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cubicacion_producto_contenedor_tipo_producto_id_tipo_contene_key`(`tipo_producto_id`, `tipo_contenedor_id`),
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
CREATE TABLE `empresa_bulto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,
    `deleted_at` DATETIME(0) NULL,
    `habilitado` BOOLEAN NOT NULL DEFAULT true,
    `empresa_id` INTEGER NOT NULL,
    `codigo` VARCHAR(100) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `largo_mm` INTEGER NOT NULL,
    `ancho_mm` INTEGER NOT NULL,
    `alto_mm` INTEGER NOT NULL,
    `espesor_pared_mm` INTEGER NOT NULL DEFAULT 0,
    `tara_kg` DOUBLE NULL,
    `max_peso_kg` DOUBLE NULL,
    `es_preferido` BOOLEAN NOT NULL DEFAULT false,

    INDEX `empresa_bulto_empresa_id_habilitado_idx`(`empresa_id`, `habilitado`),
    UNIQUE INDEX `empresa_bulto_empresa_id_codigo_key`(`empresa_id`, `codigo`),
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
ALTER TABLE `tipo_producto` ADD CONSTRAINT `tipo_producto_division_servicio_id_fkey` FOREIGN KEY (`division_servicio_id`) REFERENCES `division_servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_bulto` ADD CONSTRAINT `cubicacion_producto_bulto_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_bulto_item` ADD CONSTRAINT `cpb_item_cpb_fk` FOREIGN KEY (`cubicacion_producto_bulto_id`) REFERENCES `cubicacion_producto_bulto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_bulto_item` ADD CONSTRAINT `cpb_item_tp_fk` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cubicacion` ADD CONSTRAINT `Cubicacion_tipoProductoId_fkey` FOREIGN KEY (`tipoProductoId`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_contenedor` ADD CONSTRAINT `cubicacion_producto_contenedor_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_contenedor` ADD CONSTRAINT `cubicacion_producto_contenedor_tipo_contenedor_id_fkey` FOREIGN KEY (`tipo_contenedor_id`) REFERENCES `tipo_contenedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE `cubicacion_regla` ADD CONSTRAINT `cubicacion_regla_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_regla` ADD CONSTRAINT `cubicacion_regla_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_regla` ADD CONSTRAINT `cubicacion_regla_tipo_contenedor_id_fkey` FOREIGN KEY (`tipo_contenedor_id`) REFERENCES `tipo_contenedor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_regla` ADD CONSTRAINT `cubicacion_regla_transporte_clasificacion_id_fkey` FOREIGN KEY (`transporte_clasificacion_id`) REFERENCES `transporte_clasificacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `empresa_bulto` ADD CONSTRAINT `empresa_bulto_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte` ADD CONSTRAINT `transporte_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte` ADD CONSTRAINT `transporte_clase_de_transporte_id_fkey` FOREIGN KEY (`clase_de_transporte_id`) REFERENCES `transporte_clase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte` ADD CONSTRAINT `transporte_transporte_clasificacion_id_fkey` FOREIGN KEY (`transporte_clasificacion_id`) REFERENCES `transporte_clasificacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
