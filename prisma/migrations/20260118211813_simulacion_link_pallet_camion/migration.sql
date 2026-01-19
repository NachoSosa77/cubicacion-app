-- AlterTable
ALTER TABLE `cubicacion_camion_plan` ADD COLUMN `simulacion_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `cubicacion_pallet_plan` ADD COLUMN `simulacion_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `cubicacion_camion_plan_simulacion_id_idx` ON `cubicacion_camion_plan`(`simulacion_id`);

-- CreateIndex
CREATE INDEX `cubicacion_pallet_plan_simulacion_id_idx` ON `cubicacion_pallet_plan`(`simulacion_id`);

-- AddForeignKey
ALTER TABLE `cubicacion_pallet_plan` ADD CONSTRAINT `cubicacion_pallet_plan_simulacion_id_fkey` FOREIGN KEY (`simulacion_id`) REFERENCES `cubicacion_simulacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cubicacion_camion_plan` ADD CONSTRAINT `cubicacion_camion_plan_simulacion_id_fkey` FOREIGN KEY (`simulacion_id`) REFERENCES `cubicacion_simulacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
