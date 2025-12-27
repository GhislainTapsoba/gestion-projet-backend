import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/documents - Récupérer tous les documents ou par projet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const taskId = searchParams.get('task_id');

    let query = supabaseAdmin
      .from('documents')
      .select(`
        *,
        uploaded_by_user:users!documents_uploaded_by_fkey(id, name, email),
        project:projects(id, title),
        task:tasks(id, title)
      `)
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération des documents' },
        request,
        { status: 500 }
      );
    }

    // Transform data to use names instead of IDs
    const transformedData = data?.map(doc => ({
      ...doc,
      uploaded_by_name: doc.uploaded_by_user?.name || null
    }));
    transformedData?.forEach(doc => {
      delete doc.uploaded_by;
      delete doc.uploaded_by_user;
    });

    return corsResponse(transformedData || [], request);
  } catch (error) {
    console.error('GET /api/documents error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// POST /api/documents - Créer un nouveau document
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation
    if (!body.name || !body.file_url) {
      return corsResponse(
        { error: 'Le nom et l\'URL du fichier sont requis' },
        request,
        { status: 400 }
      );
    }

    if (!body.project_id && !body.task_id) {
      return corsResponse(
        { error: 'project_id ou task_id est requis' },
        request,
        { status: 400 }
      );
    }

    // Créer le document
    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        name: body.name,
        file_url: body.file_url,
        file_type: body.file_type || null,
        file_size: body.file_size || null,
        description: body.description || null,
        project_id: body.project_id || null,
        task_id: body.task_id || null,
        uploaded_by: body.uploaded_by || null,
      })
      .select(`
        *,
        uploaded_by_user:users!documents_uploaded_by_fkey(id, name, email),
        project:projects(id, title),
        task:tasks(id, title)
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la création du document' },
        request,
        { status: 500 }
      );
    }

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: body.uploaded_by || 1,
      action: 'create',
      entity_type: 'document',
      entity_id: data.id,
      details: `Uploaded document: ${data.name}`,
      metadata: {
        document_name: data.name,
        project_id: data.project_id,
        task_id: data.task_id,
      },
    });

    return corsResponse(data, request, { status: 201 });
  } catch (error) {
    console.error('POST /api/documents error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
