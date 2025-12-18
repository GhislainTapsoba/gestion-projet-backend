import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/task-dependencies - Récupérer toutes les dépendances ou par tâche
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');

    let query = supabaseAdmin
      .from('task_dependencies')
      .select(`
        *,
        task:tasks!task_dependencies_task_id_fkey(id, title, status),
        depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)
      `)
      .order('created_at', { ascending: false });

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération des dépendances' },
        request,
        { status: 500 }
      );
    }

    return corsResponse(data || [], request);
  } catch (error) {
    console.error('GET /api/task-dependencies error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// POST /api/task-dependencies - Créer une nouvelle dépendance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation
    if (!body.task_id || !body.depends_on_task_id) {
      return corsResponse(
        { error: 'task_id et depends_on_task_id sont requis' },
        request,
        { status: 400 }
      );
    }

    // Vérifier que les deux tâches existent
    const { data: task1 } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('id', body.task_id)
      .single();

    const { data: task2 } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('id', body.depends_on_task_id)
      .single();

    if (!task1 || !task2) {
      return corsResponse(
        { error: 'Une ou les deux tâches n\'existent pas' },
        request,
        { status: 404 }
      );
    }

    // Vérifier qu'une tâche ne dépend pas d'elle-même
    if (body.task_id === body.depends_on_task_id) {
      return corsResponse(
        { error: 'Une tâche ne peut pas dépendre d\'elle-même' },
        request,
        { status: 400 }
      );
    }

    // Vérifier que la dépendance n'existe pas déjà
    const { data: existing } = await supabaseAdmin
      .from('task_dependencies')
      .select('id')
      .eq('task_id', body.task_id)
      .eq('depends_on_task_id', body.depends_on_task_id)
      .single();

    if (existing) {
      return corsResponse(
        { error: 'Cette dépendance existe déjà' },
        request,
        { status: 400 }
      );
    }

    // Créer la dépendance
    const { data, error } = await supabaseAdmin
      .from('task_dependencies')
      .insert({
        task_id: body.task_id,
        depends_on_task_id: body.depends_on_task_id,
        dependency_type: body.dependency_type || 'FINISH_TO_START',
      })
      .select(`
        *,
        task:tasks!task_dependencies_task_id_fkey(id, title, status),
        depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la création de la dépendance' },
        request,
        { status: 500 }
      );
    }

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: 1, // TODO: Get from auth
      action: 'create',
      entity_type: 'task_dependency',
      entity_id: data.id,
      details: `Created dependency: Task ${body.task_id} depends on Task ${body.depends_on_task_id}`,
      metadata: data,
    });

    return corsResponse(data, request, { status: 201 });
  } catch (error) {
    console.error('POST /api/task-dependencies error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// DELETE /api/task-dependencies/:id - Supprimer une dépendance
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return corsResponse(
        { error: 'ID de dépendance requis' },
        request,
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('task_dependencies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la suppression de la dépendance' },
        request,
        { status: 500 }
      );
    }

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: '00000000-0000-0000-0000-000000000001', // TODO: Get from auth
      action: 'delete',
      entity_type: 'task_dependency',
      entity_id: id.toString(),
      details: `Deleted task dependency ${id}`,
    });

    return corsResponse(
      { success: true, message: 'Dépendance supprimée avec succès' },
      request
    );
  } catch (error) {
    console.error('DELETE /api/task-dependencies error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
