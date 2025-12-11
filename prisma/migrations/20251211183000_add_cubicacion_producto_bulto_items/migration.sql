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

    UNIQUE INDEX `cubicacion_producto_bulto_item_cubicacion_producto_bulto_id_tipo_producto_id_key`(`cubicacion_producto_bulto_id`, `tipo_producto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_bulto_item` ADD CONSTRAINT `cubicacion_producto_bulto_item_cubicacion_producto_bulto_id_fkey` FOREIGN KEY (`cubicacion_producto_bulto_id`) REFERENCES `cubicacion_producto_bulto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_producto_bulto_item` ADD CONSTRAINT `cubicacion_producto_bulto_item_tipo_producto_id_fkey` FOREIGN KEY (`tipo_producto_id`) REFERENCES `tipo_producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
