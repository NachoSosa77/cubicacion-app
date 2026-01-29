-- AlterTable
ALTER TABLE `cubicacion_lote_item` ADD COLUMN `bulto_empresa_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `idx_lote_item_bulto_empresa_id` ON `cubicacion_lote_item`(`bulto_empresa_id`);
