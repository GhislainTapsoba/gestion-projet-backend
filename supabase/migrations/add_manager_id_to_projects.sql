-- Migration: Ajouter le champ manager_id à la table projects
-- Date: 2025-01-17

-- Ajouter la colonne manager_id
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS manager_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);

-- Mettre à jour les projets existants pour définir le manager_id au created_by_id par défaut
UPDATE projects
SET manager_id = created_by_id
WHERE manager_id IS NULL;

-- Commentaire sur la colonne
COMMENT ON COLUMN projects.manager_id IS 'ID du chef de projet responsable du projet';
