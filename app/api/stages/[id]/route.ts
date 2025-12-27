import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';
import { stageStatusChangedByEmployeeTemplate } from '@/lib/emailTemplates';
import { sendEmail } from '@/lib/emailService';
import { mapDbRoleToUserRole, requirePermission, canManageProject } from '@/lib/permissions';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// GET /api/stages/[id] - Récupérer une étape par ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role ?? null);
    const perm = requirePermission(userRole, 'stages', 'read');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('stages')
      .select(`
        *,
        created_by:users!created_by_id(name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return corsResponse(
        { error: 'Étape non trouvée' },
        request,
        { status: 404 }
      );
    }

    // Si non-ADMIN, vérifier l'accès au projet de l'étape
    if (userRole !== 'admin') {
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('created_by_id, manager_id')
        .eq('id', data.project_id)
        .single();

      if (project) {
        const hasAccess = project.created_by_id === user.id || project.manager_id === user.id;

        if (!hasAccess) {
          // Vérifier si l'utilisateur est membre du projet
          const { data: membership } = await supabaseAdmin
            .from('project_members')
            .select('id')
            .eq('project_id', data.project_id)
            .eq('user_id', user.id)
            .single();

          if (!membership) {
            return corsResponse(
              { error: 'Vous n\'avez pas accès à cette étape' },
              request,
              { status: 403 }
            );
          }
        }
      }
    }

    // Transform data to use names instead of IDs
    const transformedData = {
      ...data,
      created_by_name: data.created_by?.name || null
    };
    delete transformedData.created_by_id;
    delete transformedData.created_by;

    return corsResponse(transformedData, request);
  } catch (error) {
    console.error('GET /api/stages/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// PATCH /api/stages/[id] - Mettre à jour une étape
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role ?? null);
    const userId = user.id as string;

    const perm = requirePermission(userRole, 'stages', 'update');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Récupérer l'étape avant modification
    const { data: oldStage } = await supabaseAdmin
      .from('stages')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldStage) {
      return corsResponse({ error: 'Étape non trouvée' }, request, { status: 404 });
    }

    // Récupérer le projet pour vérifier les droits
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, title, manager_id, created_by_id')
      .eq('id', oldStage.project_id)
      .single();

    if (!project) {
      return corsResponse({ error: 'Projet associé introuvable' }, request, { status: 404 });
    }

    // Vérifier si l'utilisateur peut éditer cette étape
    const hasProjectAccess = userRole === 'admin' ||
                             project.manager_id === userId ||
                             project.created_by_id === userId;

    if (!hasProjectAccess && userRole === 'user') {
      // Vérifier si membre du projet
      const { data: membership } = await supabaseAdmin
        .from('project_members')
        .select('id')
        .eq('project_id', oldStage.project_id)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        return corsResponse(
          { error: 'Vous ne pouvez modifier que les étapes des projets auxquels vous avez accès' },
          request,
          { status: 403 }
        );
      }
    } else if (!hasProjectAccess) {
      return corsResponse(
        { error: 'Vous ne pouvez modifier que les étapes de vos propres projets' },
        request,
        { status: 403 }
      );
    }

    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.duration !== undefined) updateData.duration = body.duration;
    if (body.status !== undefined) updateData.status = body.status;

    const { data, error } = await supabaseAdmin
      .from('stages')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        created_by:users!created_by_id(name)
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la mise à jour de l\'étape' },
        request,
        { status: 500 }
      );
    }

    // Log de l'activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      action: 'update',
      entity_type: 'stage',
      entity_id: id,
      details: `Mise à jour de l'étape: ${data.name}`,
      metadata: { changes: updateData }
    });

    // Si un employé change le statut → envoyer email au chef de projet et admin
    const hasStatusChange = !!(body.status && oldStage.status !== body.status);

    if (hasStatusChange && userRole === 'user') {
      try {
        const { data: currentUser } = await supabaseAdmin
          .from('users')
          .select('name, email')
          .eq('id', userId)
          .single();

        const recipients: { email: string; name: string }[] = [];

        // Ajouter le chef de projet
        if (project.manager_id) {
          const { data: manager } = await supabaseAdmin
            .from('users')
            .select('name, email')
            .eq('id', project.manager_id)
            .single();

          if (manager && manager.email) {
            recipients.push({ email: manager.email, name: manager.name || 'Chef de projet' });
          }
        }

        // Ajouter tous les admins
        const { data: admins } = await supabaseAdmin
          .from('users')
          .select('name, email')
          .eq('role', 'ADMIN');

        if (admins && admins.length > 0) {
          admins.forEach(admin => {
            if (admin.email && !recipients.find(r => r.email === admin.email)) {
              recipients.push({ email: admin.email, name: admin.name || 'Admin' });
            }
          });
        }

        // Envoyer l'email à tous les destinataires
        if (recipients.length > 0) {
          const emailHtml = stageStatusChangedByEmployeeTemplate({
            employeeName: currentUser?.name || 'Employé',
            stageName: data.name,
            stageId: data.id,
            projectTitle: project.title,
            projectId: data.project_id,
            oldStatus: oldStage.status,
            newStatus: body.status,
            comment: body.comment
          });

          for (const recipient of recipients) {
            await sendEmail({
              to: recipient.email,
              subject: `Changement de statut - ${data.name}`,
              html: emailHtml,
              metadata: {
                stage_id: data.id,
                project_id: data.project_id,
                action: 'stage_status_changed_by_employee',
                old_status: oldStage.status,
                new_status: body.status
              }
            });
          }
        }
      } catch (emailError) {
        console.error('Error sending stage status change email:', emailError);
        // Ne pas bloquer la mise à jour si l'email échoue
      }
    }

    // Transform data to use names instead of IDs
    const transformedData = {
      ...data,
      created_by_name: data.created_by?.name || null
    };
    delete transformedData.created_by_id;
    delete transformedData.created_by;

    return corsResponse(transformedData, request);
  } catch (error) {
    console.error('PATCH /api/stages/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}

// DELETE /api/stages/[id] - Supprimer une étape
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    const userRole = mapDbRoleToUserRole(user.role ?? null);
    const userId = user.id as string;

    const perm = requirePermission(userRole, 'stages', 'delete');
    if (!perm.allowed) {
      return corsResponse({ error: perm.error }, request, { status: 403 });
    }

    const { id } = await params;

    // Récupérer l'étape avant suppression pour le log
    const { data: stage } = await supabaseAdmin
      .from('stages')
      .select('name, project_id')
      .eq('id', id)
      .single();

    if (!stage) {
      return corsResponse({ error: 'Étape non trouvée' }, request, { status: 404 });
    }

    // Récupérer le projet pour vérifier les droits
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, manager_id, created_by_id')
      .eq('id', stage.project_id)
      .single();

    if (!project) {
      return corsResponse({ error: 'Projet associé introuvable' }, request, { status: 404 });
    }

    if (!canManageProject(userRole, userId, project.manager_id) && project.created_by_id !== userId) {
      return corsResponse(
        { error: 'Vous ne pouvez supprimer que les étapes de vos propres projets' },
        request,
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from('stages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        { error: 'Erreur lors de la suppression de l\'étape' },
        request,
        { status: 500 }
      );
    }

    // Log de l'activité
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      action: 'delete',
      entity_type: 'stage',
      entity_id: id,
      details: `Suppression de l'étape: ${stage.name}`
    });

    return corsResponse({ success: true }, request);
  } catch (error) {
    console.error('DELETE /api/stages/[id] error:', error);
    return corsResponse(
      { error: 'Erreur serveur' },
      request,
      { status: 500 }
    );
  }
}
