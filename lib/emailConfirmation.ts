import { randomBytes } from 'crypto';
import { supabaseAdmin } from './supabase';
import { sendEmailToResponsibles } from './emailService';
import {
  employeeTaskConfirmationTemplate,
  taskStatusChangeAcknowledgementTemplate,
  stageStatusChangeAcknowledgementTemplate
} from './emailTemplates';

export interface ConfirmationTokenData {
  type: 'TASK_ASSIGNMENT' | 'TASK_STATUS_CHANGE' | 'STAGE_STATUS_CHANGE' | 'PROJECT_CREATED';
  userId: string;
  entityType: string;
  entityId: string;
  metadata?: any;
}

/**
 * Générer un token de confirmation sécurisé
 */
export function generateConfirmationToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Créer un token de confirmation dans la base de données
 */
export async function createConfirmationToken(data: ConfirmationTokenData): Promise<string | null> {
  try {
    const token = generateConfirmationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire dans 7 jours

    const { error } = await supabaseAdmin
      .from('email_confirmations')
      .insert({
        token,
        type: data.type,
        user_id: data.userId,
        entity_type: data.entityType,
        entity_id: data.entityId,
        metadata: data.metadata,
        expires_at: expiresAt.toISOString()
      });

    if (error) {
      console.error('Error creating confirmation token:', error);
      return null;
    }

    return token;
  } catch (error) {
    console.error('Error in createConfirmationToken:', error);
    return null;
  }
}

/**
 * Vérifier et confirmer un token
 */
export async function confirmToken(token: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    // Récupérer le token
    const { data: confirmation, error: fetchError } = await supabaseAdmin
      .from('email_confirmations')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !confirmation) {
      return { success: false, error: 'Token invalide ou expiré' };
    }

    // Vérifier si déjà confirmé
    if (confirmation.confirmed) {
      return { success: false, error: 'Ce token a déjà été utilisé' };
    }

    // Vérifier l'expiration
    if (new Date(confirmation.expires_at) < new Date()) {
      return { success: false, error: 'Ce token a expiré' };
    }

    // Marquer comme confirmé
    const { error: updateError } = await supabaseAdmin
      .from('email_confirmations')
      .update({
        confirmed: true,
        confirmed_at: new Date().toISOString()
      })
      .eq('id', confirmation.id);

    if (updateError) {
      console.error('Error updating confirmation:', updateError);
      return { success: false, error: 'Erreur lors de la confirmation' };
    }

    return {
      success: true,
      data: {
        type: confirmation.type,
        userId: confirmation.user_id,
        entityType: confirmation.entity_type,
        entityId: confirmation.entity_id,
        metadata: confirmation.metadata
      }
    };
  } catch (error) {
    console.error('Error in confirmToken:', error);
    return { success: false, error: 'Erreur serveur' };
  }
}

/**
 * Exécuter l'action liée à la confirmation
 */
