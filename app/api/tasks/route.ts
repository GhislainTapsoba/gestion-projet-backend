import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { sendEmail } from '@/lib/emailService';
import { taskAssignedTemplate } from '@/lib/emailTemplates';
import { createConfirmationToken } from '@/lib/emailConfirmation';
import { mapDbRoleToUserRole, requirePermission, canManageProject } from '@/lib/permissions';
import { sendActionNotification } from '@/lib/notificationService';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/tasks - Récupérer toutes les tâches (filtrées par assignation)
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role);
    const perm = requirePermission(userRole, 'tasks', 'read');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const project_id = searchParams.get('project_id');

    // Si ADMIN, retourner toutes les tâches
    if (userRole === 'admin') {
      let query = supabaseAdmin.from('tasks').select(`
        *,
        assigned_to:users!assigned_to_id(name),
        created_by:users!created_by_id(name)
      `);

      if (status) {
        query = query.eq('status', status);
      }

      if (project_id) {
        query = query.eq('project_id', project_id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        return corsResponse(
          { error: 'Erreur lors de la récupération des tâches' },
          request,
          { status: 500 }
        );
      }

      // Transform data to use names instead of IDs
      const transformedData = data?.map(task => ({
        ...task,
        assigned_to_name: task.assigned_to?.name || null,
        created_by_name: task.created_by?.name || null
      }));
      transformedData?.forEach(task => {
        delete task.assigned_to_id;
        delete task.created_by_id;
        delete task.assigned_to;
        delete task.created_by;
      });

      return corsResponse(transformedData || [], request);
    }

    // Pour les autres rôles, récupérer d'abord les projets accessibles
    const { data: projectMembers, error: membersError } = await supabaseAdmin
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id);

    if (membersError) throw membersError;

    const memberProjectIds = projectMembers?.map(pm => pm.project_id) || [];

    // Récupérer les projets où l'utilisateur est créateur ou manager
    const { data: accessibleProjects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .or(`created_by_id.eq.${user.id},manager_id.eq.${user.id}${memberProjectIds.length > 0 ? `,id.in.(${memberProjectIds.join(',')})` : ''}`);

    if (projectsError) throw projectsError;

    const accessibleProjectIds = accessibleProjects?.map(p => p.id) || [];

    // Récupérer les tâches assignées à l'utilisateur OU dans un projet accessible
    let query = supabaseAdmin.from('tasks').select(`
      *,
      assigned_to:users!assigned_to_id(name),
      created_by:users!created_by_id(name)
    `);

    if (accessibleProjectIds.length > 0) {
      query = query.or(`assigned_to_id.eq.${user.id},project_id.in.(${accessibleProjectIds.join(',')})`);
    } else {
      query = query.eq('assigned_to_id', user.id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (project_id) {
      query = query.eq('project_id', project_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération des tâches' },
        request,
        { status: 500 }
      );
    }

    // Transform data to use names instead of IDs
    const transformedData = data?.map(task => ({
      ...task,
      assigned_to_name: task.assigned_to?.name || null,
      created_by_name: task.created_by?.name || null
    }));
    transformedData?.forEach(task => {
      delete task.assigned_to_id;
      delete task.created_by_id;
      delete task.assigned_to;
      delete task.created_by;
    });

    return corsResponse(transformedData || [], request);
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// POST /api/tasks - Créer une nouvelle tâche
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role);
    const userId = user.id;

    const perm = requirePermission(userRole, 'tasks', 'create');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const body = await request.json();

    // Validation
    if (!body.title || !body.project_id) {
      return corsResponse(
        { error: 'Le titre et le project_id sont requis' },
        request,
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur peut gérer le projet (manager/admin)
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, manager_id')
      .eq('id', body.project_id)
      .single();

    if (!project) {
      return corsResponse(
        { error: 'Projet introuvable' },
        request,
        { status: 404 }
      );
    }

    if (!canManageProject(userRole, userId, project.manager_id)) {
      return corsResponse(
        { error: 'Vous ne pouvez créer des tâches que sur vos projets' },
        request,
        { status: 403 }
      );
    }

    // Créer la tâche
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        title: body.title,
        description: body.description || null,
        status: body.status || 'TODO',
        priority: body.priority || 'MEDIUM',
        due_date: body.due_date || null,
        assigned_to_id: body.assigned_to_id || null,
        project_id: body.project_id,
        stage_id: body.stage_id || null,
        created_by_id: userId,
      })
      .select(`
        *,
        assigned_to:users!assigned_to_id(name),
        created_by:users!created_by_id(name)
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la création de la tâche' },
        request,
        { status: 500 }
      );
    }

    // Récupérer les informations complètes pour les notifications
    const { data: projectDetails } = await supabaseAdmin
      .from('projects')
      .select('name, title')
      .eq('id', task.project_id)
      .single();

    const { data: assignedUser } = task.assigned_to_id
      ? await supabaseAdmin
          .from('users')
          .select('id, name, email, role')
          .eq('id', task.assigned_to_id)
          .single()
      : { data: null };

    // Créer un token de confirmation si la tâche est assignée
    let confirmationToken: string | null = null;
    if (task.assigned_to_id) {
      confirmationToken = await createConfirmationToken({
        type: 'TASK_ASSIGNMENT',
        userId: task.assigned_to_id,
        entityType: 'task',
        entityId: task.id,
        metadata: {
          task_title: task.title,
          project_name: projectDetails?.title || projectDetails?.name || 'Projet'
        }
      });

      // Créer une notification in-app
      await supabaseAdmin.from('notifications').insert({
        user_id: task.assigned_to_id,
        type: 'TASK_ASSIGNED',
        title: 'Nouvelle tâche assignée',
        message: `Vous avez été assigné à la tâche: ${task.title}`,
        metadata: {
          task_id: task.id,
          project_id: task.project_id,
          priority: task.priority
        }
      });
    }

    // Envoyer les notifications par email selon les règles métier
    await sendActionNotification({
      actionType: task.assigned_to_id ? 'TASK_ASSIGNED' : 'TASK_CREATED',
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
      affectedUsers: assignedUser ? [assignedUser] : [],
      projectId: task.project_id,
      metadata: {
        projectName: projectDetails?.title || projectDetails?.name || 'Projet',
        assigneeName: assignedUser?.name || 'Utilisateur',
        confirmationToken
      }
    });

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

    return corsResponse(transformedTask, request, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
