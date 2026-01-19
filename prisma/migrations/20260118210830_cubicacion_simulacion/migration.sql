-- CreateTable
CREATE TABLE `cubicacion_simulacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lote_id` INTEGER NOT NULL,
    `titulo` VARCHAR(160) NULL,
    `status` ENUM('BORRADOR', 'SELECCIONADA', 'DESCARTADA') NOT NULL DEFAULT 'BORRADOR',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cubicacion_simulacion_lote_id_idx`(`lote_id`),
    INDEX `cubicacion_simulacion_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cubicacion_simulacion` ADD CONSTRAINT `cubicacion_simulacion_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `cubicacion_lote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
