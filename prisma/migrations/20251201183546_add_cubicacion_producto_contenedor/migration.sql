-- CreateTable
CREATE TABLE `cubicacion_producto_contenedor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_producto_id` INTEGER NOT NULL,
    `tipo_contenedor_id` INTEGER NOT NULL,
    `altura_max_carga_m` DECIMAL(65, 30) NULL,
    `cajas_por_capa` INTEGER NOT NULL,
    `capas` INTEGER NOT NULL,
    `cajas_totales` INTEGER NOT NULL,
    `productos_por_caja` INTEGER NOT NULL,
    `productos_totales` INTEGER NOT NULL,
    `ocupacion_volumen` DECIMAL(65, 30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cubicacion_producto_contenedor_tipo_producto_id_tipo_contene_key`(`tipo_producto_id`, `tipo_contenedor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_contenedor` ADD CONSTRAINT `cubicacion_producto_contenedor_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_contenedor` ADD CONSTRAINT `cubicacion_producto_contenedor_tipo_contenedor_id_fkey` FOREIGN KEY (`tipo_contenedor_id`) REFERENCES `tipo_contenedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
