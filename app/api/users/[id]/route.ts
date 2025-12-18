import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import bcrypt from 'bcryptjs';
import { mapDbRoleToUserRole, requirePermission } from '@/lib/permissions';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/users/[id] - Récupérer un utilisateur par ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role as string | null);
    const perm = requirePermission(userRole, 'users', 'read');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return corsResponse({ error: 'Utilisateur non trouvé' }, request, { status: 404 });
      }
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération de l\'utilisateur' },
        request,
        { status: 500 }
      );
    }

    return corsResponse(data, request);
  } catch (error) {
    console.error('GET /api/users/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id] - Mettre à jour un utilisateur
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role as string | null);
    const perm = requirePermission(userRole, 'users', 'update');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Préparer les données de mise à jour
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.role !== undefined) {
      // Normaliser le rôle (frontend envoie 'admin', 'manager', 'user')
      let dbRole = body.role.toUpperCase();
      if (dbRole === 'ADMIN') dbRole = 'ADMIN';
      else if (dbRole === 'MANAGER') dbRole = 'PROJECT_MANAGER';
      else if (dbRole === 'USER') dbRole = 'EMPLOYEE';
      updateData.role = dbRole;
    }
    if (body.password !== undefined) {
      // Hash le nouveau mot de passe si fourni
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, name, email, role, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return corsResponse({ error: 'Utilisateur non trouvé' }, request, { status: 404 });
      }
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la mise à jour de l\'utilisateur' },
        request,
        { status: 500 }
      );
    }

    return corsResponse(data, request);
  } catch (error) {
    console.error('PATCH /api/users/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Supprimer un utilisateur
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role as string | null);
    const perm = requirePermission(userRole, 'users', 'delete');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;
    
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la suppression de l\'utilisateur' },
        request,
        { status: 500 }
      );
    }

    return corsResponse({ success: true, message: 'Utilisateur supprimé avec succès' }, request);
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
