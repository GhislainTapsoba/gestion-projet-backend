import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { SignJWT } from 'jose';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
    return handleCorsOptions(request);
}

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        // Validation
        if (!email || !password) {
            return corsResponse(
                { error: 'Email et mot de passe requis' },
                request,
                { status: 400 }
            );
        }

        // Récupérer l'utilisateur
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return corsResponse(
                { error: 'Email ou mot de passe incorrect' },
                request,
                { status: 401 }
            );
        }

        // Vérifier le mot de passe
        if (!user.password) {
            return corsResponse(
                { error: 'Mot de passe non configuré pour cet utilisateur' },
                request,
                { status: 401 }
            );
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return corsResponse(
                { error: 'Email ou mot de passe incorrect' },
                request,
                { status: 401 }
            );
        }

        // Ne pas renvoyer le mot de passe au client
        const { password: _, ...userWithoutPassword } = user;

        // Créer un JWT token
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
        const token = await new SignJWT({
            sub: user.id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('30d')
            .sign(secret);

        return corsResponse(
            {
                success: true,
                user: userWithoutPassword,
                token: token,
            },
            request,
            { status: 200 }
        );

    } catch (error) {
        console.error('Erreur login:', error);
        return corsResponse(
            { error: 'Erreur lors de la connexion' },
            request,
            { status: 500 }
        );
    }
}
