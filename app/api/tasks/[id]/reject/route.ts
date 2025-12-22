import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { sendEmail, sendEmailToResponsibles } from '@/lib/emailService';
import { taskRejectedByEmployeeTemplate } from '@/lib/emailTemplates';
import { mapDbRoleToUserRole } from '@/lib/permissions';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// POST /api/tasks/[id]/reject - Refuser une tâche assignée
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role ?? null);
    const { id: taskId } = await context.params;
    const body = await request.json();
    const { rejectionReason } = body;

    // Valider que la raison du refus est fournie
    if (!rejectionReason || rejectionReason.trim() === '') {
      return corsResponse(
        { error: 'La raison du refus est obligatoire' },
        request,
        { status: 400 }
      );
    }

    // Récupérer la tâche
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return corsResponse({ error: 'Tâche non trouvée' }, request, { status: 404 });
    }

    // Vérifier que l'utilisateur est bien assigné à cette tâche
    if (task.assigned_to_id !== user.id) {
      return corsResponse(
        { error: 'Vous ne pouvez refuser que les tâches qui vous sont assignées' },
        request,
        { status: 403 }
      );
    }

    // Récupérer les informations du projet
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select(`
        id,
        title,
        created_by_id,
        manager_id,
        created_by:users!projects_created_by_id_fkey(id, email, name, role)
      `)
      .eq('id', task.project_id)
      .single();

    if (!project) {
      return corsResponse({ error: 'Projet associé introuvable' }, request, { status: 404 });
    }

    // Récupérer le responsable général (Admin)
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('role', 'ADMIN')
      .limit(1);

    // Créer la liste des destinataires (supérieurs)
    const recipients: Array<{ id: number; email: string; name: string }> = [];

    // Ajouter le créateur/chef de projet
    if (project.created_by && project.created_by.email) {
      recipients.push({
        id: project.created_by.id,
        email: project.created_by.email,
        name: project.created_by.name || 'Chef de projet'
      });
    }

    // Ajouter le responsable général si différent
    if (admins && admins.length > 0) {
      const admin = admins[0];
      if (!recipients.find(r => r.email === admin.email)) {
        recipients.push({
          id: admin.id,
          email: admin.email,
          name: admin.name || 'Responsable général'
        });
      }
    }

    // Envoyer les emails aux supérieurs
    for (const recipient of recipients) {
      const emailHtml = taskRejectedByEmployeeTemplate({
        employeeName: user.name || user.email || 'Employé',
        taskTitle: task.title,
        projectName: project.title || 'Projet',
        taskId: task.id,
        rejectionReason,
        managerName: recipient.name
      });

      await sendEmail({
        to: recipient.email,
        subject: `❌ Tâche refusée: ${task.title}`,
        html: emailHtml,
        userId: recipient.id,
        metadata: {
          task_id: task.id,
          project_id: project.id,
          action: 'TASK_REJECTED',
          rejected_by: user.id,
          rejection_reason: rejectionReason
        }
      });
    }

    // Logger l'action
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'reject',
      entity_type: 'task',
      entity_id: taskId,
      details: `Tâche refusée: ${task.title}${rejectionReason ? ` - Raison: ${rejectionReason}` : ''}`
    });

    return corsResponse(
      {
        success: true,
        message: 'Tâche refusée avec succès. Les responsables ont été notifiés.',
        task: {
          id: task.id,
          title: task.title,
          status: task.status // Le statut reste inchangé
        }
      },
      request
    );
  } catch (error) {
    console.error('POST /api/tasks/[id]/reject error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
