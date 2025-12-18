import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role } = await request.json();

    // Validation
    if (!email || !password) {
      return corsResponse(
        { error: 'Email et mot de passe requis' },
        request,
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return corsResponse(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        request,
        { status: 400 }
      );
    }

    // Vérifier si l'email existe déjà
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return corsResponse(
        { error: 'Cet email est déjà utilisé' },
        request,
        { status: 409 }
      );
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password: hashedPassword,
        name: name || null,
        role: role || 'EMPLOYEE'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Ne pas renvoyer le mot de passe au client
    const { password: _, ...userWithoutPassword } = newUser;

    return corsResponse(
      {
        success: true,
        user: userWithoutPassword
      },
      request,
      { status: 201 }
    );

  } catch (error) {
    console.error('Erreur registration:', error);
    return corsResponse(
      { error: 'Erreur lors de l\'inscription' },
      request,
      { status: 500 }
    );
  }
}
