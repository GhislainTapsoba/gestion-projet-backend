import { supabaseAdmin } from './supabase';
import { sendEmail } from './emailService';
import * as emailTemplates from './emailTemplates';

export type ActionType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'STAGE_CREATED'
  | 'STAGE_UPDATED'
  | 'STAGE_COMPLETED';

export interface NotificationContext {
  actionType: ActionType;
  performedBy: {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE';
  };
  entity: {
    type: 'task' | 'project' | 'stage';
    id: string;
    data: any; // Les données complètes de l'entité
  };
  affectedUsers?: {
    id: string;
    name: string;
    email: string;
    role: string;
  }[];
  projectId?: string;
  metadata?: any;
}

/**
 * Détermine les destinataires des notifications selon les règles métier
 */
async function determineRecipients(context: NotificationContext): Promise<string[]> {
  const recipients = new Set<string>();
  const { performedBy, affectedUsers, projectId } = context;

  // Récupérer le chef de projet si nécessaire
  let projectManager: any = null;
  if (projectId) {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('manager_id, manager:users!projects_manager_id_fkey(id, email, name, role)')
      .eq('id', projectId)
      .single();

    if (project?.manager) {
      projectManager = project.manager;
    }
  }

  // Récupérer l'admin
  const { data: admins } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role')
    .eq('role', 'ADMIN');

  const adminEmails = admins?.map(a => a.email) || [];

  // Règles de notification selon le rôle de celui qui fait l'action
  switch (performedBy.role) {
    case 'EMPLOYEE':
      // Employé → Email à : Employé + Chef de projet + Admin
      recipients.add(performedBy.email);
      if (projectManager) {
        recipients.add(projectManager.email);
      }
      adminEmails.forEach(email => recipients.add(email));
      break;

    case 'PROJECT_MANAGER':
      // Chef de projet → Email à : Chef + Admin + (Employés concernés si applicable)
      recipients.add(performedBy.email);
      adminEmails.forEach(email => recipients.add(email));

      // Ajouter les employés concernés
      if (affectedUsers && affectedUsers.length > 0) {
        affectedUsers.forEach(user => {
          if (user.role === 'EMPLOYEE') {
            recipients.add(user.email);
          }
        });
      }
      break;

    case 'ADMIN':
      // Admin → Email à : Admin + (Personnes concernées si applicable)
      recipients.add(performedBy.email);

      // Ajouter les personnes concernées (employés ou chefs de projet)
      if (affectedUsers && affectedUsers.length > 0) {
        affectedUsers.forEach(user => recipients.add(user.email));
      }
      if (projectManager && affectedUsers && affectedUsers.length > 0) {
        recipients.add(projectManager.email);
      }
      break;
  }

  return Array.from(recipients);
}

/**
 * Génère le contenu de l'email selon le type d'action
 */
function generateEmailContent(context: NotificationContext, recipientEmail: string): {
  subject: string;
  html: string;
} | null {
  const { actionType, performedBy, entity, metadata } = context;

  switch (actionType) {
    case 'TASK_CREATED':
    case 'TASK_ASSIGNED':
      return {
        subject: `Nouvelle tâche assignée: ${entity.data.title}`,
        html: emailTemplates.taskAssignedTemplate({
          userName: metadata?.assigneeName || 'Utilisateur',
          taskTitle: entity.data.title,
          taskDescription: entity.data.description,
          projectName: metadata?.projectName || 'Projet',
          dueDate: entity.data.due_date,
          priority: entity.data.priority || 'MEDIUM',
          taskId: entity.id,
          confirmationToken: metadata?.confirmationToken
        })
      };

    case 'TASK_STATUS_CHANGED':
      return {
        subject: `Changement de statut: ${entity.data.title}`,
        html: emailTemplates.taskStatusChangedByEmployeeTemplate({
          employeeName: performedBy.name,
          taskTitle: entity.data.title,
          taskId: entity.id,
          projectTitle: metadata?.projectName || 'Projet',
          projectId: metadata?.projectId || '',
          oldStatus: metadata?.oldStatus || 'UNKNOWN',
          newStatus: entity.data.status,
          comment: metadata?.comment
        })
      };

    case 'TASK_COMPLETED':
      return {
        subject: `✅ Tâche terminée: ${entity.data.title}`,
        html: emailTemplates.taskCompletedByEmployeeTemplate({
          managerName: 'Responsable',
          taskTitle: entity.data.title,
          employeeName: performedBy.name,
          projectName: metadata?.projectName || 'Projet',
          completionComment: metadata?.comment,
          taskId: entity.id
        })
      };

    case 'TASK_UPDATED':
      return {
        subject: `Tâche mise à jour: ${entity.data.title}`,
        html: emailTemplates.taskUpdatedTemplate({
          userName: 'Utilisateur',
          taskTitle: entity.data.title,
          changes: metadata?.changes || 'Modifications effectuées',
          taskId: entity.id,
          updatedBy: performedBy.name
        })
      };

    case 'PROJECT_CREATED':
      return {
        subject: `🎉 Nouveau projet créé: ${entity.data.name}`,
        html: emailTemplates.projectCreatedTemplate({
          projectName: entity.data.name,
          description: entity.data.description,
          startDate: entity.data.start_date,
          dueDate: entity.data.due_date,
          createdBy: performedBy.name,
          projectId: entity.id
        })
      };

    case 'STAGE_COMPLETED':
      return {
        subject: `✅ Étape complétée: ${entity.data.name}`,
        html: emailTemplates.stageCompletedTemplate({
          stageName: entity.data.name,
          projectName: metadata?.projectName || 'Projet',
          completedBy: performedBy.name,
          nextStageName: metadata?.nextStageName,
          tasksCreated: metadata?.tasksCreated || 0,
          projectId: metadata?.projectId || entity.id
        })
      };

    case 'STAGE_UPDATED':
      return {
        subject: `Étape mise à jour: ${entity.data.name}`,
        html: emailTemplates.stageStatusChangedByEmployeeTemplate({
          employeeName: performedBy.name,
          stageName: entity.data.name,
          stageId: entity.id,
          projectTitle: metadata?.projectName || 'Projet',
          projectId: metadata?.projectId || '',
          oldStatus: metadata?.oldStatus || 'UNKNOWN',
          newStatus: entity.data.status,
          comment: metadata?.comment
        })
      };

    default:
      return null;
  }
}

/**
 * Fonction principale pour envoyer les notifications
 */
export async function sendActionNotification(context: NotificationContext): Promise<void> {
  try {
    // Déterminer les destinataires
    const recipients = await determineRecipients(context);

    if (recipients.length === 0) {
      console.log('No recipients found for notification');
      return;
    }

    // Envoyer l'email à chaque destinataire
    for (const recipientEmail of recipients) {
      const emailContent = generateEmailContent(context, recipientEmail);

      if (!emailContent) {
        console.error(`No email template found for action type: ${context.actionType}`);
        continue;
      }

      await sendEmail({
        to: recipientEmail,
        subject: emailContent.subject,
        html: emailContent.html
      });

      console.log(`Notification sent to ${recipientEmail} for action ${context.actionType}`);
    }

    // Logger l'activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: context.performedBy.id,
      action: context.actionType.toLowerCase(),
      entity_type: context.entity.type,
      entity_id: context.entity.id,
      details: `Notifications sent to ${recipients.length} recipients`,
      metadata: { recipients }
    });

  } catch (error) {
    console.error('Error sending action notification:', error);
    // Ne pas faire échouer la requête si l'email échoue
  }
}
