import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'
import { z } from 'zod'

const setLeaveSchema = z.object({
  isOnLeave: z.boolean(),
  leaveEndDate: z.string().datetime().optional(),
})

/**
 * PUT /api/sales-reps/[id]/set-leave
 * Mark a sales rep as on leave or return from leave
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const repId = params.id
    const body = await request.json()
    const { isOnLeave, leaveEndDate } = setLeaveSchema.parse(body)

    // Verify rep belongs to tenant
    const rep = await prisma.salesRep.findFirst({
      where: {
        id: repId,
        tenantId: tenantId,
      },
    })

    if (!rep) {
      return NextResponse.json(
        { error: 'Sales rep not found' },
        { status: 404 }
      )
    }

    // Update leave status
    const updatedRep = await prisma.salesRep.update({
      where: { id: repId },
      data: {
        isOnLeave,
        leaveEndDate: leaveEndDate ? new Date(leaveEndDate) : null,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      rep: {
        id: updatedRep.id,
        name: updatedRep.user.name,
        isOnLeave: updatedRep.isOnLeave,
        leaveEndDate: updatedRep.leaveEndDate,
      },
    })
  } catch (error) {
    console.error('Set leave status error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update leave status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
