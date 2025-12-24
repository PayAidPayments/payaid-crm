import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'
import { z } from 'zod'
import { updateRepConversionRate } from '@/lib/sales-automation/lead-allocation'

const createSalesRepSchema = z.object({
  userId: z.string().min(1),
  specialization: z.string().optional(),
})

// GET /api/sales-reps - List all sales reps for tenant
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const reps = await prisma.salesRep.findMany({
      where: {
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
        _count: {
          select: {
            assignedLeads: true,
            deals: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Calculate conversion rates if needed
    const repsWithStats = await Promise.all(
      reps.map(async (rep) => {
        if (rep.conversionRate === 0 && rep._count.deals > 0) {
          await updateRepConversionRate(rep.id)
          const updated = await prisma.salesRep.findUnique({
            where: { id: rep.id },
            select: { conversionRate: true },
          })
          return {
            ...rep,
            conversionRate: updated?.conversionRate || 0,
          }
        }
        return rep
      })
    )

    return NextResponse.json({
      reps: repsWithStats.map((rep) => ({
        id: rep.id,
        userId: rep.userId,
        name: rep.user.name,
        email: rep.user.email,
        specialization: rep.specialization,
        conversionRate: rep.conversionRate,
        isOnLeave: rep.isOnLeave,
        leaveEndDate: rep.leaveEndDate,
        assignedLeadsCount: rep._count.assignedLeads,
        dealsCount: rep._count.deals,
        createdAt: rep.createdAt,
      })),
    })
  } catch (error) {
    console.error('Get sales reps error:', error)
    return NextResponse.json(
      { error: 'Failed to get sales reps' },
      { status: 500 }
    )
  }
}

// POST /api/sales-reps - Create a new sales rep
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    // Only admins/owners can create sales reps
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create sales reps' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, specialization } = createSalesRepSchema.parse(body)

    // Verify user belongs to tenant
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: tenantId,
      },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found or does not belong to tenant' },
        { status: 404 }
      )
    }

    // Check if rep already exists
    const existing = await prisma.salesRep.findUnique({
      where: { userId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Sales rep already exists for this user' },
        { status: 400 }
      )
    }

    // Create sales rep
    const rep = await prisma.salesRep.create({
      data: {
        userId,
        tenantId: tenantId,
        specialization,
      },
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

    return NextResponse.json(
      {
        id: rep.id,
        userId: rep.userId,
        name: rep.user.name,
        email: rep.user.email,
        specialization: rep.specialization,
        conversionRate: rep.conversionRate,
        isOnLeave: rep.isOnLeave,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create sales rep error:', error)
    return NextResponse.json(
      { error: 'Failed to create sales rep' },
      { status: 500 }
    )
  }
}
