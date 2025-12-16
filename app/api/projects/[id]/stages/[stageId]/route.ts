import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/emailService';
import { emailTemplates } from '@/lib/emailTemplates';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, order, duration, status, dependencyIds } = await request.json();

    // Fetch the original stage to compare its status
    const originalStage = await prisma.stage.findUnique({
      where: { id: parseInt(params.stageId) },
      include: {
        project: true, // Include project to get project details for the email
      },
    });

    const updatedStage = await prisma.stage.update({
      where: { id: parseInt(params.stageId) },
      data: {
        name,
        order,
        duration,
        status,
        dependencies: {
          set: dependencyIds?.map((id: string) => ({ id: parseInt(id) })) || []
        }
      },
      include: {
        dependencies: {
          select: { id: true, name: true }
        },
        project: true, // Include project to get project details for the email
      }
    });

    // Check if stage status has changed to 'completed' and send notification
    // Assuming 'completed' is a possible status value
    if (
      originalStage &&
      originalStage.status !== updatedStage.status &&
      (updatedStage.status === 'completed' || updatedStage.status === 'Completed' || updatedStage.status === 'validated') // Add other possible 'completed' statuses
    ) {
      const projectManagerEmail = process.env.PROJECT_MANAGER_EMAIL;
      const generalManagerEmail = process.env.GENERAL_MANAGER_EMAIL;

      if (projectManagerEmail || generalManagerEmail) {
        const { subject, html } = emailTemplates.stageCompleted(
          updatedStage,
          updatedStage.project,
          null // For now, we don't have explicit logic for the 'nextStage' here.
        );

        if (projectManagerEmail) {
          await sendEmail(projectManagerEmail, subject, html);
        }
        if (generalManagerEmail) {
          await sendEmail(generalManagerEmail, subject, html);
        }
      }
    }

    return NextResponse.json(updatedStage);
  } catch (error) {
    console.error('Update stage error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.stage.delete({
      where: { id: parseInt(params.stageId) }
    });

    return NextResponse.json({ message: 'Stage deleted successfully' });
  } catch (error) {
    console.error('Delete stage error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}