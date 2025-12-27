import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { mapDbRoleToUserRole, requirePermission, canManageProject } from '@/lib/permissions';
import { sendActionNotification } from '@/lib/notificationService';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/projects/[id] - Récupérer un projet par ID (avec vérification d'accès)
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
    const perm = requirePermission(userRole, 'projects', 'read');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        manager:users!manager_id(name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return corsResponse({ error: 'Project not found' }, request, { status: 404 });
      }
      throw error;
    }

    // Si non-ADMIN, vérifier l'accès au projet
    if (userRole !== 'admin') {
      const hasAccess = data.created_by_id === user.id || data.manager_id === user.id;

      if (!hasAccess) {
        // Vérifier si l'utilisateur est membre du projet
        const { data: membership } = await supabaseAdmin
          .from('project_members')
          .select('id')
          .eq('project_id', id)
          .eq('user_id', user.id)
          .single();

        // Si pas membre, vérifier si l'utilisateur a des tâches assignées dans ce projet
        if (!membership) {
          const { data: assignedTasks } = await supabaseAdmin
            .from('tasks')
            .select('id')
            .eq('project_id', id)
            .eq('assigned_to_id', user.id)
            .limit(1)
            .single();

          if (!assignedTasks) {
            return corsResponse(
              { error: 'Vous n\'avez pas accès à ce projet' },
              request,
              { status: 403 }
            );
          }
        }
      }
    }

    // Transform data to use manager_name instead of manager_id
    const transformedData = {
      ...data,
      manager_name: data.manager?.name || null
    };
    delete transformedData.manager_id;
    delete transformedData.manager;

    return corsResponse(transformedData, request);
  } catch (error) {
    console.error('Get project error:', error);
    return corsResponse(
      { error: 'Failed to fetch project', details: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Mettre à jour un projet
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role ?? null);
    const userId = user.id as string;

    const perm = requirePermission(userRole, 'projects', 'update');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Vérifier que l'utilisateur peut gérer ce projet
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, manager_id')
      .eq('id', id)
      .single();

    if (!project) {
      return corsResponse({ error: 'Project not found' }, request, { status: 404 });
    }

    if (!canManageProject(userRole, userId, project.manager_id)) {
      return corsResponse(
        { error: 'Vous ne pouvez modifier que vos propres projets' },
        request,
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.start_date !== undefined) updateData.start_date = body.start_date;
    if (body.end_date !== undefined) updateData.end_date = body.end_date;
    if (body.due_date !== undefined) updateData.due_date = body.due_date;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.manager_id !== undefined) updateData.manager_id = body.manager_id;

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        manager:users!manager_id(name)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return corsResponse({ error: 'Project not found' }, request, { status: 404 });
      }
      throw error;
    }

    // Transform data to use manager_name instead of manager_id
    const transformedData = {
      ...data,
      manager_name: data.manager?.name || null
    };
    delete transformedData.manager_id;
    delete transformedData.manager;

    // Note: Les notifications pour les modifications de projet sont désactivées pour l'instant
    // car il n'y a pas de template email dédié. Les modifications importantes (statut, etc.)
    // sont déjà notifiées via les tâches et étapes associées.

    return corsResponse(transformedData, request);
  } catch (error) {
    console.error('Update project error:', error);
    return corsResponse(
      { error: 'Failed to update project', details: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id] - Mettre à jour un projet (alias de PATCH)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(request, { params });
}

// DELETE /api/projects/[id] - Supprimer un projet
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role ?? null);
    const userId = user.id as string;

    const perm = requirePermission(userRole, 'projects', 'delete');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;

    // Vérifier que l'utilisateur peut gérer ce projet
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, manager_id')
      .eq('id', id)
      .single();

    if (!project) {
      return corsResponse({ error: 'Project not found' }, request, { status: 404 });
    }

    if (!canManageProject(userRole, userId, project.manager_id)) {
      return corsResponse(
        { error: 'Vous ne pouvez supprimer que vos propres projets' },
        request,
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return corsResponse({ message: 'Project deleted successfully' }, request);
  } catch (error) {
    console.error('Delete project error:', error);
    return corsResponse(
      { error: 'Failed to delete project', details: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500 }
    );
  }
}
