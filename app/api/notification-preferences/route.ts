import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/notification-preferences - Récupérer les préférences de notifications
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    // Récupérer les préférences de notifications
    const { data: preferences, error } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // Si pas de préférences, créer des préférences par défaut
      if (error.code === 'PGRST116') {
        const { data: newPreferences, error: createError } = await supabaseAdmin
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            email_task_assigned: true,
            email_task_updated: true,
            email_task_due: true,
            email_stage_completed: false,
            email_project_created: true,
            push_notifications: true,
            daily_summary: false,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating notification preferences:', createError);
          return corsResponse(
            { error: 'Erreur lors de la création des préférences de notifications' },
            request,
            { status: 500 }
          );
        }

        return corsResponse(newPreferences, request);
      }

      console.error('Error fetching notification preferences:', error);
      return corsResponse(
        { error: 'Erreur lors de la récupération des préférences de notifications' },
        request,
        { status: 500 }
      );
    }

    return corsResponse(preferences, request);
  } catch (error) {
    console.error('GET /api/notification-preferences error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// PUT /api/notification-preferences - Mettre à jour les préférences de notifications
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const body = await request.json();
    const {
      email_task_assigned,
      email_task_updated,
      email_task_due,
      email_stage_completed,
      email_project_created,
      push_notifications,
      daily_summary,
    } = body;

    // Vérifier que au moins un champ est fourni
    if (
      email_task_assigned === undefined &&
      email_task_updated === undefined &&
      email_task_due === undefined &&
      email_stage_completed === undefined &&
      email_project_created === undefined &&
      push_notifications === undefined &&
      daily_summary === undefined
    ) {
      return corsResponse(
        { error: 'Au moins une préférence doit être fournie' },
        request,
        { status: 400 }
      );
    }

    // Construire l'objet de mise à jour
    const updateData: any = {};
    if (email_task_assigned !== undefined) updateData.email_task_assigned = email_task_assigned;
    if (email_task_updated !== undefined) updateData.email_task_updated = email_task_updated;
    if (email_task_due !== undefined) updateData.email_task_due = email_task_due;
    if (email_stage_completed !== undefined) updateData.email_stage_completed = email_stage_completed;
    if (email_project_created !== undefined) updateData.email_project_created = email_project_created;
    if (push_notifications !== undefined) updateData.push_notifications = push_notifications;
    if (daily_summary !== undefined) updateData.daily_summary = daily_summary;

    // Mettre à jour les préférences
    const { data: preferences, error } = await supabaseAdmin
      .from('notification_preferences')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating notification preferences:', error);
      return corsResponse(
        { error: 'Erreur lors de la mise à jour des préférences de notifications' },
        request,
        { status: 500 }
      );
    }

    // Log de l'activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'update',
      entity_type: 'notification_preferences',
      entity_id: preferences.id,
      details: 'Préférences de notifications mises à jour',
      metadata: updateData,
    });

    return corsResponse(preferences, request);
  } catch (error) {
    console.error('PUT /api/notification-preferences error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
