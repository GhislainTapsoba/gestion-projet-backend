# Système de Workflow par Email - Documentation

## Vue d'ensemble

Ce système implémente un workflow complet de gestion de projets avec notifications et confirmations par email.

## 🎯 Fonctionnalités implémentées

### 1. Création de projet
- ✅ Email automatique envoyé au créateur du projet
- ✅ Contient les détails du projet (nom, description, dates)
- ✅ Lien direct vers le projet

### 2. Assignation de tâche
- ✅ Email envoyé à l'employé avec un lien de confirmation
- ✅ Répondre à l'email ou cliquer sur le bouton → Statut passe à "EN COURS"
- ✅ Token de confirmation sécurisé (expire après 7 jours)

### 3. Changement de statut de tâche par le chef
- ⏳ Email envoyé à l'employé avec demande de confirmation
- ⏳ L'employé doit confirmer la réception
- ⏳ Une fois confirmé, le chef peut continuer ses modifications

### 4. Changement de statut d'étape
- ⏳ L'employé change le statut d'une étape
- ⏳ Email automatique envoyé au chef de projet
- ⏳ Notification de qui a fait le changement

### 5. Tâche terminée
- ⏳ L'employé marque la tâche comme terminée
- ⏳ Email envoyé au chef de projet pour validation

## 📁 Fichiers créés/modifiés

### Nouveaux fichiers

1. **`supabase/migrations/003_add_email_confirmations.sql`**
   - Table `email_confirmations` pour stocker les tokens
   - Fonction de nettoyage des tokens expirés

2. **`lib/emailConfirmation.ts`**
   - Gestion des tokens de confirmation
   - Vérification et confirmation des tokens
   - Exécution des actions liées aux confirmations

3. **`app/api/confirm-email/route.ts`**
   - Endpoint pour confirmer les emails
   - Redirige l'utilisateur après confirmation

### Fichiers modifiés

1. **`lib/emailTemplates.ts`**
   - ✅ `taskAssignedTemplate` - Avec token de confirmation
   - ✅ `taskStatusChangeByManagerTemplate` - Nouveau
   - ✅ `stageStatusChangeByEmployeeTemplate` - Nouveau
   - ✅ `projectCreatedNotificationTemplate` - Nouveau
   - ✅ `taskCompletedByEmployeeTemplate` - Nouveau

2. **`app/api/projects/route.ts`**
   - ✅ Envoi d'email au créateur lors de la création

3. **`app/api/tasks/route.ts`**
   - ✅ Création de token de confirmation
   - ✅ Envoi d'email avec confirmation à l'assigné

## 🔄 Workflow détaillé

### Assignation de tâche

```
Chef de projet → Crée tâche et assigne employé
                 ↓
        Email envoyé à l'employé
                 ↓
  Employé clique sur "Confirmer et démarrer"
                 ↓
      Token vérifié par /api/confirm-email
                 ↓
  Statut automatiquement passé à "EN COURS"
```

### Changement de statut par chef

```
Chef de projet → Change statut de tâche
                 ↓
    Email envoyé à l'employé (avec token)
                 ↓
  Employé confirme la réception
                 ↓
  Chef peut continuer les modifications
```

### Changement d'étape par employé

```
Employé → Change statut d'étape
          ↓
Email envoyé au chef de projet
          ↓
Chef vérifie l'avancement
```

## 🔐 Sécurité

- Tokens générés avec `crypto.randomBytes(32)`
- Tokens expirés automatiquement après 7 jours
- Un token ne peut être utilisé qu'une seule fois
- Vérification de l'expiration et de l'utilisation

## ⚙️ Configuration requise

### Variables d'environnement

```env
# Email
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=votre.email@gmail.com
EMAIL_SERVER_PASSWORD=votre_mot_de_passe_app
EMAIL_FROM=noreply@votreapp.com

# Frontend URL
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001
```

## 📝 Prochaines étapes (TODO)

### À implémenter

1. **Changement de statut de tâche par chef**
   - Modifier `/api/tasks/[id]/route.ts` (PATCH)
   - Créer token de confirmation
   - Envoyer email avec `taskStatusChangeByManagerTemplate`
   - Bloquer les modifications suivantes tant que non confirmé

2. **Notification changement d'étape**
   - Modifier `/api/stages/[id]/route.ts` (PATCH)
   - Récupérer le chef de projet
   - Envoyer email avec `stageStatusChangeByEmployeeTemplate`

3. **Tâche terminée par employé**
   - Modifier `/api/tasks/[id]/route.ts` (PATCH)
   - Détecter passage à statut "COMPLETED"
   - Envoyer email avec `taskCompletedByEmployeeTemplate`

### Améliorations futures

- [ ] Webhook pour répondre directement aux emails
- [ ] Système de rappels automatiques
- [ ] Historique des confirmations
- [ ] Dashboard d'administration des confirmations
- [ ] Tests unitaires et d'intégration

## 🧪 Comment tester

1. **Appliquer la migration**
   ```bash
   # Dans Supabase SQL Editor
   # Exécuter: supabase/migrations/003_add_email_confirmations.sql
   ```

2. **Créer un projet**
   - Le créateur recevra un email

3. **Créer et assigner une tâche**
   - L'employé recevra un email avec bouton de confirmation
   - Cliquer sur le bouton devrait mettre la tâche "EN COURS"

4. **Vérifier dans la base**
   ```sql
   SELECT * FROM email_confirmations;
   SELECT * FROM activity_logs WHERE action = 'start';
   ```

## 📊 Structure de la table email_confirmations

```sql
CREATE TABLE email_confirmations (
  id UUID PRIMARY KEY,
  token VARCHAR(255) UNIQUE,
  type VARCHAR(50), -- TASK_ASSIGNMENT, TASK_STATUS_CHANGE, etc.
  user_id UUID,
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB,
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🆘 Troubleshooting

### Email non reçu
- Vérifier les logs de `email_logs` dans Supabase
- Vérifier les credentials SMTP
- Vérifier les spam/courrier indésirable

### Token expiré
- Les tokens expirent après 7 jours
- Demander une nouvelle assignation

### Confirmation ne fonctionne pas
- Vérifier que la migration a été appliquée
- Vérifier les logs de l'API `/api/confirm-email`
- Vérifier que l'URL contient bien le token

## 📞 Support

Pour toute question ou problème, consulter les logs :
- `activity_logs` pour les actions
- `email_logs` pour les emails
- `email_confirmations` pour les tokens

