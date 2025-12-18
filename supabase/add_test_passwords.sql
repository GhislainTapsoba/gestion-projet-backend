-- Script pour ajouter des mots de passe aux utilisateurs de test
-- Mot de passe pour tous les comptes de test: "password123"
-- Hash bcrypt généré avec salt rounds = 10

-- Ajouter la colonne password si elle n'existe pas
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Mettre à jour les utilisateurs de test avec des mots de passe hashés
-- Hash bcrypt pour "password123"

-- Admin
UPDATE users
SET password = '$2a$10$/OvNsoxV8e9.dGNKUntT5ehyurTBx0Pd1tWlEqGmwAfMc71relzMW'
WHERE email = 'admin@example.com';

-- Manager
UPDATE users
SET password = '$2a$10$/OvNsoxV8e9.dGNKUntT5ehyurTBx0Pd1tWlEqGmwAfMc71relzMW'
WHERE email = 'manager@example.com';

-- Employee
UPDATE users
SET password = '$2a$10$/OvNsoxV8e9.dGNKUntT5ehyurTBx0Pd1tWlEqGmwAfMc71relzMW'
WHERE email = 'employee@example.com';

-- Vérifier que les mots de passe ont été ajoutés
SELECT email,
       CASE
         WHEN password IS NOT NULL THEN '✓ Mot de passe configuré'
         ELSE '✗ Pas de mot de passe'
       END as status
FROM users
WHERE email IN ('admin@example.com', 'manager@example.com', 'employee@example.com');
