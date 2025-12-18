# Workflow de Complétion des Étapes et Notification Automatique

## 📋 Vue d'ensemble

Ce système gère automatiquement la complétion des étapes (stages) d'un projet et envoie des notifications au chef de projet lorsque toutes les étapes sont terminées.

## 🔄 Workflow

### 1. **Employé termine les tâches d'une étape**
- L'employé marque toutes les tâches d'une étape comme `COMPLETED`
- Chaque tâche a un `stage_id` qui la lie à une étape spécifique

### 2. **Validation de l'étape**
- Une fois toutes les tâches terminées, l'employé peut marquer l'étape comme terminée
- Route API: `POST /api/stages/[id]/complete`

### 3. **Vérifications automatiques**
Le système vérifie automatiquement:
- ✅ Toutes les tâches de l'étape sont bien terminées
- ✅ Si des tâches sont incomplètes, l'étape ne peut pas être marquée comme terminée
- ✅ L'étape est marquée avec le statut `COMPLETED`

### 4. **Activation de l'étape suivante**
- Si une étape suivante existe (ordre + 1), elle est automatiquement activée avec le statut `IN_PROGRESS`

### 5. **Vérification du projet**
Quand une étape est complétée, le système vérifie:
- Si **toutes les étapes** du projet sont terminées
- Si oui → Notification au chef de projet

### 6. **Notification au chef de projet**
Lorsque toutes les étapes sont terminées:
- 📧 Email envoyé au `manager_id` du projet (ou `created_by_id` si pas de manager)
- 🔔 Notification in-app créée
- 📊 Le chef reçoit un résumé avec:
  - Nom du projet
  - Nombre d'étapes complétées
  - Nom de l'employé qui a terminé la dernière étape
  - Actions suggérées (vérification, réunion de clôture, etc.)

## 🚀 Utilisation

### Appel API pour compléter une étape

```bash
POST /api/stages/[id]/complete
Authorization: Bearer <token>
```

**Réponse en cas de succès:**
```json
{
  "success": true,
  "stage": {
    "id": 1,
    "name": "Développement",
    "status": "COMPLETED",
    ...
  },
  "all_stages_completed": true,
  "next_stage": null,
  "notification_sent": true,
  "project_manager": {
    "id": "123",
    "name": "Chef de Projet",
    "email": "chef@example.com"
  }
}
```

**Erreur si des tâches sont incomplètes:**
```json
{
  "error": "Toutes les tâches de cette étape doivent être terminées avant de valider l'étape",
  "incomplete_tasks": 3
}
```

## 📁 Structure de la base de données

### Table `stages`
```sql
CREATE TABLE stages (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  duration INTEGER,
  status VARCHAR(50) DEFAULT 'PENDING',
  project_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Statuts possibles:**
- `PENDING`: Étape en attente
- `IN_PROGRESS`: Étape en cours
- `COMPLETED`: Étape terminée
- `BLOCKED`: Étape bloquée

### Table `projects`
```sql
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'PLANNING',
  created_by_id BIGINT NOT NULL,
  manager_id BIGINT, -- Chef de projet
  ...
);
```

### Table `tasks`
```sql
CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'TODO',
  project_id BIGINT NOT NULL,
  stage_id BIGINT, -- Lien vers l'étape
  ...
);
```

## 🔧 Migration

Pour ajouter le champ `manager_id` à la table `projects`:

```bash
# Exécuter la migration
psql -U username -d database_name -f supabase/migrations/add_manager_id_to_projects.sql
```

Ou dans Supabase Dashboard:
1. Aller dans **SQL Editor**
2. Copier le contenu de `supabase/migrations/add_manager_id_to_projects.sql`
3. Exécuter la requête

## 📧 Template d'email

Le template `allStagesCompletedTemplate` est utilisé pour envoyer l'email au chef de projet.

**Contenu de l'email:**
- 🎉 Message de félicitations
- 📊 Résumé du projet
- 👤 Nom de l'employé qui a terminé
- 📝 Suggestions d'actions à suivre
- 🔗 Lien vers le projet

## 🎯 Exemples d'utilisation

### Scénario 1: Projet avec 3 étapes

1. **Étape 1: Conception** (order: 0)
   - 5 tâches assignées
   - Employé termine les 5 tâches
   - Employé appelle `POST /api/stages/1/complete`
   - ✅ Étape 1 marquée COMPLETED
   - ✅ Étape 2 activée (IN_PROGRESS)

2. **Étape 2: Développement** (order: 1)
   - 10 tâches assignées
   - Employé termine les 10 tâches
   - Employé appelle `POST /api/stages/2/complete`
   - ✅ Étape 2 marquée COMPLETED
   - ✅ Étape 3 activée (IN_PROGRESS)

3. **Étape 3: Tests** (order: 2)
   - 3 tâches assignées
   - Employé termine les 3 tâches
   - Employé appelle `POST /api/stages/3/complete`
   - ✅ Étape 3 marquée COMPLETED
   - ✅ Toutes les étapes sont terminées!
   - 📧 Email envoyé au chef de projet
   - 🔔 Notification créée

### Scénario 2: Tentative de complétion avec tâches incomplètes

```bash
POST /api/stages/2/complete
```

**Réponse:**
```json
{
  "error": "Toutes les tâches de cette étape doivent être terminées avant de valider l'étape",
  "incomplete_tasks": 2
}
```

L'employé doit d'abord terminer toutes les tâches de l'étape.

## 🔐 Sécurité

- ✅ Authentification requise (JWT Bearer token)
- ✅ Vérification que toutes les tâches sont terminées
- ✅ Logs d'activité enregistrés
- ✅ Notifications sécurisées

## 📊 Logs et Activités

Chaque complétion d'étape est enregistrée dans `activity_logs`:

```json
{
  "user_id": "123",
  "action": "complete",
  "entity_type": "stage",
  "entity_id": "1",
  "details": "Étape terminée: Développement",
  "metadata": {
    "stage_name": "Développement",
    "project_id": "456"
  }
}
```

## 🎓 Bonnes pratiques

1. **Ordre des étapes**: Assurez-vous que les étapes ont un ordre logique (0, 1, 2, ...)
2. **Tâches assignées**: Toutes les tâches doivent être assignées à une étape via `stage_id`
3. **Chef de projet**: Définir un `manager_id` pour chaque projet pour recevoir les notifications
4. **Vérification**: Le chef de projet doit vérifier la qualité avant de clore le projet

## 🐛 Dépannage

### L'email n'est pas envoyé
- Vérifier que `manager_id` est défini dans le projet
- Vérifier que l'utilisateur a un email valide
- Vérifier les logs d'erreur email dans `email_logs`

### L'étape ne se marque pas comme terminée
- Vérifier que toutes les tâches de l'étape ont `status = 'COMPLETED'`
- Vérifier que le `stage_id` des tâches correspond bien à l'étape

### L'étape suivante ne s'active pas
- Vérifier que l'étape suivante a un `order = current_order + 1`
- Vérifier que l'étape suivante a le statut `PENDING`

## 📝 TODO / Améliorations futures

- [ ] Ajouter une option pour ignorer la vérification des tâches (force complete)
- [ ] Ajouter un système de rollback si une étape est complétée par erreur
- [ ] Envoyer des notifications aux membres de l'équipe également
- [ ] Générer un rapport PDF automatique à la fin du projet
- [ ] Statistiques et analytics sur le temps de complétion des étapes
