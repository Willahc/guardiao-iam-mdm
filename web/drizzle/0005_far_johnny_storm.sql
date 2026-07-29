DELETE FROM `installed_applications`
WHERE `id` NOT IN (
  SELECT MIN(`id`) FROM `installed_applications` GROUP BY `notebook_id`, `name`
);--> statement-breakpoint
CREATE UNIQUE INDEX `installed_applications_notebook_name_unique` ON `installed_applications` (`notebook_id`,`name`);--> statement-breakpoint
UPDATE `notebooks`
SET `status` = 'assigned', `custody_location` = 'Com colaborador'
WHERE `id` IN (
  SELECT `notebook_id` FROM `users` WHERE `status` = 'active' AND `notebook_id` IS NOT NULL
);--> statement-breakpoint
UPDATE `notebooks`
SET `status` = 'return_requested', `custody_location` = 'Com ex-colaborador'
WHERE `id` IN (
  SELECT `notebook_id` FROM `users` WHERE `status` = 'suspended' AND `notebook_id` IS NOT NULL
)
AND `id` NOT IN (
  SELECT `notebook_id` FROM `users` WHERE `status` = 'active' AND `notebook_id` IS NOT NULL
);--> statement-breakpoint
UPDATE `notebooks`
SET `custody_location` = 'Estoque TI'
WHERE `status` = 'available';--> statement-breakpoint
INSERT INTO `asset_work_orders`
  (`notebook_id`, `order_type`, `status`, `assignee`, `due_at`, `checklist`, `notes`, `created_by`, `created_at`)
SELECT
  u.`notebook_id`, 'offboarding_return', 'open', 'Logística reversa', NULL,
  '["Solicitar devolução","Confirmar acessórios","Acompanhar transporte","Receber e conferir"]',
  'Regularização automática de ativo vinculado a colaborador suspenso',
  'migração de consistência', datetime('now')
FROM `users` u
WHERE u.`status` = 'suspended' AND u.`notebook_id` IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM `asset_work_orders` wo
  WHERE wo.`notebook_id` = u.`notebook_id` AND wo.`order_type` = 'offboarding_return' AND wo.`status` = 'open'
);
