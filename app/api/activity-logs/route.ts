import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { mapDbRoleToUserRole, requirePermission } from '@/lib/permissions';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/activity-logs - Récupérer tous les logs d'activité
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role as string | null);
    const perm = requirePermission(userRole, 'activity-logs', 'read');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get('entity_type');
    const entity_id = searchParams.get('entity_id');
    const user_id = searchParams.get('user_id');
    const limit = searchParams.get('limit') || '50';

    let query = supabaseAdmin
      .from('activity_logs')
      .select(`
        *,
        user:users(id, name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (entity_type) {
      query = query.eq('entity_type', entity_type);
    }

    if (entity_id) {
      query = query.eq('entity_id', entity_id);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération des logs' },
        request,
        { status: 500 }
      );
    }

    // Transform data to use names instead of IDs
    const transformedData = data?.map(log => ({
      ...log,
      user_name: log.user?.name || null
    }));
    transformedData?.forEach(log => {
      delete log.user_id;
      delete log.user;
    });

    return corsResponse(transformedData || [], request);
  } catch (error) {
    console.error('GET /api/activity-logs error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
