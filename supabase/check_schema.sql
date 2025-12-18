-- =============================================
-- SCRIPT DE VÉRIFICATION DU SCHÉMA
-- Exécutez ce script pour voir l'état de votre base de données
-- =============================================

-- Lister toutes les tables
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Vérifier les colonnes de la table users
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Vérifier les colonnes de la table projects
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;

-- Vérifier les colonnes de la table tasks
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

-- Compter les enregistrements dans chaque table
SELECT
  'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')
UNION ALL
SELECT 'email_logs', COUNT(*) FROM email_logs WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs')
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs');

-- Lister tous les indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
