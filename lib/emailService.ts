import { supabaseAdmin } from './supabase';

// Configuration Mailjet
if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
  console.warn('MAILJET credentials not found, emails will not be sent');
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  userId?: number;
  metadata?: any;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Vérifier si Mailjet est configuré
    if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
      console.log(`Email disabled - would send to: ${options.to}`);
      return false;
    }

    // Créer un log avant l'envoi
    const { data: emailLog } = await supabaseAdmin
      .from('email_logs')
      .insert({
        recipient_id: options.userId || null,
        recipient: options.to,
        subject: options.subject,
        body: options.html,
        status: 'PENDING',
        metadata: options.metadata
      })
      .select()
      .single();

    // Envoyer l'email avec Mailjet
    const auth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`).toString('base64');
    
    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [{
          From: {
            Email: process.env.MAIL_FROM_EMAIL || 'no-reply@tdrprojects.com',
            Name: process.env.MAIL_FROM_NAME || 'TDR Projects'
          },
          To: [{
            Email: options.to
          }],
          Subject: options.subject,
          HTMLPart: options.html
        }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mailjet API error: ${response.status} - ${errorText}`);
    }

    // Mettre à jour le statut du log
    if (emailLog) {
      await supabaseAdmin
        .from('email_logs')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString()
        })
        .eq('id', emailLog.id);
    }

    console.log('Email sent via Mailjet');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);

    // Mettre à jour le log avec l'erreur
    if (options.metadata?.log_id) {
      await supabaseAdmin
        .from('email_logs')
        .update({
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', options.metadata.log_id);
    }

    return false;
  }
}

// Envoyer un email aux responsables (Chef de projet + Responsable général)
export async function sendEmailToResponsibles(
  projectId: number,
  subject: string,
  html: string,
  metadata?: any
): Promise<void> {
  try {
    // Récupérer le chef de projet
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        created_by:users!projects_created_by_id_fkey(id, email, name, role)
      `)
      .eq('id', projectId)
      .single();

    if (!project) {
      console.error('Project not found');
      return;
    }

    // Récupérer le responsable général (Admin)
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('role', 'ADMIN')
      .limit(1);

    const recipients: Array<{ id: number; email: string; name: string }> = [];

    // Ajouter le créateur du projet (souvent le chef de projet)
    if (project.created_by && project.created_by.email) {
      recipients.push({
        id: project.created_by.id,
        email: project.created_by.email,
        name: project.created_by.name || 'Chef de projet'
      });
    }

    // Ajouter le responsable général
    if (admins && admins.length > 0) {
      const admin = admins[0];
      // Éviter les doublons
      if (!recipients.find(r => r.email === admin.email)) {
        recipients.push({
          id: admin.id,
          email: admin.email,
          name: admin.name || 'Responsable général'
        });
      }
    }

    // Envoyer l'email à tous les destinataires
    for (const recipient of recipients) {
      await sendEmail({
        to: recipient.email,
        subject,
        html,
        userId: recipient.id,
        metadata: { ...metadata, project_id: projectId }
      });
    }
  } catch (error) {
    console.error('Error sending emails to responsibles:', error);
  }
}
