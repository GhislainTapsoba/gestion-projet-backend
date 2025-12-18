# 📚 Guide des Scripts SQL Supabase

## 📁 Fichiers disponibles

### 1️⃣ `check_schema.sql` - Vérification
**Utilisez ce script en premier pour voir l'état actuel de votre base de données**

```sql
-- Exécutez dans Supabase SQL Editor
-- Affiche: tables, colonnes, nombre d'enregistrements, indexes
```

---

### 2️⃣ `update_schema.sql` - Mise à jour sécurisée ✅ RECOMMANDÉ
**Utilisez ce script si vous avez déjà des tables existantes**

✅ Ne génère AUCUNE erreur même si les tables existent
✅ Ajoute seulement ce qui manque
✅ Conserve vos données existantes
✅ Crée: notifications, email_logs, activity_logs, indexes, triggers, vues

```sql
-- Exécutez dans Supabase SQL Editor
-- Copier tout le contenu de update_schema.sql
```

---

### 3️⃣ `schema.sql` - Installation complète
**Utilisez ce script SEULEMENT pour une nouvelle base de données vide**

⚠️ Génère des erreurs si les tables existent déjà
✅ Parfait pour une installation propre

```sql
-- NE PAS UTILISER si vous avez l'erreur "relation users already exists"
```

---

### 4️⃣ `reset_schema.sql` - Réinitialisation complète ⚠️ DANGER
**Utilisez ce script pour SUPPRIMER TOUTES vos tables et données**

❌ SUPPRIME TOUT
⚠️ PERTE DE DONNÉES IRRÉVERSIBLE
✅ Utile pour redémarrer de zéro en développement

```sql
-- 1. Exécutez reset_schema.sql (supprime tout)
-- 2. Puis exécutez schema.sql (recrée tout)
```

---

## 🚀 Quelle option choisir?

### Vous avez l'erreur "relation users already exists"?
👉 **Utilisez `update_schema.sql`**

### Vous voulez voir ce qui existe déjà?
👉 **Utilisez `check_schema.sql`**

### Vous voulez tout supprimer et recommencer?
👉 **Utilisez `reset_schema.sql` puis `schema.sql`**

### Vous avez une base de données vide?
👉 **Utilisez `schema.sql`**

---

## 📋 Procédure recommandée

### Étape 1: Vérifier l'état actuel
```sql
-- Dans Supabase SQL Editor, exécutez:
-- Fichier: check_schema.sql
```

### Étape 2: Mettre à jour
```sql
-- Dans Supabase SQL Editor, exécutez:
-- Fichier: update_schema.sql
```

### Étape 3: Vérifier à nouveau
```sql
-- Re-exécutez check_schema.sql pour confirmer
```

---

## ✅ Après l'exécution

Vous devriez avoir toutes ces tables:
- ✅ users
- ✅ projects
- ✅ tasks
- ✅ notifications
- ✅ email_logs
- ✅ activity_logs
- ✅ project_members
- ✅ stages
- ✅ comments
- ✅ accounts (NextAuth)
- ✅ sessions (NextAuth)
- ✅ verification_tokens (NextAuth)

Plus:
- ✅ Tous les indexes pour performance
- ✅ Triggers pour updated_at automatique
- ✅ Vues SQL (project_stats, unread_notifications_count)
- ✅ Row Level Security (RLS) configuré

---

## 🆘 Dépannage

### Erreur: "relation users already exists"
➜ Vous utilisez `schema.sql` au lieu de `update_schema.sql`

### Erreur: "column already exists"
➜ Normal avec `schema.sql`, utilisez `update_schema.sql` à la place

### Je veux tout recommencer
➜ Exécutez `reset_schema.sql` puis `schema.sql`

---

## 💡 Astuce

Le script `update_schema.sql` peut être exécuté plusieurs fois sans problème.
C'est idempotent = même résultat peu importe le nombre d'exécutions.
