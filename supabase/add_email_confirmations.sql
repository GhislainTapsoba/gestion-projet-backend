-- Table email_confirmations
-- Pour gérer les confirmations d'actions par email
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
CREATE INDEX IF NOT EXISTS idx_email_confirmations_expires ON email_confirmations(expires_at);

-- Commentaire
COMMENT ON TABLE email_confirmations IS 'Tokens de confirmation pour les actions par email (démarrer une tâche, confirmer un changement, etc.)';
