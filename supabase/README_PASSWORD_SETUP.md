# 🔐 Configuration des Mots de Passe - Guide

## 📌 Important

Le système d'authentification utilise maintenant **bcrypt** pour sécuriser les mots de passe. Les mots de passe sont hashés avant d'être stockés dans la base de données.

---

## 🚀 Configuration Rapide

### Étape 1: Ajouter la colonne password

Si vous avez déjà exécuté `schema_supabase.sql`, la colonne `password` existe déjà.

Si ce n'est pas le cas, exécutez cette commande SQL:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);
```

### Étape 2: Ajouter les mots de passe pour les utilisateurs de test

Dans **Supabase SQL Editor**, exécutez le script `add_test_passwords.sql`:

```bash
# Le fichier est situé dans: api-backend/supabase/add_test_passwords.sql
```

Ce script va:
1. Ajouter la colonne `password` si elle n'existe pas
2. Définir le mot de passe `password123` (hashé) pour les 3 utilisateurs de test
3. Afficher une vérification que les mots de passe sont configurés

---

## 👥 Comptes de Test

Après avoir exécuté le script, vous pouvez vous connecter avec:

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@example.com | password123 | ADMIN |
| manager@example.com | password123 | PROJECT_MANAGER |
| employee@example.com | password123 | EMPLOYEE |

---

## 🔧 Générer un Nouveau Hash

Si vous voulez changer le mot de passe de test ou créer un nouveau hash:

### Méthode 1: Script Node.js (recommandé)

```bash
cd api-backend
node scripts/generate-password-hash.js
```

Ce script affichera:
- Le mot de passe en clair
- Le hash bcrypt
- Les commandes SQL pour mettre à jour les utilisateurs

### Méthode 2: Utiliser bcrypt en ligne de commande

```bash
npm install -g bcrypt-cli
bcrypt-cli hash "VotreMotDePasse" 10
```

### Méthode 3: Code JavaScript

```javascript
const bcrypt = require('bcryptjs');

bcrypt.hash('VotreMotDePasse', 10, (err, hash) => {
  console.log('Hash:', hash);
});
```

Puis utilisez le hash dans SQL:

```sql
UPDATE users
SET password = 'VOTRE_HASH_ICI'
WHERE email = 'email@example.com';
```

---

## 🔐 Sécurité

### Bonnes Pratiques

✅ **Fait automatiquement:**
- Mots de passe hashés avec bcrypt (salt rounds = 10)
- Mot de passe jamais retourné dans les réponses API
- Validation de la longueur minimum (6 caractères)
- Vérification de l'unicité de l'email

⚠️ **À faire en production:**
- Augmenter la longueur minimum à 8+ caractères
- Ajouter des exigences de complexité (majuscules, chiffres, symboles)
- Implémenter une limitation du nombre de tentatives de connexion
- Ajouter une authentification à deux facteurs (2FA)
- Utiliser HTTPS en production

### Fonctionnement de bcrypt

Bcrypt est un algorithme de hashing conçu spécifiquement pour les mots de passe:

1. **Salt automatique:** Chaque hash est unique même avec le même mot de passe
2. **Lent par design:** Rend les attaques brute-force très difficiles
3. **Salt rounds = 10:** Bon équilibre entre sécurité et performance

---

## 📝 API d'Authentification

### POST /api/auth/login

Connexion avec email et mot de passe.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "id": "uuid...",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "ADMIN",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
    // ⚠️ password n'est PAS inclus
  }
}
```

**Response (Error):**
```json
{
  "error": "Email ou mot de passe incorrect"
}
```

### POST /api/auth/register

Création de nouveau compte.

**Request:**
```json
{
  "email": "nouveau@example.com",
  "password": "motdepasse123",
  "name": "Nouveau User",
  "role": "EMPLOYEE"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "id": "uuid...",
    "email": "nouveau@example.com",
    "name": "Nouveau User",
    "role": "EMPLOYEE",
    // ...
  }
}
```

**Response (Error):**
```json
{
  "error": "Cet email est déjà utilisé"
}
```

ou

```json
{
  "error": "Le mot de passe doit contenir au moins 6 caractères"
}
```

---

## 🧪 Tester l'Authentification

### Test avec curl

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User","role":"EMPLOYEE"}'
```

### Test avec l'Interface

1. Lancez le frontend: `npm run dev` dans `web-frontend`
2. Ouvrez http://localhost:3001
3. Utilisez les identifiants de test
4. Vérifiez que vous êtes redirigé vers le dashboard

---

## 🐛 Dépannage

### "Mot de passe non configuré pour cet utilisateur"

➜ L'utilisateur existe mais n'a pas de mot de passe
➜ Exécutez `add_test_passwords.sql` dans Supabase

### "Email ou mot de passe incorrect" (mais l'email est correct)

➜ Vérifiez que le mot de passe hashé est dans la base:

```sql
SELECT email,
       CASE
         WHEN password IS NULL THEN 'Pas de mot de passe'
         ELSE 'Mot de passe configuré'
       END as status
FROM users
WHERE email = 'admin@example.com';
```

➜ Si NULL, exécutez `add_test_passwords.sql`

### "Module not found: bcryptjs"

➜ Installez bcryptjs:

```bash
cd api-backend
npm install bcryptjs
```

### Les nouveaux utilisateurs ne peuvent pas se connecter

➜ Vérifiez que le backend est bien lancé (port 3000)
➜ Vérifiez que l'API d'inscription retourne un succès
➜ Vérifiez dans Supabase que l'utilisateur a été créé avec un password

---

## 📊 Schéma de la Table Users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password VARCHAR(255),  -- ← Hash bcrypt du mot de passe
  role VARCHAR(50) DEFAULT 'EMPLOYEE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ✅ Checklist

Après avoir configuré l'authentification:

- [ ] Script `add_test_passwords.sql` exécuté dans Supabase
- [ ] Colonne `password` existe dans la table `users`
- [ ] Les 3 utilisateurs de test ont un mot de passe
- [ ] Backend lancé (port 3000)
- [ ] Frontend lancé (port 3001)
- [ ] Test de connexion avec admin@example.com / password123
- [ ] Test de création de compte avec un nouvel email
- [ ] Vérification que le mot de passe n'apparaît jamais dans les réponses API

---

**Version:** 1.0.0
**Dernière mise à jour:** Décembre 2024
**Statut:** ✅ Production Ready (avec recommandations de sécurité additionnelles pour production)
