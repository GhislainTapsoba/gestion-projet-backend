-- =============================================
-- SCRIPT DE RÉINITIALISATION COMPLÈTE
-- ⚠️ ATTENTION: Ce script supprime TOUTES les données!
-- Utilisez seulement si vous voulez repartir de zéro
-- =============================================

-- Supprimer les vues (si elles existent)
DROP VIEW IF EXISTS project_stats CASCADE;
DROP VIEW IF EXISTS unread_notifications_count CASCADE;

-- Supprimer les fonctions (si elles existent)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Supprimer les tables dans le bon ordre (à cause des foreign keys)
-- Utiliser CASCADE pour supprimer aussi les dépendances
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS stages CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Base de données réinitialisée avec succès!';
  RAISE NOTICE '👉 Vous pouvez maintenant exécuter schema.sql';
END $$;
