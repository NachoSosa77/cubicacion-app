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
    `peso_por_unidad_venta` DECIMAL(10, 3) NULL,
    `peso_por_unidad_entrega` DECIMAL(10, 3) NULL,
    `volumen_por_unidad_entrega` DECIMAL(10, 6) NULL,
    `unidad_entra_por_bulto` INTEGER NOT NULL,
    `alto_por_bulto` INTEGER NOT NULL,
    `ancho_por_bulto` INTEGER NOT NULL,
    `largo_por_bulto` INTEGER NOT NULL,
    `apilable` BOOLEAN NOT NULL DEFAULT true,
    `max_carga_superior_por_unidad_kg` DECIMAL(10, 3) NULL,
    `factor_seguridad_compresion` DECIMAL(5, 3) NOT NULL DEFAULT 1.000,
    `peso_por_bulto` DECIMAL(10, 3) NULL,
    `volumen_por_bulto` DECIMAL(10, 6) NULL,

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
CREATE TABLE `cubicacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `descripcion` VARCHAR(191) NULL,
    `tipoProductoId` INTEGER NOT NULL,
    `cantidad_unidades` INTEGER NOT NULL,
    `cantidadBultos` INTEGER NOT NULL,
    `volumenTotalM3` DOUBLE NOT NULL,
    `packing_policy` ENUM('OPERATIVO_AGRUPADO', 'OPTIMIZAR_VOLUMEN', 'BUSCAR_MEJOR_ACOMODO') NOT NULL DEFAULT 'OPERATIVO_AGRUPADO',
    `tipo_bulto` ENUM('PRODUCTO_ESTANDAR', 'EMPRESA_BULTO') NOT NULL DEFAULT 'EMPRESA_BULTO',
    `bulto_empresa_id` INTEGER NULL,

    INDEX `cubicacion_tipoProductoId_idx`(`tipoProductoId`),
    INDEX `cubicacion_bulto_empresa_id_idx`(`bulto_empresa_id`),
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
    `largo_mts` DOUBLE NULL,
    `ancho_mts` DOUBLE NULL,
    `alto_mts` DOUBLE NULL,
    `peso_pallet_kg` DOUBLE NULL,
    `peso_max_kg` DOUBLE NULL,
    `peso_max_lts` DOUBLE NULL,

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
    `max_peso_kg` DECIMAL(10, 2) NULL,
    `max_peso_por_capa_kg` DECIMAL(10, 2) NULL,
    `fragiles_policy` ENUM('FRAGILES_ARRIBA', 'PERMITIR_MEZCLA', 'BLOQUEAR_MEZCLA') NOT NULL DEFAULT 'FRAGILES_ARRIBA',
    `no_pesados_sobre_fragiles` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_empresa_producto_contenedor_transporte`(`empresa_id`, `tipo_producto_id`, `tipo_contenedor_id`, `transporte_clasificacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cubicacion_configuracion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `descripcion` VARCHAR(191) NULL,
    `packing_policy` ENUM('OPERATIVO_AGRUPADO', 'OPTIMIZAR_VOLUMEN', 'BUSCAR_MEJOR_ACOMODO') NOT NULL DEFAULT 'OPERATIVO_AGRUPADO',
    `tipo_bulto` ENUM('PRODUCTO_ESTANDAR', 'EMPRESA_BULTO') NOT NULL DEFAULT 'EMPRESA_BULTO',
    `bulto_empresa_id` INTEGER NULL,
    `tipo_contenedor_id` INTEGER NULL,

    INDEX `cubicacion_configuracion_bulto_empresa_id_idx`(`bulto_empresa_id`),
    INDEX `cubicacion_configuracion_tipo_contenedor_id_idx`(`tipo_contenedor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cubicacion_configuracion_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `configuracion_id` INTEGER NOT NULL,
    `tipo_producto_id` INTEGER NOT NULL,
    `cantidad_unidades` INTEGER NOT NULL,
    `volumen_unidad_m3` DOUBLE NOT NULL,
    `volumen_total_m3` DOUBLE NOT NULL,
    `largo_unidad_mm` INTEGER NOT NULL,
    `ancho_unidad_mm` INTEGER NOT NULL,
    `alto_unidad_mm` INTEGER NOT NULL,

    INDEX `cubicacion_configuracion_item_configuracion_id_idx`(`configuracion_id`),
    INDEX `cubicacion_configuracion_item_tipo_producto_id_idx`(`tipo_producto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulto_armado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `configuracion_id` INTEGER NOT NULL,
    `indice` INTEGER NOT NULL,
    `tipo_bulto` ENUM('PRODUCTO_ESTANDAR', 'EMPRESA_BULTO') NOT NULL,
    `bulto_empresa_id` INTEGER NULL,
    `largo_ext_mm` INTEGER NOT NULL,
    `ancho_ext_mm` INTEGER NOT NULL,
    `alto_ext_mm` INTEGER NOT NULL,
    `largo_int_mm` INTEGER NOT NULL,
    `ancho_int_mm` INTEGER NOT NULL,
    `alto_int_mm` INTEGER NOT NULL,
    `unidades_totales` INTEGER NOT NULL,
    `volumen_ocupado_m3` DOUBLE NOT NULL,
    `ocupacion_pct` DOUBLE NOT NULL,
    `peso_total_kg` DECIMAL(10, 3) NULL,

    INDEX `bulto_armado_bulto_empresa_id_idx`(`bulto_empresa_id`),
    UNIQUE INDEX `bulto_armado_configuracion_id_indice_key`(`configuracion_id`, `indice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulto_armado_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bulto_armado_id` INTEGER NOT NULL,
    `tipo_producto_id` INTEGER NOT NULL,
    `unidades` INTEGER NOT NULL,
    `largo_unidad_mm` INTEGER NOT NULL,
    `ancho_unidad_mm` INTEGER NOT NULL,
    `alto_unidad_mm` INTEGER NOT NULL,
    `peso_unidad_kg` DECIMAL(10, 3) NULL,

    INDEX `bulto_armado_item_bulto_armado_id_idx`(`bulto_armado_id`),
    INDEX `bulto_armado_item_tipo_producto_id_idx`(`tipo_producto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulto_armado_placement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bulto_armado_id` INTEGER NOT NULL,
    `tipo_producto_id` INTEGER NULL,
    `codigo` VARCHAR(100) NOT NULL,
    `x_mm` DOUBLE NOT NULL,
    `y_mm` DOUBLE NOT NULL,
    `z_mm` DOUBLE NOT NULL,
    `largo_mm` INTEGER NOT NULL,
    `ancho_mm` INTEGER NOT NULL,
    `alto_mm` INTEGER NOT NULL,

    INDEX `bulto_armado_placement_bulto_armado_id_idx`(`bulto_armado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `palletizacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `configuracion_id` INTEGER NOT NULL,
    `tipo_contenedor_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `pallets_totales` INTEGER NOT NULL,
    `ocupacion_global_pct` DOUBLE NOT NULL,
    `peso_total_kg` DECIMAL(10, 2) NULL,

    INDEX `palletizacion_configuracion_id_idx`(`configuracion_id`),
    INDEX `palletizacion_tipo_contenedor_id_idx`(`tipo_contenedor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `palletizacion_pallet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `palletizacion_id` INTEGER NOT NULL,
    `indice` INTEGER NOT NULL,
    `largo_int_mm` INTEGER NOT NULL,
    `ancho_int_mm` INTEGER NOT NULL,
    `alto_int_mm` INTEGER NOT NULL,
    `ocupacion_pct` DOUBLE NOT NULL,
    `peso_kg` DECIMAL(10, 2) NULL,

    UNIQUE INDEX `palletizacion_pallet_palletizacion_id_indice_key`(`palletizacion_id`, `indice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `palletizacion_placement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pallet_id` INTEGER NOT NULL,
    `bulto_armado_id` INTEGER NOT NULL,
    `x_mm` DOUBLE NOT NULL,
    `y_mm` DOUBLE NOT NULL,
    `z_mm` DOUBLE NOT NULL,
    `largo_mm` INTEGER NOT NULL,
    `ancho_mm` INTEGER NOT NULL,
    `alto_mm` INTEGER NOT NULL,
    `capa` INTEGER NOT NULL,

    INDEX `palletizacion_placement_pallet_id_idx`(`pallet_id`),
    INDEX `palletizacion_placement_bulto_armado_id_idx`(`bulto_armado_id`),
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
    `largo_int_mm` INTEGER NULL,
    `ancho_int_mm` INTEGER NULL,
    `alto_int_mm` INTEGER NULL,
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

-- CreateTable
CREATE TABLE `cubicacion_lote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `status` ENUM('BORRADOR', 'SELECCIONADO', 'DESCARTADO') NOT NULL DEFAULT 'BORRADOR',
    `meta` JSON NULL,
    `unidades_totales` INTEGER NOT NULL DEFAULT 0,
    `bultos_totales` INTEGER NOT NULL DEFAULT 0,
    `packing_policy` ENUM('OPERATIVO_AGRUPADO', 'OPTIMIZAR_VOLUMEN', 'BUSCAR_MEJOR_ACOMODO') NOT NULL DEFAULT 'OPERATIVO_AGRUPADO',
    `tipo_bulto` ENUM('PRODUCTO_ESTANDAR', 'EMPRESA_BULTO') NOT NULL DEFAULT 'EMPRESA_BULTO',
    `bulto_empresa_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `bulto_layout` JSON NULL,

    INDEX `idx_lote_empresa`(`empresa_id`),
    INDEX `cubicacion_lote_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cubicacion_lote_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lote_id` INTEGER NOT NULL,
    `tipo_producto_id` INTEGER NOT NULL,
    `cantidad_unidades` INTEGER NOT NULL,
    `cantidad_bultos` INTEGER NOT NULL DEFAULT 1,
    `unidades_por_bulto` INTEGER NULL,
    `unidades_en_ultimo_bulto` INTEGER NULL DEFAULT 0,
    `sobrante_unidades` INTEGER NOT NULL DEFAULT 0,
    `volumen_total_m3` DOUBLE NOT NULL,
    `dim_unidad_mm` JSON NULL,
    `peso_unidad_kg` DOUBLE NULL,
    `dim_bulto_mm` JSON NULL,
    `bulto_empresa_id` INTEGER NULL,
    `bulto_fuente` ENUM('CATALOGO', 'OPERATIVO', 'EMPRESA_BULTO') NOT NULL DEFAULT 'CATALOGO',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_lote_item`(`lote_id`),
    INDEX `cubicacion_lote_item_tipo_producto_id_idx`(`tipo_producto_id`),
    INDEX `idx_lote_item_bulto_fuente`(`bulto_fuente`),
    INDEX `idx_lote_item_bulto_empresa_id`(`bulto_empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cubicacion_pallet_plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lote_id` INTEGER NOT NULL,
    `tipo_contenedor_id` INTEGER NOT NULL,
    `permitir_mezcla` BOOLEAN NOT NULL DEFAULT true,
    `max_codigos_por_pallet` INTEGER NULL,
    `max_altura_mm` INTEGER NULL,
    `pallets_necesarios` INTEGER NOT NULL,
    `ocupacion_volumen_pct` DECIMAL(5, 2) NOT NULL,
    `peso_total_kg` DOUBLE NOT NULL,
    `altura_utilizada_mm` INTEGER NOT NULL,
    `simulacion_id` INTEGER NULL,
    `layout` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `candidate_key` ENUM('A', 'B', 'C') NOT NULL DEFAULT 'A',

    INDEX `idx_pallet_plan_lote`(`lote_id`),
    INDEX `cubicacion_pallet_plan_simulacion_id_idx`(`simulacion_id`),
    UNIQUE INDEX `uq_lote_contenedor_candidate`(`lote_id`, `tipo_contenedor_id`, `candidate_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cubicacion_camion_plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lote_id` INTEGER NOT NULL,
    `transporte_id` INTEGER NOT NULL,
    `strategy` ENUM('ESTABLE', 'OPTIMIZAR', 'DESCARGA_RAPIDA') NOT NULL,
    `status` ENUM('BORRADOR', 'SELECCIONADO', 'DESCARTADO') NOT NULL DEFAULT 'BORRADOR',
    `pallets_totales` INTEGER NOT NULL,
    `pallets_en_camion` INTEGER NOT NULL,
    `camiones_requeridos` INTEGER NOT NULL,
    `peso_total_kg` DOUBLE NOT NULL,
    `ocupacion_base_pct` DECIMAL(6, 2) NOT NULL,
    `layout` JSON NOT NULL,
    `simulacion_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cubicacion_camion_plan_lote_id_idx`(`lote_id`),
    INDEX `cubicacion_camion_plan_transporte_id_idx`(`transporte_id`),
    INDEX `cubicacion_camion_plan_lote_id_transporte_id_idx`(`lote_id`, `transporte_id`),
    INDEX `cubicacion_camion_plan_status_idx`(`status`),
    INDEX `cubicacion_camion_plan_simulacion_id_idx`(`simulacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cubicacion_simulacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `lote_id` INTEGER NULL,
    `titulo` VARCHAR(191) NULL,
    `descripcion` VARCHAR(191) NULL,
    `status` ENUM('BORRADOR', 'SELECCIONADO', 'DESCARTADO') NOT NULL DEFAULT 'BORRADOR',
    `unidades_totales` INTEGER NOT NULL DEFAULT 0,
    `bultos_totales` INTEGER NOT NULL DEFAULT 0,
    `meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cubicacion_simulacion_empresa_id_idx`(`empresa_id`),
    INDEX `cubicacion_simulacion_lote_id_idx`(`lote_id`),
    INDEX `cubicacion_simulacion_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cubicacion_producto_plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `simulacion_id` INTEGER NOT NULL,
    `tipo_producto_id` INTEGER NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `cantidad_unidades` INTEGER NOT NULL DEFAULT 0,
    `cantidad_bultos` INTEGER NOT NULL DEFAULT 0,
    `unidades_por_bulto` INTEGER NULL,
    `unidades_en_ultimo_bulto` INTEGER NULL DEFAULT 0,
    `sobrante_unidades` INTEGER NOT NULL DEFAULT 0,
    `dim_unidad_mm` JSON NULL,
    `peso_unidad_kg` DOUBLE NULL,
    `dim_bulto_mm` JSON NULL,
    `peso_bulto_kg` DOUBLE NULL,
    `volumen_total_m3` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `cubicacionLoteId` INTEGER NULL,

    INDEX `cubicacion_producto_plan_simulacion_id_idx`(`simulacion_id`),
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

-- AddForeignKey
ALTER TABLE `tipo_producto` ADD CONSTRAINT `tipo_producto_division_servicio_id_fkey` FOREIGN KEY (`division_servicio_id`) REFERENCES `division_servicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_bulto` ADD CONSTRAINT `cubicacion_producto_bulto_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_bulto_item` ADD CONSTRAINT `cpb_item_cpb_fk` FOREIGN KEY (`cubicacion_producto_bulto_id`) REFERENCES `cubicacion_producto_bulto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_bulto_item` ADD CONSTRAINT `cpb_item_tp_fk` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion` ADD CONSTRAINT `cubicacion_tipoProductoId_fkey` FOREIGN KEY (`tipoProductoId`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion` ADD CONSTRAINT `cubicacion_bulto_empresa_id_fkey` FOREIGN KEY (`bulto_empresa_id`) REFERENCES `empresa_bulto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE `cubicacion_configuracion` ADD CONSTRAINT `cubicacion_configuracion_bulto_empresa_id_fkey` FOREIGN KEY (`bulto_empresa_id`) REFERENCES `empresa_bulto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_configuracion` ADD CONSTRAINT `cubicacion_configuracion_tipo_contenedor_id_fkey` FOREIGN KEY (`tipo_contenedor_id`) REFERENCES `tipo_contenedor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_configuracion_item` ADD CONSTRAINT `cubicacion_configuracion_item_configuracion_id_fkey` FOREIGN KEY (`configuracion_id`) REFERENCES `cubicacion_configuracion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_configuracion_item` ADD CONSTRAINT `cubicacion_configuracion_item_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulto_armado` ADD CONSTRAINT `bulto_armado_configuracion_id_fkey` FOREIGN KEY (`configuracion_id`) REFERENCES `cubicacion_configuracion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulto_armado` ADD CONSTRAINT `bulto_armado_bulto_empresa_id_fkey` FOREIGN KEY (`bulto_empresa_id`) REFERENCES `empresa_bulto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulto_armado_item` ADD CONSTRAINT `bulto_armado_item_bulto_armado_id_fkey` FOREIGN KEY (`bulto_armado_id`) REFERENCES `bulto_armado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulto_armado_item` ADD CONSTRAINT `bulto_armado_item_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulto_armado_placement` ADD CONSTRAINT `bulto_armado_placement_bulto_armado_id_fkey` FOREIGN KEY (`bulto_armado_id`) REFERENCES `bulto_armado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulto_armado_placement` ADD CONSTRAINT `bulto_armado_placement_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `palletizacion` ADD CONSTRAINT `palletizacion_configuracion_id_fkey` FOREIGN KEY (`configuracion_id`) REFERENCES `cubicacion_configuracion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `palletizacion` ADD CONSTRAINT `palletizacion_tipo_contenedor_id_fkey` FOREIGN KEY (`tipo_contenedor_id`) REFERENCES `tipo_contenedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `palletizacion_pallet` ADD CONSTRAINT `palletizacion_pallet_palletizacion_id_fkey` FOREIGN KEY (`palletizacion_id`) REFERENCES `palletizacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `palletizacion_placement` ADD CONSTRAINT `palletizacion_placement_pallet_id_fkey` FOREIGN KEY (`pallet_id`) REFERENCES `palletizacion_pallet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `palletizacion_placement` ADD CONSTRAINT `palletizacion_placement_bulto_armado_id_fkey` FOREIGN KEY (`bulto_armado_id`) REFERENCES `bulto_armado`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `empresa_bulto` ADD CONSTRAINT `empresa_bulto_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte` ADD CONSTRAINT `transporte_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte` ADD CONSTRAINT `transporte_clase_de_transporte_id_fkey` FOREIGN KEY (`clase_de_transporte_id`) REFERENCES `transporte_clase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transporte` ADD CONSTRAINT `transporte_transporte_clasificacion_id_fkey` FOREIGN KEY (`transporte_clasificacion_id`) REFERENCES `transporte_clasificacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_lote` ADD CONSTRAINT `cubicacion_lote_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_lote` ADD CONSTRAINT `cubicacion_lote_bulto_empresa_id_fkey` FOREIGN KEY (`bulto_empresa_id`) REFERENCES `empresa_bulto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_lote_item` ADD CONSTRAINT `cubicacion_lote_item_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `cubicacion_lote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_lote_item` ADD CONSTRAINT `cubicacion_lote_item_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_lote_item` ADD CONSTRAINT `cubicacion_lote_item_bulto_empresa_id_fkey` FOREIGN KEY (`bulto_empresa_id`) REFERENCES `empresa_bulto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_pallet_plan` ADD CONSTRAINT `cubicacion_pallet_plan_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `cubicacion_lote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_pallet_plan` ADD CONSTRAINT `cubicacion_pallet_plan_tipo_contenedor_id_fkey` FOREIGN KEY (`tipo_contenedor_id`) REFERENCES `tipo_contenedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_pallet_plan` ADD CONSTRAINT `cubicacion_pallet_plan_simulacion_id_fkey` FOREIGN KEY (`simulacion_id`) REFERENCES `cubicacion_simulacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_camion_plan` ADD CONSTRAINT `cubicacion_camion_plan_simulacion_id_fkey` FOREIGN KEY (`simulacion_id`) REFERENCES `cubicacion_simulacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_camion_plan` ADD CONSTRAINT `cubicacion_camion_plan_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `cubicacion_lote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_camion_plan` ADD CONSTRAINT `cubicacion_camion_plan_transporte_id_fkey` FOREIGN KEY (`transporte_id`) REFERENCES `transporte_clasificacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_simulacion` ADD CONSTRAINT `cubicacion_simulacion_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_simulacion` ADD CONSTRAINT `cubicacion_simulacion_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `cubicacion_lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_plan` ADD CONSTRAINT `cubicacion_producto_plan_simulacion_id_fkey` FOREIGN KEY (`simulacion_id`) REFERENCES `cubicacion_simulacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_plan` ADD CONSTRAINT `cubicacion_producto_plan_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_plan` ADD CONSTRAINT `cubicacion_producto_plan_cubicacionLoteId_fkey` FOREIGN KEY (`cubicacionLoteId`) REFERENCES `cubicacion_lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_bulto_plan` ADD CONSTRAINT `cubicacion_bulto_plan_simulacion_id_fkey` FOREIGN KEY (`simulacion_id`) REFERENCES `cubicacion_simulacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_bulto_plan` ADD CONSTRAINT `cubicacion_bulto_plan_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `cubicacion_lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_bulto_plan` ADD CONSTRAINT `cubicacion_bulto_plan_bulto_empresa_id_fkey` FOREIGN KEY (`bulto_empresa_id`) REFERENCES `empresa_bulto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