export async function executeConfirmationAction(confirmationData: any): Promise<boolean> {
  try {
    switch (confirmationData.type) {
      case 'TASK_ASSIGNMENT':
        // 1. Passer la tâche en "EN COURS"
        const { data: updatedTask, error: updateError } = await supabaseAdmin
          .from('tasks')
          .update({ status: 'IN_PROGRESS' })
          .eq('id', confirmationData.entityId)
          .select(`
            *,
            project:projects(id, title),
            assignee:users!assigned_to_id(id, name, email)
          `)
          .single();

        if (updateError || !updatedTask) {
          console.error('Error updating task or task not found:', updateError);
          return false;
        }
        
        // 2. Log l'activité
        await supabaseAdmin.from('activity_logs').insert({
          user_id: confirmationData.userId,
          action: 'start',
          entity_type: 'task',
          entity_id: confirmationData.entityId,
          details: 'Task started by email confirmation'
        });

        // 3. Envoyer un email de notification aux responsables
        if (updatedTask.project?.id) {
          const emailHtml = employeeTaskConfirmationTemplate({
            employeeName: updatedTask.assignee?.name || 'Un employé',
            taskTitle: updatedTask.title,
            projectName: updatedTask.project.title,
            taskId: updatedTask.id.toString(),
            managerName: 'Responsable',
          });

          await sendEmailToResponsibles(
            updatedTask.project.id,
            `✅ Tâche démarrée: ${updatedTask.title}`,
            emailHtml,
            {
              entity_type: 'task',
              entity_id: updatedTask.id,
              action: 'TASK_STARTED_NOTIFICATION'
            }
          );
        }
        break;

      case 'TASK_STATUS_CHANGE':
        // 1. Récupérer les informations de la tâche
        const { data: taskData, error: taskError } = await supabaseAdmin
          .from('tasks')
          .select(`
            *,
            project:projects(*),
            assignee:users!assigned_to_id(id, name, email)
          `)
          .eq('id', confirmationData.entityId)
          .single();

        if (taskError || !taskData) {
          console.error('Error fetching task for acknowledgement:', taskError);
          return false;
        }

        // 2. Marquer que l'employé a confirmé la réception
        await supabaseAdmin.from('activity_logs').insert({
          user_id: confirmationData.userId,
          action: 'acknowledge',
          entity_type: 'task',
          entity_id: confirmationData.entityId,
          details: 'Task status change acknowledged',
          metadata: confirmationData.metadata
        });

        // 3. Envoyer un email d'accusé de réception au chef de projet et admin
        if (taskData.project?.id) {
          const emailHtml = taskStatusChangeAcknowledgementTemplate({
            employeeName: taskData.assignee?.name || 'Un employé',
            taskTitle: taskData.title,
            projectName: taskData.project.title,
            taskId: taskData.id.toString(),
            managerName: 'Responsable',
            oldStatus: confirmationData.metadata?.old_status || 'UNKNOWN',
            newStatus: confirmationData.metadata?.new_status || taskData.status
          });

          await sendEmailToResponsibles(
            taskData.project.id,
            `📧 Accusé de réception: ${taskData.title}`,
            emailHtml,
            {
              entity_type: 'task',
              entity_id: taskData.id,
              action: 'TASK_STATUS_CHANGE_ACKNOWLEDGED'
            }
          );
        }
        break;

      case 'STAGE_STATUS_CHANGE':
        // 1. Récupérer les informations de l'étape
        const { data: stageData, error: stageError } = await supabaseAdmin
          .from('stages')
          .select(`
            *,
            project:projects(*)
          `)
          .eq('id', confirmationData.entityId)
          .single();

        if (stageError || !stageData) {
          console.error('Error fetching stage for acknowledgement:', stageError);
          return false;
        }

        // 2. Récupérer les informations de l'employé
        const { data: employeeData } = await supabaseAdmin
          .from('users')
          .select('name')
          .eq('id', confirmationData.userId)
          .single();

        // 3. Log le changement d'étape
        await supabaseAdmin.from('activity_logs').insert({
          user_id: confirmationData.userId,
          action: 'acknowledge',
          entity_type: 'stage',
          entity_id: confirmationData.entityId,
          details: 'Stage status change acknowledged',
          metadata: confirmationData.metadata
        });

        // 4. Envoyer un email d'accusé de réception au chef de projet et admin
        if (stageData.project?.id) {
          const emailHtml = stageStatusChangeAcknowledgementTemplate({
            employeeName: employeeData?.name || 'Un employé',
            stageName: stageData.name,
            projectName: stageData.project.title,
            projectId: stageData.project.id.toString(),
            stageId: stageData.id.toString(),
            managerName: 'Responsable',
            oldStatus: confirmationData.metadata?.old_status || 'UNKNOWN',
            newStatus: confirmationData.metadata?.new_status || stageData.status
          });

          await sendEmailToResponsibles(
            stageData.project.id,
            `📧 Accusé de réception: Étape ${stageData.name}`,
            emailHtml,
            {
              entity_type: 'stage',
              entity_id: stageData.id,
              action: 'STAGE_STATUS_CHANGE_ACKNOWLEDGED'
            }
          );
        }
        break;

      default:
        console.log('Unknown confirmation type:', confirmationData.type);
    }

    return true;
  } catch (error) {
    console.error('Error executing confirmation action:', error);
    return false;
  }
}

