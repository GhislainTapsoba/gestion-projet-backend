-- Migration: Ajouter la table user_settings
-- Date: 2025-01-17

-- Table user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language VARCHAR(10) DEFAULT 'fr',
  timezone VARCHAR(50) DEFAULT 'Europe/Paris',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Créer des settings par défaut pour les utilisateurs existants
INSERT INTO user_settings (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT (user_id) DO NOTHING;

-- Commentaires
COMMENT ON TABLE user_settings IS 'Paramètres personnalisés de l''utilisateur';
COMMENT ON COLUMN user_settings.language IS 'Langue de l''interface (fr, en, etc.)';
COMMENT ON COLUMN user_settings.timezone IS 'Fuseau horaire de l''utilisateur';
COMMENT ON COLUMN user_settings.notifications_enabled IS 'Activer/désactiver toutes les notifications';
COMMENT ON COLUMN user_settings.email_notifications IS 'Activer/désactiver les notifications par email';
COMMENT ON COLUMN user_settings.theme IS 'Thème de l''interface (light, dark, auto)';
