import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import bcrypt from 'bcryptjs';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// PUT /api/users/[id]/password - Changer le mot de passe
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const { id } = await params;

    // Un utilisateur ne peut changer que son propre mot de passe
    // (sauf si c'est un ADMIN qui peut changer n'importe quel mot de passe)
    if (user.id !== id && user.role !== 'ADMIN') {
      return corsResponse(
        { error: 'Vous ne pouvez changer que votre propre mot de passe' },
        request,
        { status: 403 }
      );
    }

    const body = await request.json();
    const { current_password, new_password } = body;

    // Validation
    if (!new_password || new_password.length < 8) {
      return corsResponse(
        { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' },
        request,
        { status: 400 }
      );
    }

    // Si l'utilisateur change son propre mot de passe, vérifier le mot de passe actuel
    if (user.id === id) {
      if (!current_password) {
        return corsResponse(
          { error: 'Le mot de passe actuel est requis' },
          request,
          { status: 400 }
        );
      }

      // Récupérer le mot de passe actuel haché
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('password')
        .eq('id', id)
        .single();

      if (userError || !userData) {
        return corsResponse(
          { error: 'Utilisateur non trouvé' },
          request,
          { status: 404 }
        );
      }

      // Vérifier le mot de passe actuel
      const isValidPassword = await bcrypt.compare(
        current_password,
        userData.password
      );

      if (!isValidPassword) {
        return corsResponse(
          { error: 'Mot de passe actuel incorrect' },
          request,
          { status: 401 }
        );
      }
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return corsResponse(
        { error: 'Erreur lors de la mise à jour du mot de passe' },
        request,
        { status: 500 }
      );
    }

    // Log de l'activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'update',
      entity_type: 'user_password',
      entity_id: id,
      details:
        user.id === id
          ? 'Mot de passe changé'
          : `Mot de passe changé par l'administrateur ${user.name}`,
    });

    return corsResponse(
      {
        success: true,
        message: 'Mot de passe mis à jour avec succès',
      },
      request
    );
  } catch (error) {
    console.error('PUT /api/users/[id]/password error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
