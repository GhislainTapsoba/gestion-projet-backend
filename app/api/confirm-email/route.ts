import { NextRequest, NextResponse } from 'next/server';
import { confirmToken, executeConfirmationAction } from '@/lib/emailConfirmation';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/confirm-email?token=xxx - Confirmer un email
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_FRONTEND_URL}/redirect?error=invalid_token`
      );
    }

    // Vérifier et confirmer le token
    const result = await confirmToken(token);

    if (!result.success) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_FRONTEND_URL}/redirect?error=${encodeURIComponent(result.error || 'unknown')}`
      );
    }

    // Exécuter l'action liée à la confirmation
    await executeConfirmationAction(result.data);

    // Rediriger vers la page /redirect qui force la déconnexion
    // puis redirige vers /login avec le message de confirmation
    // Cette approche garantit que l'employé est déconnecté avant de voir la page de login
    const message = encodeURIComponent('Confirmation réussie! Veuillez vous connecter pour accéder à vos informations.');
    const redirectUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/redirect?confirmed=true&message=${message}`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('GET /api/confirm-email error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_FRONTEND_URL}/?error=server_error`
    );
  }
}

