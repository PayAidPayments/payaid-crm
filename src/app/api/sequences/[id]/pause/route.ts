import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'

/**
 * PUT /api/sequences/[id]/pause
 * Pause or resume a nurture sequence
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const enrollmentId = params.id
    const body = await request.json()
    const action = body.action // 'pause' or 'resume'

    // Verify enrollment belongs to tenant
    const enrollment = await prisma.nurtureEnrollment.findFirst({
      where: {
        id: enrollmentId,
        tenantId: tenantId,
      },
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: 'Sequence enrollment not found' },
        { status: 404 }
      )
    }

    // Update status
    const newStatus = action === 'pause' ? 'PAUSED' : 'ACTIVE'
    const updated = await prisma.nurtureEnrollment.update({
      where: { id: enrollmentId },
      data: { status: newStatus },
    })

    return NextResponse.json({
      success: true,
      enrollment: {
        id: updated.id,
        status: updated.status,
      },
    })
  } catch (error) {
    console.error('Pause sequence error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update sequence status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
