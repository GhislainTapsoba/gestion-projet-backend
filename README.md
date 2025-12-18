# Plateforme de Gestion et Suivi de Projets - API Backend

API Backend Next.js pour la plateforme de gestion de projets avec notifications automatiques par email et tracking avancé.

## Fonctionnalités principales

### Gestion de Projets
- CRUD complet des projets
- Gestion des étapes (stages) avec dépendances
- Assignation d'équipes et responsables
- Statuts: Planning, In Progress, On Hold, Completed, Cancelled

### Gestion des Tâches
- CRUD complet avec assignation automatique
- Statuts: TODO, IN_PROGRESS, IN_REVIEW, COMPLETED, CANCELLED
- Priorités: LOW, MEDIUM, HIGH, URGENT
- Notifications automatiques aux responsables

### Système de Notifications
- Notifications en temps réel
- Types: TASK_ASSIGNED, TASK_UPDATED, TASK_COMPLETED, STAGE_COMPLETED, etc.
- Filtrage et pagination

### Emails Avancés
- Templates HTML professionnels et responsives
- Tracking d'ouverture et de clic
- Retry automatique (3 tentatives)
- Statistiques: taux d'ouverture, taux de clic

### Dashboard KPIs
- Statistiques projets/tâches/équipe en temps réel
- Taux de complétion et retards
- Tendances et croissance
- Top performers

## Technologies

- Next.js 16 (App Router)
- PostgreSQL + Prisma ORM
- NextAuth.js
- Nodemailer
- TypeScript

## Installation

### Prérequis
- Node.js 18+
- PostgreSQL 14+

### Étapes

1. Cloner et installer
```bash
git clone <repository-url>
cd api-backend
npm install
```

2. Configuration
```bash
cp .env.example .env
```

Éditer `.env` :
```env
DATABASE_URL="postgresql://user:password@localhost:5432/project_management"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="noreply@yourcompany.com"
PROJECT_MANAGER_EMAIL="pm@yourcompany.com"
GENERAL_MANAGER_EMAIL="gm@yourcompany.com"
```

3. Base de données
```bash
npx prisma generate
npx prisma db push
```

4. Lancer le serveur
```bash
npm run dev
```

L'API sera accessible sur `http://localhost:3000`.

## Structure du projet

```
api-backend/
├── app/api/
│   ├── dashboard/          # KPIs et statistiques
│   ├── email/track/        # Tracking emails
│   ├── notifications/      # Gestion notifications
│   ├── projects/           # CRUD projets
│   └── tasks/              # CRUD tâches
├── lib/
│   ├── auth.ts            # NextAuth config
│   ├── emailService.ts    # Service email avancé
│   ├── emailTemplates.ts  # Templates HTML
│   ├── prisma.ts          # Client Prisma
│   └── taskAssignment.ts  # Assignation auto
├── prisma/
│   └── schema.prisma      # Schéma DB
└── .env.example
```

## API Endpoints

### Dashboard
- `GET /api/dashboard` - KPIs et statistiques

### Projets
- `GET /api/projects` - Liste
- `POST /api/projects` - Créer
- `GET /api/projects/[id]` - Détails
- `PATCH /api/projects/[id]` - Modifier
- `DELETE /api/projects/[id]` - Supprimer

### Tâches
- `GET /api/tasks` - Liste (avec filtres)
- `POST /api/tasks` - Créer
- `GET /api/tasks/[id]` - Détails
- `PATCH /api/tasks/[id]` - Modifier
- `DELETE /api/tasks/[id]` - Supprimer

### Notifications
- `GET /api/notifications?isRead=false&limit=50` - Liste
- `POST /api/notifications` - Créer
- `PATCH /api/notifications` - Marquer lu/non lu
- `DELETE /api/notifications?ids=1,2,3` - Supprimer

### Email Tracking
- `GET /api/email/track/open/[emailLogId]` - Tracking ouverture
- `GET /api/email/track/click/[emailLogId]?redirect=<url>` - Tracking clic

## Base de données

### Migrations

```bash
# Créer une migration
npx prisma migrate dev --name init

# Appliquer
npx prisma migrate deploy

# Interface graphique
npx prisma studio
```

## Notifications

Types disponibles :
- TASK_ASSIGNED
- TASK_UPDATED
- TASK_COMPLETED
- STAGE_COMPLETED
- PROJECT_DEADLINE
- MENTION
- COMMENT

Les notifications sont créées automatiquement lors d'événements importants.

## Emails

### Templates
1. taskAssigned - Assignation tâche
2. taskUpdated - Mise à jour
3. taskCompleted - Tâche terminée
4. stageCompleted - Étape terminée
5. projectDeadline - Rappel échéance
6. newComment - Nouveau commentaire

### Fonctionnalités
- Design responsive
- Boutons d'action
- Tracking ouverture/clic
- Retry automatique
- Logs complets

### Exemple d'envoi

```typescript
import { sendEmail } from '@/lib/emailService';
import { emailTemplates } from '@/lib/emailTemplates';

const { subject, html } = emailTemplates.taskAssigned(task, project, assignee);

await sendEmail({
  to: ['user@example.com'],
  subject,
  html,
  recipientId: user.id,
  metadata: { type: 'task_assigned', taskId: task.id }
});
```

## Développement

### Scripts

```bash
npm run dev      # Développement
npm run build    # Build production
npm start        # Production
npm run lint     # Linter
```

### Bonnes pratiques

1. Toujours utiliser Prisma pour les requêtes DB
2. Valider les entrées utilisateur
3. Logger les erreurs clairement
4. Utiliser les transactions pour opérations multiples
5. Créer des ActivityLogs pour actions importantes

## Production

### Checklist

- [ ] Variables d'environnement configurées
- [ ] Base de données créée et migrée
- [ ] NEXTAUTH_SECRET sécurisé
- [ ] CORS configuré
- [ ] Rate limiting activé
- [ ] Backups automatiques
- [ ] SSL/TLS activé
- [ ] Monitoring activé

### Plateformes recommandées

- Frontend: Vercel, Netlify
- API: Vercel, Railway, Render
- Database: Supabase, Railway, Neon
- Emails: SendGrid, Mailgun, AWS SES

## Support

Pour questions ou problèmes, ouvrir une issue sur GitHub.

---

Développé pour optimiser la gestion de vos projets
