import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'
import { z } from 'zod'
import { updateRepConversionRate } from '@/lib/sales-automation/lead-allocation'

const updateSalesRepSchema = z.object({
  specialization: z.string().optional(),
  conversionRate: z.number().min(0).max(1).optional(),
})

// GET /api/sales-reps/[id] - Get a single sales rep
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const rep = await prisma.salesRep.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedLeads: {
          select: {
            id: true,
            name: true,
            company: true,
            leadScore: true,
          },
          orderBy: {
            leadScore: 'desc',
          },
          take: 10,
        },
        deals: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        _count: {
          select: {
            assignedLeads: true,
            deals: true,
          },
        },
      },
    })

    if (!rep) {
      return NextResponse.json(
        { error: 'Sales rep not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: rep.id,
      userId: rep.userId,
      name: rep.user.name,
      email: rep.user.email,
      specialization: rep.specialization,
      conversionRate: rep.conversionRate,
      isOnLeave: rep.isOnLeave,
      leaveEndDate: rep.leaveEndDate,
      assignedLeads: rep.assignedLeads,
      recentDeals: rep.deals,
      stats: {
        assignedLeadsCount: rep._count.assignedLeads,
        dealsCount: rep._count.deals,
      },
      createdAt: rep.createdAt,
    })
  } catch (error) {
    console.error('Get sales rep error:', error)
    return NextResponse.json(
      { error: 'Failed to get sales rep' },
      { status: 500 }
    )
  }
}

// PATCH /api/sales-reps/[id] - Update a sales rep
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    // Only admins/owners can update sales reps
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update sales reps' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = updateSalesRepSchema.parse(body)

    // Verify rep belongs to tenant
    const rep = await prisma.salesRep.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!rep) {
      return NextResponse.json(
        { error: 'Sales rep not found' },
        { status: 404 }
      )
    }

    // Update rep
    const updated = await prisma.salesRep.update({
      where: { id: params.id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Recalculate conversion rate if deals changed
    if (data.conversionRate === undefined) {
      await updateRepConversionRate(rep.id)
    }

    return NextResponse.json({
      id: updated.id,
      userId: updated.userId,
      name: updated.user.name,
      email: updated.user.email,
      specialization: updated.specialization,
      conversionRate: updated.conversionRate,
      isOnLeave: updated.isOnLeave,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update sales rep error:', error)
    return NextResponse.json(
      { error: 'Failed to update sales rep' },
      { status: 500 }
    )
  }
}

// DELETE /api/sales-reps/[id] - Delete a sales rep
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    // Only admins/owners can delete sales reps
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete sales reps' },
        { status: 403 }
      )
    }

    // Verify rep belongs to tenant
    const rep = await prisma.salesRep.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!rep) {
      return NextResponse.json(
        { error: 'Sales rep not found' },
        { status: 404 }
      )
    }

    // Check if rep has assigned leads
    const assignedLeadsCount = await prisma.contact.count({
      where: {
        assignedToId: params.id,
      },
    })

    if (assignedLeadsCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete sales rep with ${assignedLeadsCount} assigned leads. Please reassign leads first.`,
        },
        { status: 400 }
      )
    }

    await prisma.salesRep.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete sales rep error:', error)
    return NextResponse.json(
      { error: 'Failed to delete sales rep' },
      { status: 500 }
    )
  }
}
