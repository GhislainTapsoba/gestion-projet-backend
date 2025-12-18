# Guide Supabase - Configuration Complete

## 🎯 Vue d'ensemble

Ce projet utilise **Supabase** comme base de données PostgreSQL avec des fonctionnalités avancées (authentification, storage, real-time, etc.)

## 📋 Étape 1: Créer un projet Supabase

### 1.1 Inscription

1. Aller sur https://supabase.com
2. Créer un compte (ou se connecter)
3. Cliquer sur "New Project"

### 1.2 Configuration du projet

- **Name**: Project Management Platform
- **Database Password**: (noter ce mot de passe - important!)
- **Region**: Choisir la région la plus proche de vos utilisateurs
- **Pricing Plan**: Free (suffisant pour démarrer)

Attendre 2-3 minutes que le projet soit créé.

## 📋 Étape 2: Obtenir les clés API

### 2.1 Accéder aux clés

1. Dans le dashboard Supabase
2. Cliquer sur "Settings" (⚙️) dans la sidebar
3. Aller dans "API"

### 2.2 Copier les clés

Vous aurez besoin de 3 clés :

1. **Project URL** - `https://xxxxx.supabase.co`
2. **anon/public key** - clé publique
3. **service_role key** - clé privée (⚠️ à ne JAMAIS exposer côté client)

## 📋 Étape 3: Configurer les variables d'environnement

### 3.1 Créer le fichier .env

```bash
cp .env.example .env
```

### 3.2 Remplir les variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generer-avec-openssl-rand-base64-32"

# Email
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="votre-email@gmail.com"
EMAIL_SERVER_PASSWORD="votre-mot-de-passe-application"
EMAIL_FROM="noreply@votreentreprise.com"
PROJECT_MANAGER_EMAIL="pm@votreentreprise.com"
GENERAL_MANAGER_EMAIL="gm@votreentreprise.com"
```

## 📋 Étape 4: Créer les tables

### 4.1 Via SQL Editor

1. Dans le dashboard Supabase
2. Cliquer sur "SQL Editor" dans la sidebar
3. Cliquer sur "New Query"
4. Copier-coller le contenu de `supabase/schema.sql`
5. Cliquer sur "Run" ou `Ctrl+Enter`

### 4.2 Vérification

1. Aller dans "Table Editor"
2. Vous devriez voir toutes les tables :
   - users
   - projects
   - project_members
   - stages
   - tasks
   - comments
   - notifications
   - email_logs
   - activity_logs
   - accounts
   - sessions
   - verification_tokens

## 📋 Étape 5: Configurer Row Level Security (RLS)

### 5.1 Comprendre RLS

RLS (Row Level Security) permet de sécuriser l'accès aux données au niveau des lignes.

### 5.2 Policies de base

Les policies sont déjà créées dans `schema.sql`, mais vous pouvez les ajuster :

```sql
-- Exemple: Permettre aux users de voir leurs notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid()::bigint = user_id);
```

### 5.3 Désactiver RLS temporairement (dev)

Pour le développement, vous pouvez désactiver RLS :

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- etc.
```

⚠️ **En production**, toujours réactiver RLS pour la sécurité !

## 📋 Étape 6: Installer les dépendances

```bash
npm install
```

Les packages Supabase sont déjà dans `package.json` :
- `@supabase/supabase-js` - Client Supabase
- `@supabase/ssr` - Helpers pour Next.js

## 📋 Étape 7: Créer le premier utilisateur

### 7.1 Via SQL Editor

```sql
INSERT INTO users (email, name, password, role)
VALUES (
  'admin@example.com',
  'Administrateur',
  '$2a$10$...', -- Hasher le mot de passe avec bcrypt
  'ADMIN'
);
```

### 7.2 Hasher un mot de passe

```bash
node -e "console.log(require('bcryptjs').hashSync('votre-mot-de-passe', 10))"
```

Copier le hash et l'insérer dans la requête SQL ci-dessus.

### 7.3 Via Table Editor

1. Aller dans "Table Editor"
2. Sélectionner la table `users`
3. Cliquer sur "Insert row"
4. Remplir les champs
5. Sauvegarder

## 📋 Étape 8: Tester la connexion

### 8.1 Lancer le serveur

```bash
npm run dev
```

### 8.2 Tester avec curl

```bash
# Dashboard
curl http://localhost:3000/api/dashboard

# Devrait retourner du JSON (même vide au début)
```

## 🔧 Fonctionnalités Supabase Utilisées

### 1. PostgreSQL Database
- Tables relationnelles
- Indexes pour performance
- Triggers pour `updated_at`

### 2. Realtime (optionnel)
Pour recevoir les mises à jour en temps réel :

