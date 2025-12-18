import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Middleware pour vérifier l'authentification via JWT
 * Peut être utilisé dans les API routes
 */
export async function verifyAuth(request: NextRequest) {
    try {
        // Récupérer le token depuis le header Authorization
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.substring(7); // Enlever "Bearer "

        // Vérifier et décoder le token
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
        const { payload } = await jwtVerify(token, secret);

        if (!payload.sub) {
            return null;
        }

        return {
            id: payload.sub,
            email: payload.email as string,
            name: payload.name as string | null,
            role: payload.role as string,
        };
    } catch (error) {
        console.error('Error verifying auth:', error);
        return null;
    }
}
