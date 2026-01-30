-- AlterTable
ALTER TABLE `empresa_bulto` ADD COLUMN `alto_int_mm` INTEGER NULL,
    ADD COLUMN `ancho_int_mm` INTEGER NULL,
    ADD COLUMN `largo_int_mm` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `cubicacion_lote_item` ADD CONSTRAINT `cubicacion_lote_item_bulto_empresa_id_fkey` FOREIGN KEY (`bulto_empresa_id`) REFERENCES `empresa_bulto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
