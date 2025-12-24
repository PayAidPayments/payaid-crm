import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'

/**
 * DELETE /api/sequences/[id]
 * Stop/cancel a nurture sequence
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const enrollmentId = params.id

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

    // Cancel all pending scheduled emails for this enrollment
    await prisma.scheduledEmail.updateMany({
      where: {
        contactId: enrollment.contactId,
        status: 'PENDING',
        tenantId: tenantId,
      },
      data: {
        status: 'FAILED', // Mark as failed/cancelled
      },
    })

    // Update enrollment status
    await prisma.nurtureEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'CANCELLED' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Stop sequence error:', error)
    return NextResponse.json(
      {
        error: 'Failed to stop sequence',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
