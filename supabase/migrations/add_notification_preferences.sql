-- Migration: Créer la table notification_preferences
-- Date: 2025-01-17
-- Description: Gestion détaillée des préférences de notifications par type

-- Table notification_preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notifications Email pour les tâches
  email_task_assigned BOOLEAN DEFAULT TRUE,
  email_task_updated BOOLEAN DEFAULT TRUE,
  email_task_due BOOLEAN DEFAULT TRUE,

  -- Notifications Email pour les projets/étapes
  email_stage_completed BOOLEAN DEFAULT FALSE,
  email_project_created BOOLEAN DEFAULT TRUE,

  -- Notifications Push
  push_notifications BOOLEAN DEFAULT TRUE,

  -- Résumés
  daily_summary BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Créer des préférences par défaut pour les utilisateurs existants
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Commentaires
COMMENT ON TABLE notification_preferences IS 'Préférences détaillées de notifications par utilisateur';
COMMENT ON COLUMN notification_preferences.email_task_assigned IS 'Recevoir un email quand une tâche est assignée';
COMMENT ON COLUMN notification_preferences.email_task_updated IS 'Recevoir un email quand une tâche est mise à jour';
COMMENT ON COLUMN notification_preferences.email_task_due IS 'Recevoir un email avant la date d''échéance d''une tâche';
COMMENT ON COLUMN notification_preferences.email_stage_completed IS 'Recevoir un email quand une étape est complétée';
COMMENT ON COLUMN notification_preferences.email_project_created IS 'Recevoir un email quand un nouveau projet est créé';
COMMENT ON COLUMN notification_preferences.push_notifications IS 'Activer les notifications push dans le navigateur';
COMMENT ON COLUMN notification_preferences.daily_summary IS 'Recevoir un résumé quotidien par email';
