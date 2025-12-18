# Guide Complet : Relations et Système d'Emails

## 📊 Structure des Relations

### Vue d'ensemble

```
PROJET (projects)
   │
   ├─→ ÉTAPES (stages) ← project_id
   │     │
   │     └─→ TÂCHES (tasks) ← stage_id
   │
   └─→ TÂCHES (tasks) ← project_id (relation directe aussi)
```

### Détails des Relations

#### 1. **PROJET → ÉTAPES** (One-to-Many)
- **Table** : `stages`
- **Clé étrangère** : `project_id` (ligne 55 de schema.sql)
- **Cascade** : `ON DELETE CASCADE` (si projet supprimé, étapes supprimées)
- **Usage** : Chaque projet peut avoir plusieurs étapes séquentielles

```sql
-- Exemple
SELECT * FROM stages WHERE project_id = 1 ORDER BY "order";
```

#### 2. **ÉTAPE → TÂCHES** (One-to-Many)
- **Table** : `tasks`
- **Clé étrangère** : `stage_id` (ligne 71 de schema.sql)
- **Cascade** : `ON DELETE SET NULL` (si étape supprimée, tâche reste mais stage_id = NULL)
- **Usage** : Chaque étape peut contenir plusieurs tâches

```sql
-- Exemple
SELECT * FROM tasks WHERE stage_id = 5;
```

#### 3. **PROJET → TÂCHES** (One-to-Many direct)
- **Table** : `tasks`
- **Clé étrangère** : `project_id` (ligne 70 de schema.sql)
- **Cascade** : `ON DELETE CASCADE` (si projet supprimé, toutes les tâches supprimées)
- **Usage** : Relation directe pour les tâches sans étape spécifique

```sql
-- Toutes les tâches d'un projet
SELECT * FROM tasks WHERE project_id = 1;

-- Tâches d'une étape spécifique
SELECT * FROM tasks WHERE project_id = 1 AND stage_id = 3;

-- Tâches sans étape
SELECT * FROM tasks WHERE project_id = 1 AND stage_id IS NULL;
```

### Workflow Typique

```
1. CRÉER UN PROJET
   ↓
2. CRÉER DES ÉTAPES (optionnel)
   - Étape 1: Conception (order=1, duration=5 jours)
   - Étape 2: Développement (order=2, duration=15 jours)
   - Étape 3: Tests (order=3, duration=7 jours)
   ↓
3. CRÉER DES TÂCHES
   - Tâche A → project_id=1, stage_id=1 (Étape Conception)
   - Tâche B → project_id=1, stage_id=2 (Étape Développement)
   - Tâche C → project_id=1, stage_id=NULL (Tâche générale)
```

---

## 📧 Système d'Envoi d'Emails

### Architecture

Le système utilise **Nodemailer** avec SMTP et un système de logging complet.

```
┌─────────────────┐
│  Application    │
│  (API Routes)   │
└────────┬────────┘
         │ sendEmail()
         ↓
┌─────────────────┐
│  emailService   │
│  (lib/emailService.ts)
└────────┬────────┘
         │
         ├─→ 1. Créer log PENDING
         │
         ├─→ 2. Envoyer via SMTP
         │       (Nodemailer)
         │
         └─→ 3. Mettre à jour log
                (SENT ou FAILED)
```

### Configuration (Fichier .env)

```env
# Configuration Email SMTP
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=votre-email@gmail.com
EMAIL_SERVER_PASSWORD=votre-mot-de-passe-app
EMAIL_FROM=noreply@yourapp.com
```

**Important** : Pour Gmail, utilisez un "App Password" (pas votre mot de passe normal)
- Aller dans Compte Google → Sécurité → Validation en deux étapes → Mots de passe des applications

### Fonctions Principales

#### 1. `sendEmail(options)` - Ligne 23 de emailService.ts

Envoie un email à un seul destinataire.

```typescript
import { sendEmail } from '@/lib/emailService';

await sendEmail({
  to: 'user@example.com',
  subject: 'Nouvelle tâche assignée',
  html: '<h1>Vous avez une nouvelle tâche !</h1>',
  userId: 123, // Optionnel
  metadata: { task_id: 456 } // Optionnel
});
```

**Processus** :
1. Crée un enregistrement dans `email_logs` avec status='PENDING'
2. Envoie l'email via SMTP (Nodemailer)
3. Met à jour le status à 'SENT' ou 'FAILED'
4. Retourne `true` (succès) ou `false` (échec)

#### 2. `sendEmailToResponsibles(projectId, subject, html)` - Ligne 79

Envoie un email aux responsables d'un projet (Chef de projet + Admin).

```typescript
import { sendEmailToResponsibles } from '@/lib/emailService';

await sendEmailToResponsibles(
  projectId: 1,
  subject: 'Étape complétée',
  html: '<h1>L\'étape "Conception" est terminée</h1>',
  metadata: { stage_id: 5 }
);
```

**Processus** :
1. Récupère le créateur du projet (souvent le chef de projet)
2. Récupère le premier admin
3. Évite les doublons
4. Envoie un email à chaque destinataire

