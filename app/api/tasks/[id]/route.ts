import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { sendEmail } from '@/lib/emailService';
import {
  taskAssignedTemplate,
  taskStatusChangeByManagerTemplate,
  taskCompletedByEmployeeTemplate,
  taskStatusChangedByEmployeeTemplate
} from '@/lib/emailTemplates';
import { createConfirmationToken } from '@/lib/emailConfirmation';
import { mapDbRoleToUserRole, requirePermission, canEditTask, canManageProject } from '@/lib/permissions';
import { sendActionNotification } from '@/lib/notificationService';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/tasks/[id] - Récupérer une tâche par ID (avec vérification d'accès)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role ?? null);
    const perm = requirePermission(userRole, 'tasks', 'read');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select(`
        *,
        assigned_to:users!assigned_to_id(name),
        created_by:users!created_by_id(name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return corsResponse({ error: 'Tâche non trouvée' }, request, { status: 404 });
      }
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération de la tâche' },
        request,
        { status: 500 }
      );
    }

    // Si non-ADMIN, vérifier l'accès à la tâche
    if (userRole !== 'admin') {
      const isAssigned = data.assigned_to_id === user.id;

      if (!isAssigned) {
        // Vérifier si l'utilisateur a accès au projet de la tâche
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('created_by_id, manager_id')
          .eq('id', data.project_id)
          .single();

        if (project) {
          const hasProjectAccess = project.created_by_id === user.id || project.manager_id === user.id;

          if (!hasProjectAccess) {
            // Vérifier si l'utilisateur est membre du projet
            const { data: membership } = await supabaseAdmin
              .from('project_members')
              .select('id')
              .eq('project_id', data.project_id)
              .eq('user_id', user.id)
              .single();

            if (!membership) {
              return corsResponse(
                { error: 'Vous n\'avez pas accès à cette tâche' },
                request,
                { status: 403 }
              );
            }
          }
        }
      }
    }

    // Transform data to use names instead of IDs
    const transformedData = {
      ...data,
      assigned_to_name: data.assigned_to?.name || null,
      created_by_name: data.created_by?.name || null
    };
    delete transformedData.assigned_to_id;
    delete transformedData.created_by_id;
    delete transformedData.assigned_to;
    delete transformedData.created_by;

    return corsResponse(transformedData, request);
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] - Mettre à jour une tâche
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const dbRole = user.role as string | null;
    const userRole = mapDbRoleToUserRole(dbRole);
    const userId = user.id as string;

    const perm = requirePermission(userRole, 'tasks', 'update');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id: taskId } = await params;
    const body = await request.json();

    // Récupérer la tâche avant modification pour comparer
    const { data: oldTask } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!oldTask) {
      return corsResponse({ error: 'Tâche non trouvée' }, request, { status: 404 });
    }

    // Récupérer le projet pour vérifier les droits
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, manager_id')
      .eq('id', oldTask.project_id)
      .single();

    if (!project) {
      return corsResponse({ error: 'Projet associé introuvable' }, request, { status: 404 });
    }

    // Vérifier si l'utilisateur peut éditer cette tâche
    const allowedEdit = canEditTask(
      userRole,
      userId,
      oldTask.assigned_to_id,
      project.manager_id
    );

    if (!allowedEdit) {
      return corsResponse(
        { error: 'Vous ne pouvez modifier que vos tâches ou celles de vos projets' },
        request,
        { status: 403 }
      );
    }

    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'COMPLETED' && !body.completed_at) {
        updateData.completed_at = new Date().toISOString();
      }
    }
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.due_date !== undefined) updateData.due_date = body.due_date;
    if (body.assigned_to_id !== undefined) updateData.assigned_to_id = body.assigned_to_id;
    if (body.project_id !== undefined) updateData.project_id = body.project_id;
    if (body.stage_id !== undefined) updateData.stage_id = body.stage_id;

    // Mettre à jour la tâche
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select(`
        *,
        assigned_to:users!assigned_to_id(name),
        created_by:users!created_by_id(name)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return corsResponse({ error: 'Tâche non trouvée' }, request, { status: 404 });
      }
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la mise à jour de la tâche' },
        request,
        { status: 500 }
      );
    }

    // Construire le message des changements
    const changes: string[] = [];
    if (body.title && oldTask?.title !== body.title) {
      changes.push(`Titre modifié`);
    }
    if (body.status && oldTask?.status !== body.status) {
      changes.push(`Statut changé: ${oldTask?.status} → ${body.status}`);
    }
    if (body.priority && oldTask?.priority !== body.priority) {
      changes.push(`Priorité changée: ${oldTask?.priority} → ${body.priority}`);
    }
    if (body.due_date && oldTask?.due_date !== body.due_date) {
      changes.push(`Échéance modifiée`);
    }
    // Détecter la réassignation
    const hasReassignment = !!(body.assigned_to_id && oldTask?.assigned_to_id !== body.assigned_to_id);
    if (hasReassignment) {
      changes.push(`Réassignation`);
    }

    // Récupérer les informations pour les notifications
    const hasStatusChange = !!(body.status && oldTask?.status !== body.status);
    const isCompletedNow = body.status === 'COMPLETED' && oldTask?.status !== 'COMPLETED';

    const { data: projectInfo } = await supabaseAdmin
      .from('projects')
      .select('name, title')
      .eq('id', task.project_id)
      .single();

    const { data: assignedUserInfo } = task.assigned_to_id
      ? await supabaseAdmin
          .from('users')
          .select('id, name, email, role')
          .eq('id', task.assigned_to_id)
          .single()
      : { data: null };

    // Gérer les notifications selon le type de modification

    // Cas 1: Réassignation de tâche
    if (hasReassignment && assignedUserInfo) {
      const confirmationToken = await createConfirmationToken({
        type: 'TASK_ASSIGNMENT',
        userId: task.assigned_to_id!,
        entityType: 'task',
        entityId: task.id,
        metadata: {
          task_title: task.title,
          project_name: projectInfo?.title || projectInfo?.name || 'Projet'
        }
      });

      await sendActionNotification({
        actionType: 'TASK_ASSIGNED',
        performedBy: {
          id: user.id,
          name: user.name || 'Utilisateur',
          email: user.email,
          role: user.role as 'ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE'
        },
        entity: {
          type: 'task',
          id: task.id,
          data: task
        },
        affectedUsers: [assignedUserInfo],
        projectId: task.project_id,
        metadata: {
          projectName: projectInfo?.title || projectInfo?.name || 'Projet',
          assigneeName: assignedUserInfo.name,
          confirmationToken
        }
      });
    }

    // Cas 2: Changement de statut
    if (hasStatusChange) {
      const actionType = isCompletedNow ? 'TASK_COMPLETED' : 'TASK_STATUS_CHANGED';

      let confirmationToken: string | null = null;
      if (userRole !== 'user' && assignedUserInfo) {
        // Si c'est un chef/admin qui change le statut, créer un token pour l'employé
        confirmationToken = await createConfirmationToken({
          type: 'TASK_STATUS_CHANGE',
          userId: assignedUserInfo.id,
          entityType: 'task',
          entityId: task.id,
          metadata: {
            old_status: oldTask?.status,
            new_status: body.status,
            project_name: projectInfo?.title || projectInfo?.name
          }
        });
      }

      await sendActionNotification({
        actionType,
        performedBy: {
          id: user.id,
          name: user.name || 'Utilisateur',
          email: user.email,
          role: user.role as 'ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE'
        },
        entity: {
          type: 'task',
          id: task.id,
          data: task
        },
        affectedUsers: assignedUserInfo ? [assignedUserInfo] : [],
        projectId: task.project_id,
        metadata: {
          projectName: projectInfo?.title || projectInfo?.name || 'Projet',
          projectId: task.project_id,
          oldStatus: oldTask?.status,
          newStatus: body.status,
          comment: body.comment,
          confirmationToken
        }
      });
    }

    // Cas 3: Autres modifications (sans changement de statut ni réassignation)
    if (!hasStatusChange && !hasReassignment && changes.length > 0) {
      await sendActionNotification({
        actionType: 'TASK_UPDATED',
        performedBy: {
          id: user.id,
          name: user.name || 'Utilisateur',
          email: user.email,
          role: user.role as 'ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE'
        },
        entity: {
          type: 'task',
          id: task.id,
          data: task
        },
        affectedUsers: assignedUserInfo ? [assignedUserInfo] : [],
        projectId: task.project_id,
        metadata: {
          projectName: projectInfo?.title || projectInfo?.name || 'Projet',
          changes: changes.join(', ')
        }
      });
    }

    // Transform task data to use names instead of IDs
    const transformedTask = {
      ...task,
      assigned_to_name: task.assigned_to?.name || null,
      created_by_name: task.created_by?.name || null
    };
    delete transformedTask.assigned_to_id;
    delete transformedTask.created_by_id;
    delete transformedTask.assigned_to;
    delete transformedTask.created_by;

    return corsResponse(transformedTask, request);
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id] - Mettre à jour une tâche (alias de PATCH)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(request, { params });
}