```typescript
const subscription = supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications'
  }, (payload) => {
    console.log('New notification!', payload.new);
  })
  .subscribe();
```

### 3. Storage (à configurer si besoin)
Pour stocker des fichiers :

1. Aller dans "Storage" dans le dashboard
2. Créer un bucket (ex: "project-files")
3. Configurer les policies d'accès

### 4. Auth (optionnel - on utilise NextAuth)
Supabase fournit aussi son propre système d'auth, mais nous utilisons NextAuth pour plus de flexibilité.

## 📊 Supabase Dashboard - Outils utiles

### 1. Table Editor
- Visualiser et éditer les données
- Ajouter/supprimer des lignes
- Exporter en CSV

### 2. SQL Editor
- Écrire des requêtes SQL
- Créer des fonctions
- Gérer les triggers

### 3. Database
- Voir le schéma
- Gérer les migrations
- Backups automatiques

### 4. API Docs
- Documentation auto-générée
- Exemples de code
- Postman collection

## 🔍 Requêtes Supabase - Exemples

### SELECT simple

```typescript
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('status', 'TODO');
```

### SELECT avec relations (JOIN)

```typescript
const { data, error } = await supabase
  .from('tasks')
  .select(`
    *,
    assignedTo:users!assigned_to_id(id, name, email),
    project:projects(id, title)
  `)
  .eq('status', 'TODO');
```

### INSERT

```typescript
const { data, error } = await supabase
  .from('tasks')
  .insert({
    title: 'Nouvelle tâche',
    description: 'Description',
    priority: 'HIGH',
    project_id: 1
  })
  .select()
  .single();
```

### UPDATE

```typescript
const { data, error } = await supabase
  .from('tasks')
  .update({ status: 'COMPLETED' })
  .eq('id', 123)
  .select()
  .single();
```

### DELETE

```typescript
const { error } = await supabase
  .from('tasks')
  .delete()
  .eq('id', 123);
```

### COUNT

```typescript
const { count, error } = await supabase
  .from('tasks')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'TODO');
```

## 🚀 Performance & Optimisation

### 1. Indexes

Déjà créés dans `schema.sql` pour les colonnes fréquemment requêtées :

```sql
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_project ON tasks(project_id);
```

### 2. Pagination

```typescript
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .range(0, 9); // 10 premiers résultats (0-9)
```

### 3. Filters

```typescript
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('status', 'TODO')
  .gte('priority', 'HIGH')
  .order('created_at', { ascending: false });
```

## 🔐 Sécurité

### 1. Service Role Key

⚠️ **JAMAIS** exposer la service_role_key côté client !

- Utiliser uniquement côté serveur (API routes)
- Permet de contourner RLS
- Accès total à la base de données

### 2. Anon Key

✅ Peut être exposée côté client

- Respecte les policies RLS
- Accès limité selon les rules

### 3. RLS Policies

Toujours définir des policies strictes :

```sql
-- Exemple: Users ne peuvent modifier que leurs propres notifications
CREATE POLICY "Users update own notifications"
ON notifications FOR UPDATE
USING (auth.uid()::bigint = user_id);
```

## 📈 Monitoring & Logs

### 1. Logs API

Dans le dashboard :
- "Logs" → "API Logs"
- Voir toutes les requêtes
- Temps de réponse
- Erreurs

### 2. Database Usage

- "Settings" → "Usage"
- Storage utilisé
- Bandwidth
- Nombre de requêtes

### 3. Query Performance

Dans "SQL Editor", activer "Explain" pour analyser les performances :

```sql
EXPLAIN ANALYZE
SELECT * FROM tasks WHERE status = 'TODO';
```

## 🆘 Troubleshooting

### Problème 1: Connection refused

**Solution**:
- Vérifier NEXT_PUBLIC_SUPABASE_URL
- Vérifier que le projet Supabase est actif
- Tester la connexion dans le dashboard

### Problème 2: RLS policies bloquent les requêtes

**Solution temporaire** (dev seulement):
```sql
ALTER TABLE nom_table DISABLE ROW LEVEL SECURITY;
```

**Solution permanente**:
Créer les bonnes policies d'accès.

### Problème 3: Type errors TypeScript

**Solution**:
Générer les types TypeScript :

```bash
npx supabase gen types typescript --project-id <project-id> > lib/database.types.ts
```

## 🔄 Migrations

### Créer une migration

1. Modifier le schéma dans `schema.sql`
2. Exécuter dans SQL Editor
3. Ou utiliser Supabase CLI :

```bash
# Installer Supabase CLI
npm install -g supabase

# Login
supabase login

# Link projet
supabase link --project-ref <project-id>

# Créer migration
supabase db diff -f nom_migration

# Appliquer
supabase db push
```

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

Votre projet est maintenant configuré avec Supabase ! 🎉