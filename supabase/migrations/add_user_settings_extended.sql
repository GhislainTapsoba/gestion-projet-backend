-- Migration: Ajouter les champs supplémentaires à user_settings
-- Date: 2025-01-17
-- Description: Ajoute date_format, items_per_page, font_size, compact_mode

-- Ajouter les nouveaux champs
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS items_per_page INTEGER DEFAULT 20 CHECK (items_per_page IN (10, 20, 50, 100)),
ADD COLUMN IF NOT EXISTS font_size VARCHAR(20) DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
ADD COLUMN IF NOT EXISTS compact_mode BOOLEAN DEFAULT FALSE;

-- Mettre à jour les enregistrements existants avec les valeurs par défaut
UPDATE user_settings
SET
  date_format = COALESCE(date_format, 'DD/MM/YYYY'),
  items_per_page = COALESCE(items_per_page, 20),
  font_size = COALESCE(font_size, 'medium'),
  compact_mode = COALESCE(compact_mode, FALSE)
WHERE date_format IS NULL
   OR items_per_page IS NULL
   OR font_size IS NULL
   OR compact_mode IS NULL;

-- Commentaires
COMMENT ON COLUMN user_settings.date_format IS 'Format d''affichage des dates (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)';
COMMENT ON COLUMN user_settings.items_per_page IS 'Nombre d''éléments par page dans les listes (10, 20, 50, 100)';
COMMENT ON COLUMN user_settings.font_size IS 'Taille de police de l''interface (small, medium, large)';
COMMENT ON COLUMN user_settings.compact_mode IS 'Mode compact pour réduire les espacements';
