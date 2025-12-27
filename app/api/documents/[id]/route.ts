import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/documents/[id] - Récupérer un document par ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        uploaded_by_user:users!documents_uploaded_by_fkey(id, name, email),
        project:projects(id, title),
        task:tasks(id, title)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return corsResponse({ error: 'Document non trouvé' }, request, { status: 404 });
      }
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération du document' },
        request,
        { status: 500 }
      );
    }

    // Transform data to use names instead of IDs
    const transformedData = {
      ...data,
      uploaded_by_name: data.uploaded_by_user?.name || null
    };
    delete transformedData.uploaded_by;
    delete transformedData.uploaded_by_user;

    return corsResponse(transformedData, request);
  } catch (error) {
    console.error('GET /api/documents/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// PATCH /api/documents/[id] - Mettre à jour un document
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;

    const { data, error } = await supabaseAdmin
      .from('documents')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        uploaded_by_user:users!documents_uploaded_by_fkey(id, name, email),
        project:projects(id, title),
        task:tasks(id, title)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return corsResponse({ error: 'Document non trouvé' }, request, { status: 404 });
      }
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la mise à jour du document' },
        request,
        { status: 500 }
      );
    }

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: '00000000-0000-0000-0000-000000000001', // TODO: Get from auth
      action: 'update',
      entity_type: 'document',
      entity_id: data.id.toString(),
      details: `Updated document: ${data.name}`,
      metadata: updateData,
    });

    return corsResponse(data, request);
  } catch (error) {
    console.error('PATCH /api/documents/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id] - Supprimer un document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get document info before deleting
    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('name')
      .eq('id', id)
      .single();

    const { error } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la suppression du document' },
        request,
        { status: 500 }
      );
    }

    // Log activity
    if (document) {
      await supabaseAdmin.from('activity_logs').insert({
        user_id: '00000000-0000-0000-0000-000000000001', // TODO: Get from auth
        action: 'delete',
        entity_type: 'document',
        entity_id: id,
        details: `Deleted document: ${document.name}`,
      });
    }

    return corsResponse(
      { success: true, message: 'Document supprimé avec succès' },
      request
    );
  } catch (error) {
    console.error('DELETE /api/documents/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
