import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { sendEmail } from '@/lib/emailService';
import { projectCreatedNotificationTemplate } from '@/lib/emailTemplates';
import { mapDbRoleToUserRole, requirePermission } from '@/lib/permissions';
import { sendActionNotification } from '@/lib/notificationService';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/projects - Récupérer tous les projets (filtrés par assignation)
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role);
    const perm = requirePermission(userRole, 'projects', 'read');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Si ADMIN, retourner tous les projets
    if (userRole === 'admin') {
      let query = supabaseAdmin.from('projects').select(`
        *,
        manager:users!manager_id(name)
      `);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to use manager_name instead of manager_id
      const transformedData = data?.map(project => ({
        ...project,
        manager_name: project.manager?.name || null
      }));
      transformedData?.forEach(project => {
        delete project.manager_id;
        delete project.manager;
      });

      return corsResponse(transformedData || [], request);
    }

    // Pour les autres rôles, filtrer par assignation
    // Récupérer les IDs des projets accessibles via project_members
    const { data: projectMembers, error: membersError } = await supabaseAdmin
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id);

    if (membersError) throw membersError;

    const memberProjectIds = projectMembers?.map(pm => pm.project_id) || [];

    // Récupérer les IDs des projets où l'utilisateur a des tâches assignées
    const { data: assignedTasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('project_id')
      .eq('assigned_to_id', user.id);

    if (tasksError) throw tasksError;

    const taskProjectIds = assignedTasks?.map(t => t.project_id) || [];

    // Combiner tous les IDs de projets accessibles
    const allAccessibleProjectIds = [...new Set([...memberProjectIds, ...taskProjectIds])];

    // Récupérer les projets où l'utilisateur est créateur, manager, membre OU a des tâches assignées
    let query = supabaseAdmin
      .from('projects')
      .select(`
        *,
        manager:users!manager_id(name)
      `)
      .or(`created_by_id.eq.${user.id},manager_id.eq.${user.id}${allAccessibleProjectIds.length > 0 ? `,id.in.(${allAccessibleProjectIds.join(',')})` : ''}`);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Transform data to use manager_name instead of manager_id
    const transformedData = data?.map(project => ({
      ...project,
      manager_name: project.manager?.name || null
    }));
    transformedData?.forEach(project => {
      delete project.manager_id;
      delete project.manager;
    });

    return corsResponse(transformedData || [], request);
  } catch (error) {
    console.error('Get projects error:', error);
    return corsResponse(
      { error: 'Failed to fetch projects', details: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500 }
    );
  }
}

// POST /api/projects - Créer un nouveau projet
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role);
    const perm = requirePermission(userRole, 'projects', 'create');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({
        title: body.title,
        description: body.description || null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        due_date: body.due_date || null,
        status: body.status || 'PLANNING',
        created_by_id: body.created_by_id || user.id || null,
        manager_id: body.manager_id || null,
      })
      .select(`
        *,
        manager:users!manager_id(name)
      `)
      .single();

    if (error) throw error;

    // Envoyer les notifications selon les règles métier
    const { data: managerInfo } = data.manager_id
      ? await supabaseAdmin
          .from('users')
          .select('id, name, email, role')
          .eq('id', data.manager_id)
          .single()
      : { data: null };

    const affectedUsers = managerInfo ? [managerInfo] : [];

    await sendActionNotification({
      actionType: 'PROJECT_CREATED',
      performedBy: {
        id: user.id,
        name: user.name || 'Utilisateur',
        email: user.email,
        role: user.role as 'ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE'
      },
      entity: {
        type: 'project',
        id: data.id,
        data: data
      },
      affectedUsers,
      projectId: data.id,
      metadata: {}
    });

    // Transform data to use manager_name instead of manager_id
    const transformedData = {
      ...data,
      manager_name: data.manager?.name || null
    };
    delete transformedData.manager_id;
    delete transformedData.manager;

    return corsResponse(transformedData, request, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return corsResponse(
      { error: 'Failed to create project', details: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500 }
    );
  }
}
