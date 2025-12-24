import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'

/**
 * GET /api/leads/[id]/sequences
 * Get all active sequences for a lead
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const contactId = params.id

    // Verify contact belongs to tenant
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId: tenantId,
      },
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Get all enrollments
    const enrollments = await prisma.nurtureEnrollment.findMany({
      where: {
        contactId,
        tenantId: tenantId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    })

    return NextResponse.json({
      sequences: enrollments.map((enrollment) => ({
        id: enrollment.id,
        template: enrollment.template,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        completedSteps: enrollment.completedSteps,
        totalSteps: enrollment.totalSteps,
        progress: enrollment.totalSteps > 0
          ? Math.round((enrollment.completedSteps / enrollment.totalSteps) * 100)
          : 0,
      })),
    })
  } catch (error) {
    console.error('Get sequences error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get sequences',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