### Tracking des Emails (Table `email_logs`)

Chaque email envoyé est tracé dans la base de données :

| Colonne | Description |
|---------|-------------|
| `recipient` | Email du destinataire |
| `subject` | Sujet de l'email |
| `body` | Contenu HTML |
| `status` | PENDING, SENT, DELIVERED, OPENED, CLICKED, FAILED, BOUNCED |
| `sent_at` | Date d'envoi |
| `error_message` | Message d'erreur si échec |
| `retry_count` | Nombre de tentatives |
| `metadata` | Données JSON (task_id, project_id, etc.) |

### Templates d'Emails (emailTemplates.ts)

Les templates HTML sont définis dans `lib/emailTemplates.ts` :

```typescript
export function taskAssignedTemplate(data: {
  userName: string;
  taskTitle: string;
  projectTitle: string;
  dueDate?: string;
  taskUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          /* Styles CSS inline pour compatibilité email */
        </style>
      </head>
      <body>
        <h1>Nouvelle tâche assignée</h1>
        <p>Bonjour ${data.userName},</p>
        <p>Une nouvelle tâche vous a été assignée...</p>
      </body>
    </html>
  `;
}
```

### Exemples d'Utilisation

#### Exemple 1 : Notification de tâche assignée

```typescript
import { sendEmail } from '@/lib/emailService';
import { taskAssignedTemplate } from '@/lib/emailTemplates';

// Dans app/api/tasks/route.ts
const html = taskAssignedTemplate({
  userName: assignedUser.name,
  taskTitle: task.title,
  projectTitle: project.title,
  dueDate: task.due_date,
  taskUrl: `https://yourapp.com/dashboard/tasks/${task.id}`
});

await sendEmail({
  to: assignedUser.email,
  subject: `Nouvelle tâche: ${task.title}`,
  html,
  userId: assignedUser.id,
  metadata: { task_id: task.id, project_id: project.id }
});
```

#### Exemple 2 : Notification d'étape complétée

```typescript
import { sendEmailToResponsibles } from '@/lib/emailService';
import { stageCompletedTemplate } from '@/lib/emailTemplates';

// Dans app/api/stages/[id]/complete/route.ts
const html = stageCompletedTemplate({
  stageName: stage.name,
  projectTitle: project.title,
  completedDate: new Date().toLocaleDateString(),
  nextStageName: nextStage?.name
});

await sendEmailToResponsibles(
  project.id,
  `Étape "${stage.name}" complétée`,
  html,
  { stage_id: stage.id }
);
```

### Gestion des Erreurs

Le système gère automatiquement les erreurs :

1. **SMTP indisponible** : Status = FAILED, error_message enregistré
2. **Email invalide** : Erreur catchée, log créé
3. **Rate limiting** : Utiliser `retry_count` pour limiter les tentatives

### Monitoring

Requêtes utiles pour surveiller les emails :

```sql
-- Emails en échec
SELECT * FROM email_logs
WHERE status = 'FAILED'
ORDER BY created_at DESC;

-- Taux de succès des dernières 24h
SELECT
  status,
  COUNT(*) as count
FROM email_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Emails d'un utilisateur
SELECT * FROM email_logs
WHERE recipient_id = 123
ORDER BY created_at DESC;
```

---

## 🔄 Intégration Complète : Étapes → Emails

### Scénario : Compléter une étape

Fichier: `app/api/stages/[id]/complete/route.ts`

```typescript
import { sendEmailToResponsibles } from '@/lib/emailService';
import { stageCompletedTemplate } from '@/lib/emailTemplates';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // 1. Marquer l'étape comme complétée
  const { data: stage } = await supabaseAdmin
    .from('stages')
    .update({ status: 'COMPLETED' })
    .eq('id', params.id)
    .select()
    .single();

  // 2. Récupérer le projet
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', stage.project_id)
    .single();

  // 3. Envoyer notification email
  const html = stageCompletedTemplate({
    stageName: stage.name,
    projectTitle: project.title,
    completedDate: new Date().toLocaleDateString()
  });

  await sendEmailToResponsibles(
    project.id,
    `Étape "${stage.name}" complétée - ${project.title}`,
    html,
    { stage_id: stage.id }
  );

  // 4. Créer tâches de la prochaine étape (si configuré)
  // ...

  return corsResponse({ success: true, stage }, request);
}
```

---

## 📝 Résumé

### Relations
- ✅ **Projet → Étapes** : `stages.project_id`
- ✅ **Étapes → Tâches** : `tasks.stage_id`
- ✅ **Projet → Tâches** : `tasks.project_id` (relation directe)

### Emails
- ✅ Service SMTP avec Nodemailer
- ✅ Logging complet dans `email_logs`
- ✅ Templates HTML réutilisables
- ✅ Notification automatique aux responsables
- ✅ Gestion d'erreurs et retry

### APIs Disponibles
- `GET /api/stages?project_id=1` - Étapes d'un projet
- `GET /api/tasks?project_id=1&stage_id=3` - Tâches d'une étape
- `POST /api/stages/[id]/complete` - Compléter une étape (envoie email)
