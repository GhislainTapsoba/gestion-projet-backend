import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/settings - Récupérer les paramètres de l'utilisateur
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    // Récupérer les settings
    const { data: settings, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // Si pas de settings, créer des settings par défaut
      if (error.code === 'PGRST116') {
        const { data: newSettings, error: createError } = await supabaseAdmin
          .from('user_settings')
          .insert({
            user_id: user.id,
            language: 'fr',
            timezone: 'Europe/Paris',
            notifications_enabled: true,
            email_notifications: true,
            theme: 'light',
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating settings:', createError);
          return corsResponse(
            { error: 'Erreur lors de la création des paramètres' },
            request,
            { status: 500 }
          );
        }

        return corsResponse(newSettings, request);
      }

      console.error('Error fetching settings:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération des paramètres' },
        request,
        { status: 500 }
      );
    }

    return corsResponse(settings, request);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// PUT /api/settings - Mettre à jour les paramètres de l'utilisateur
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const body = await request.json();
    const {
      language,
      timezone,
      notifications_enabled,
      email_notifications,
      theme,
      date_format,
      items_per_page,
      font_size,
      compact_mode,
    } = body;

    // Vérifier que au moins un champ est fourni
    if (
      language === undefined &&
      timezone === undefined &&
      notifications_enabled === undefined &&
      email_notifications === undefined &&
      theme === undefined &&
      date_format === undefined &&
      items_per_page === undefined &&
      font_size === undefined &&
      compact_mode === undefined
    ) {
      return corsResponse(
        { error: 'Au moins un paramètre doit être fourni' },
        request,
        { status: 400 }
      );
    }

    // Construire l'objet de mise à jour
    const updateData: any = {};
    if (language !== undefined) updateData.language = language;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (notifications_enabled !== undefined) updateData.notifications_enabled = notifications_enabled;
    if (email_notifications !== undefined) updateData.email_notifications = email_notifications;
    if (theme !== undefined) updateData.theme = theme;
    if (date_format !== undefined) updateData.date_format = date_format;
    if (items_per_page !== undefined) updateData.items_per_page = items_per_page;
    if (font_size !== undefined) updateData.font_size = font_size;
    if (compact_mode !== undefined) updateData.compact_mode = compact_mode;

    // Mettre à jour les settings
    const { data: settings, error } = await supabaseAdmin
      .from('user_settings')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      return corsResponse(
        { error: 'Erreur lors de la mise à jour des paramètres' },
        request,
        { status: 500 }
      );
    }

    // Log de l'activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'update',
      entity_type: 'settings',
      entity_id: settings.id,
      details: 'Paramètres mis à jour',
      metadata: updateData,
    });

    return corsResponse(settings, request);
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
