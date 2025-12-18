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

// GET /api/users - Récupérer tous les utilisateurs
// Query params: ?role=PROJECT_MANAGER pour filtrer par rôle
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    let query = supabaseAdmin
      .from('users')
      .select('id, name, email, role, created_at, updated_at');

    // Filtrer par rôle si spécifié
    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération des utilisateurs' },
        request,
        { status: 500 }
      );
    }

    return corsResponse(data || [], request);
  } catch (error) {
    console.error('GET /api/users error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// POST /api/users - Créer un nouvel utilisateur (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role as string | null);
    const perm = requirePermission(userRole, 'users', 'create');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const body = await request.json();

    // Validation
    if (!body.name || !body.email || !body.password || !body.role) {
      return corsResponse(
        { error: 'Nom, email, mot de passe et rôle sont requis' },
        request,
        { status: 400 }
      );
    }

    // Vérifier si l'email existe déjà
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', body.email)
      .single();

    if (existingUser) {
      return corsResponse(
        { error: 'Cet email est déjà utilisé' },
        request,
        { status: 400 }
      );
    }

    // Hash le mot de passe
    const hashedPassword = await bcrypt.hash(body.password, 10);

    // Normaliser le rôle (frontend envoie 'admin', 'manager', 'user')
    let dbRole = body.role.toUpperCase();
    if (dbRole === 'ADMIN') dbRole = 'ADMIN';
    else if (dbRole === 'MANAGER') dbRole = 'PROJECT_MANAGER';
    else if (dbRole === 'USER') dbRole = 'EMPLOYEE';

    // Créer l'utilisateur
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: dbRole,
      })
      .select('id, name, email, role, created_at, updated_at')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la création de l\'utilisateur' },
        request,
        { status: 500 }
      );
    }

    return corsResponse(data, request, { status: 201 });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
