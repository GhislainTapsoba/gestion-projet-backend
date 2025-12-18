import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/profile - Récupérer le profil de l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    // Récupérer toutes les informations du profil utilisateur
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return corsResponse(
        { error: 'Erreur lors de la récupération du profil' },
        request,
        { status: 500 }
      );
    }

    return corsResponse(userData, request);
  } catch (error) {
    console.error('GET /api/profile error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// PUT /api/profile - Mettre à jour le profil de l'utilisateur connecté
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const body = await request.json();
    const { name, email } = body;

    // Validation
    if (!name && !email) {
      return corsResponse(
        { error: 'Au moins un champ (name ou email) doit être fourni' },
        request,
        { status: 400 }
      );
    }

    if (email) {
      // Valider le format email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return corsResponse(
          { error: 'Format d\'email invalide' },
          request,
          { status: 400 }
        );
      }

      // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', user.id)
        .single();

      if (existingUser) {
        return corsResponse(
          { error: 'Cet email est déjà utilisé par un autre utilisateur' },
          request,
          { status: 409 }
        );
      }
    }

    // Construire l'objet de mise à jour
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    // Mettre à jour le profil
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select('id, name, email, role, created_at, updated_at')
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return corsResponse(
        { error: 'Erreur lors de la mise à jour du profil' },
        request,
        { status: 500 }
      );
    }

    // Log de l'activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'update',
      entity_type: 'user_profile',
      entity_id: user.id,
      details: 'Profil mis à jour',
      metadata: updateData,
    });

    return corsResponse(updatedUser, request);
  } catch (error) {
    console.error('PUT /api/profile error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