// DELETE /api/tasks/[id] - Supprimer une tâche
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const dbRole = user.role as string | null;
    const userRole = mapDbRoleToUserRole(dbRole);
    const userId = user.id as string;

    const perm = requirePermission(userRole, 'tasks', 'delete');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id: taskId } = await params;

    // Récupérer la tâche + projet avant suppression pour vérifier les droits et loguer
    const { data: task } = await supabaseAdmin
      .from('tasks')
      .select('title, project_id')
      .eq('id', taskId)
      .single();

    if (!task) {
      return corsResponse({ error: 'Tâche non trouvée' }, request, { status: 404 });
    }

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, manager_id')
      .eq('id', task.project_id)
      .single();

    if (!project) {
      return corsResponse({ error: 'Projet associé introuvable' }, request, { status: 404 });
    }

    if (!canManageProject(userRole, userId, project.manager_id)) {
      return corsResponse(
        { error: 'Vous ne pouvez supprimer que les tâches de vos projets' },
        request,
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la suppression de la tâche' },
        request,
        { status: 500 }
      );
    }

    // Log de l'activité
    if (task) {
      await supabaseAdmin.from('activity_logs').insert({
        user_id: '00000000-0000-0000-0000-000000000001', // TODO: Récupérer l'ID de l'utilisateur connecté
        action: 'delete',
        entity_type: 'task',
        entity_id: taskId,
        details: `Deleted task: ${task.title}`
      });
    }

    return corsResponse({ success: true, message: 'Tâche supprimée avec succès' }, request);
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
