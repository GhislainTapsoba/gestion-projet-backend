import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/emailService'; // Import sendEmail
import { emailTemplates } from '@/lib/emailTemplates'; // Import emailTemplates

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        stage: {
          select: { id: true, name: true }
        },
        project: {
          select: { id: true, title: true }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, dueDate, priority, status, assignedToId } = await request.json();

    // Fetch the original task to compare assignedToId
    const originalTask = await prisma.task.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        project: {
          select: { id: true, title: true }
        }
      }
    });

    const updatedTask = await prisma.task.update({
      where: { id: parseInt(params.id) },
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        status,
        assignedToId: assignedToId ? parseInt(assignedToId) : null
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        stage: {
          select: { id: true, name: true }
        },
        project: {
          select: { id: true, title: true }
        }
      }
    });

    // Check if assignedToId has changed and send notification
    if (originalTask && originalTask.assignedToId !== updatedTask.assignedToId && updatedTask.assignedTo) {
      const { subject, html } = emailTemplates.taskAssigned(
        updatedTask,
        updatedTask.project,
        updatedTask.assignedTo
      );
      await sendEmail(updatedTask.assignedTo.email, subject, html);

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

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.task.delete({
      where: { id: parseInt(params.id) }
    });

    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}