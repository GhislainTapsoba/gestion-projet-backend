import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/emailService';
import { emailTemplates } from '@/lib/emailTemplates';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, dueDate, priority, status, assignedToId, projectId, stageId } = await request.json();

    const newTask = await prisma.task.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        status,
        assignedTo: assignedToId ? { connect: { id: parseInt(assignedToId) } } : undefined,
        project: { connect: { id: parseInt(projectId) } },
        stage: stageId ? { connect: { id: parseInt(stageId) } } : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        project: {
          select: { id: true, title: true }
        },
      }
    });

    if (newTask.assignedTo) {
      const { subject, html } = emailTemplates.taskAssigned(
        newTask,
        newTask.project,
        newTask.assignedTo
      );
      await sendEmail(newTask.assignedTo.email, subject, html);

      // Send to Project Manager and General Manager
      const projectManagerEmail = process.env.PROJECT_MANAGER_EMAIL;
      const generalManagerEmail = process.env.GENERAL_MANAGER_EMAIL;

      if (projectManagerEmail) {
        await sendEmail(projectManagerEmail, subject, html);
      }
      if (generalManagerEmail) {
        await sendEmail(generalManagerEmail, subject, html);
      }
    }

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
