import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { sendEmail } from '@/lib/emailService';
import { allStagesCompletedTemplate } from '@/lib/emailTemplates';
import { sendActionNotification } from '@/lib/notificationService';
import { mapDbRoleToUserRole } from '@/lib/permissions';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// POST /api/stages/[id]/complete - Marquer une étape comme terminée
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier l'authentification
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const { id } = await params;

    // 1. Récupérer l'étape
    const { data: stage, error: stageError } = await supabaseAdmin
      .from('stages')
      .select('*')
      .eq('id', id)
      .single();

    if (stageError || !stage) {
      console.error('Error fetching stage:', stageError);
      return corsResponse(
        { error: 'Étape introuvable' },
        request,
        { status: 404 }
      );
    }

    // 2. Vérifier si toutes les tâches de cette étape sont terminées
    const { data: tasksInStage } = await supabaseAdmin
      .from('tasks')
      .select('id, status')
      .eq('stage_id', id);

    const hasIncompleteTasks = tasksInStage?.some(
      task => task.status !== 'COMPLETED'
    );

    if (hasIncompleteTasks) {
      return corsResponse(
        {
          error: 'Toutes les tâches de cette étape doivent être terminées avant de valider l\'étape',
          incomplete_tasks: tasksInStage?.filter(t => t.status !== 'COMPLETED').length
        },
        request,
        { status: 400 }
      );
    }

    // 3. Marquer l'étape comme COMPLETED
    const { error: updateError } = await supabaseAdmin
      .from('stages')
      .update({
        status: 'COMPLETED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating stage:', updateError);
      return corsResponse(
        { error: 'Erreur lors de la validation de l\'étape' },
        request,
        { status: 500 }
      );
    }

    // 4. Récupérer les informations du projet
    const { data: projectInfo } = await supabaseAdmin
      .from('projects')
      .select('id, name, title, manager_id')
      .eq('id', stage.project_id)
      .single();

    const { data: managerInfo } = projectInfo?.manager_id
      ? await supabaseAdmin
          .from('users')
          .select('id, name, email, role')
          .eq('id', projectInfo.manager_id)
          .single()
      : { data: null };

    // Envoyer notification pour la complétion de l'étape
    await sendActionNotification({
      actionType: 'STAGE_COMPLETED',
      performedBy: {
        id: user.id,
        name: user.name || 'Utilisateur',
        email: user.email,
        role: user.role as 'ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE'
      },
      entity: {
        type: 'stage',
        id: id,
        data: { ...stage, status: 'COMPLETED' }
      },
      affectedUsers: managerInfo ? [managerInfo] : [],
      projectId: stage.project_id,
      metadata: {
        projectName: projectInfo?.title || projectInfo?.name || 'Projet',
        projectId: stage.project_id
      }
    });

    // 5. Vérifier si toutes les étapes du projet sont terminées
    const { data: allStages } = await supabaseAdmin
      .from('stages')
      .select('id, status, name')
      .eq('project_id', stage.project_id);

    const allStagesCompleted = allStages?.every(
      s => s.status === 'COMPLETED'
    );

    let projectManager = null;
    let project = null;

    if (allStagesCompleted) {
      // 6. Récupérer les informations du projet et du chef de projet
      const { data: projectData } = await supabaseAdmin
        .from('projects')
        .select('id, title, description, manager_id, created_by_id')
        .eq('id', stage.project_id)
        .single();

      project = projectData;

      if (project) {
        // Récupérer le chef de projet (manager ou créateur)
        const managerId = project.manager_id || project.created_by_id;

        if (managerId) {
          const { data: manager } = await supabaseAdmin
            .from('users')
            .select('id, name, email')
            .eq('id', managerId)
            .single();

          projectManager = manager;

          // 7. Envoyer notification que toutes les étapes sont terminées
          if (manager?.email) {
            // Créer une notification in-app
            await supabaseAdmin.from('notifications').insert({
              user_id: managerId,
              type: 'PROJECT_COMPLETED',
              title: 'Projet terminé',
              message: `Toutes les étapes du projet "${project.title}" ont été terminées`,
              metadata: {
                project_id: project.id,
                completed_by: user.id,
                stages_count: allStages?.length
              }
            });
          }
        }
      }
    }

    // 8. Activer la prochaine étape si elle existe
    const { data: nextStage } = await supabaseAdmin
      .from('stages')
      .select('*')
      .eq('project_id', stage.project_id)
      .eq('order', stage.order + 1)
      .single();

    if (nextStage && nextStage.status === 'PENDING') {
      await supabaseAdmin
        .from('stages')
        .update({
          status: 'IN_PROGRESS',
          updated_at: new Date().toISOString()
        })
        .eq('id', nextStage.id);
    }

    return corsResponse(
      {
        success: true,
        stage: { ...stage, status: 'COMPLETED' },
        all_stages_completed: allStagesCompleted,
        next_stage: nextStage,
        notification_sent: allStagesCompleted && !!projectManager,
        project_manager: projectManager
      },
      request
    );
  } catch (error) {
    console.error('POST /api/stages/[id]/complete error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
