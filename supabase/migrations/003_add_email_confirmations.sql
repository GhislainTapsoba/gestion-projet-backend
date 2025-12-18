-- Table pour les confirmations par email (tokens)
CREATE TABLE IF NOT EXISTS email_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('TASK_ASSIGNMENT', 'TASK_STATUS_CHANGE', 'STAGE_STATUS_CHANGE', 'PROJECT_CREATED')),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB,
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_email_confirmations_token ON email_confirmations(token);
CREATE INDEX IF NOT EXISTS idx_email_confirmations_user ON email_confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_email_confirmations_entity ON email_confirmations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_email_confirmations_confirmed ON email_confirmations(confirmed);
CREATE INDEX IF NOT EXISTS idx_email_confirmations_expires ON email_confirmations(expires_at);

-- Fonction pour nettoyer les tokens expirés (à exécuter périodiquement)
CREATE OR REPLACE FUNCTION cleanup_expired_email_confirmations()
RETURNS void AS $$
BEGIN
  DELETE FROM email_confirmations
  WHERE expires_at < NOW() AND confirmed = FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE email_confirmations IS 'Stocke les tokens de confirmation pour les actions par email';
COMMENT ON COLUMN email_confirmations.token IS 'Token unique pour la confirmation';
COMMENT ON COLUMN email_confirmations.type IS 'Type de confirmation (assignation, changement de statut, etc.)';
COMMENT ON COLUMN email_confirmations.expires_at IS 'Date d expiration du token (généralement 7 jours)';

