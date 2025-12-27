import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/dashboard/stats - Récupérer les statistiques du dashboard
export async function GET(request: NextRequest) {
  try {
    // Récupérer les counts en parallèle
    const [
      { count: projectsCount },
      { count: tasksCount },
      { count: completedTasksCount },
      { count: usersCount },
    ] = await Promise.all([
      supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('tasks').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    ]);

    // Récupérer les projets récents
    const { data: recentProjectsData } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        manager:users!manager_id(name),
        created_by:users!created_by_id(name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    // Transform recent projects
    const recentProjects = recentProjectsData?.map(project => ({
      ...project,
      manager_name: project.manager?.name || null,
      created_by_name: project.created_by?.name || null
    }));
    recentProjects?.forEach(project => {
      delete project.manager_id;
      delete project.created_by_id;
      delete project.manager;
      delete project.created_by;
    });

    // Récupérer les tâches récentes
    const { data: recentTasksData } = await supabaseAdmin
      .from('tasks')
      .select(`
        *,
        assigned_to:users!assigned_to_id(name),
        created_by:users!created_by_id(name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    // Transform recent tasks
    const recentTasks = recentTasksData?.map(task => ({
      ...task,
      assigned_to_name: task.assigned_to?.name || null,
      created_by_name: task.created_by?.name || null
    }));
    recentTasks?.forEach(task => {
      delete task.assigned_to_id;
      delete task.created_by_id;
      delete task.assigned_to;
      delete task.created_by;
    });

    // Récupérer les tâches par statut
    const { data: tasksByStatus } = await supabaseAdmin
      .from('tasks')
      .select('status');

    const statusCounts = {
      TODO: tasksByStatus?.filter(t => t.status === 'TODO').length || 0,
      IN_PROGRESS: tasksByStatus?.filter(t => t.status === 'IN_PROGRESS').length || 0,
      IN_REVIEW: tasksByStatus?.filter(t => t.status === 'IN_REVIEW').length || 0,
      COMPLETED: tasksByStatus?.filter(t => t.status === 'COMPLETED').length || 0,
      CANCELLED: tasksByStatus?.filter(t => t.status === 'CANCELLED').length || 0,
    };

    // Récupérer les projets par statut
    const { data: projectsByStatus } = await supabaseAdmin
      .from('projects')
      .select('status');

    const projectStatusCounts = {
      PLANNING: projectsByStatus?.filter(p => p.status === 'PLANNING').length || 0,
      IN_PROGRESS: projectsByStatus?.filter(p => p.status === 'IN_PROGRESS').length || 0,
      ON_HOLD: projectsByStatus?.filter(p => p.status === 'ON_HOLD').length || 0,
      COMPLETED: projectsByStatus?.filter(p => p.status === 'COMPLETED').length || 0,
      CANCELLED: projectsByStatus?.filter(p => p.status === 'CANCELLED').length || 0,
    };

    const stats = {
      counts: {
        projects: projectsCount || 0,
        tasks: tasksCount || 0,
        completedTasks: completedTasksCount || 0,
        users: usersCount || 0,
      },
      tasksByStatus: statusCounts,
      projectsByStatus: projectStatusCounts,
      recentProjects: recentProjects || [],
      recentTasks: recentTasks || [],
    };

    return corsResponse(stats, request);
  } catch (error) {
    console.error('GET /api/dashboard/stats error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
