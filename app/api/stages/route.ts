import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { mapDbRoleToUserRole, requirePermission, canManageProject } from '@/lib/permissions';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/stages - Récupérer toutes les étapes (filtrées par accès au projet)
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role as string | null);
    const userId = user.id as string;
    const perm = requirePermission(userRole, 'stages', 'read');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    // Si ADMIN, retourner toutes les étapes
    if (userRole === 'admin') {
      let query = supabaseAdmin
        .from('stages')
        .select(`
          *,
          created_by:users!created_by_id(name)
        `)
        .order('order', { ascending: true });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error:', error);
        return corsResponse(
          { error: 'Erreur lors de la récupération des étapes' },
          request,
          { status: 500 }
        );
      }

      // Transform data to use names instead of IDs
      const transformedData = data?.map(stage => ({
        ...stage,
        created_by_name: stage.created_by?.name || null
      }));
      transformedData?.forEach(stage => {
        delete stage.created_by_id;
        delete stage.created_by;
      });

      return corsResponse(transformedData, request);
    }

    // Pour les autres rôles, filtrer par accès au projet
    // Récupérer les IDs des projets accessibles via project_members
    const { data: projectMembers, error: membersError } = await supabaseAdmin
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId);

    if (membersError) throw membersError;

    const memberProjectIds = projectMembers?.map(pm => pm.project_id) || [];

    // Récupérer les IDs des projets où l'utilisateur a des tâches assignées
    const { data: assignedTasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('project_id')
      .eq('assigned_to_id', userId);

    if (tasksError) throw tasksError;

    const taskProjectIds = assignedTasks?.map(t => t.project_id) || [];

    // Combiner tous les IDs de projets accessibles
    const allAccessibleProjectIds = [...new Set([...memberProjectIds, ...taskProjectIds])];

    // Récupérer les projets où l'utilisateur est créateur, manager, membre OU a des tâches assignées
    const { data: accessibleProjects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .or(`created_by_id.eq.${userId},manager_id.eq.${userId}${allAccessibleProjectIds.length > 0 ? `,id.in.(${allAccessibleProjectIds.join(',')})` : ''}`);

    if (projectsError) throw projectsError;

    const accessibleProjectIds = accessibleProjects?.map(p => p.id) || [];

    if (accessibleProjectIds.length === 0) {
      return corsResponse([], request);
    }

    // Récupérer les étapes des projets accessibles
    let query = supabaseAdmin
      .from('stages')
      .select(`
        *,
        created_by:users!created_by_id(name)
      `)
      .in('project_id', accessibleProjectIds)
      .order('order', { ascending: true });

    if (projectId) {
      // Vérifier que l'utilisateur a accès à ce projet
      if (!accessibleProjectIds.includes(projectId)) {
        return corsResponse({ error: 'Accès non autorisé à ce projet' }, request, { status: 403 });
      }
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération des étapes' },
        request,
        { status: 500 }
      );
    }

    // Transform data to use names instead of IDs
    const transformedData = data?.map(stage => ({
      ...stage,
      created_by_name: stage.created_by?.name || null
    }));
    transformedData?.forEach(stage => {
      delete stage.created_by_id;
      delete stage.created_by;
    });

    return corsResponse(transformedData, request);
  } catch (error) {
    console.error('GET /api/stages error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// POST /api/stages - Créer une nouvelle étape
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role as string | null);
    const userId = user.id as string;

    const perm = requirePermission(userRole, 'stages', 'create');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const body = await request.json();
    const { name, description, order, duration, project_id } = body;

    // Validation
    if (!name || !project_id) {
      return corsResponse(
        { error: 'Le nom et le project_id sont requis' },
        request,
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur peut gérer le projet
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, manager_id')
      .eq('id', project_id)
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
        { error: 'Vous ne pouvez créer des étapes que sur vos projets' },
        request,
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('stages')
      .insert({
        name,
        description,
        order: order || 0,
        duration,
        project_id,
        status: 'PENDING',
        created_by_id: userId
      })
      .select(`
        *,
        created_by:users!created_by_id(name)
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la création de l\'étape' },
        request,
        { status: 500 }
      );
    }

    // Log de l'activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: '00000000-0000-0000-0000-000000000001', // TODO: Récupérer l'ID de l'utilisateur connecté
      action: 'create',
      entity_type: 'stage',
      entity_id: data.id,
      details: `Created stage: ${name}`
    });

    // Transform data to use names instead of IDs
    const transformedData = {
      ...data,
      created_by_name: data.created_by?.name || null
    };
    delete transformedData.created_by_id;
    delete transformedData.created_by;

    return corsResponse(transformedData, request, { status: 201 });
  } catch (error) {
    console.error('POST /api/stages error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
