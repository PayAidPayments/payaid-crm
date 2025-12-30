import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const updateDealSchema = z.object({
  name: z.string().min(1).optional(),
  value: z.number().positive().optional(),
  probability: z.number().min(0).max(100).optional(),
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  expectedCloseDate: z.string().datetime().optional(),
  actualCloseDate: z.string().datetime().optional(),
  lostReason: z.string().optional(),
})

// GET /api/deals/[id] - Get a single deal
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license
    const { tenantId } = await requireModuleAccess(request, 'crm')

    const deal = await prisma.deal.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        contact: true,
      },
    })

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(deal)
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Get deal error:', error)
    return NextResponse.json(
      { error: 'Failed to get deal' },
      { status: 500 }
    )
  }
}

// PATCH /api/deals/[id] - Update a deal
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license
    const { tenantId } = await requireModuleAccess(request, 'crm')

    const body = await request.json()
    const validated = updateDealSchema.parse(body)

    // Check if deal exists and belongs to tenant
    const existing = await prisma.deal.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (validated.name) updateData.name = validated.name
    if (validated.value !== undefined) updateData.value = validated.value
    if (validated.probability !== undefined) updateData.probability = validated.probability
    if (validated.stage) updateData.stage = validated.stage
    if (validated.expectedCloseDate) {
      updateData.expectedCloseDate = new Date(validated.expectedCloseDate)
    }
    if (validated.actualCloseDate) {
      updateData.actualCloseDate = new Date(validated.actualCloseDate)
    }
    if (validated.lostReason !== undefined) updateData.lostReason = validated.lostReason

    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(deal)
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update deal error:', error)
    return NextResponse.json(
      { error: 'Failed to update deal' },
      { status: 500 }
    )
  }
}

// DELETE /api/deals/[id] - Delete a deal
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license
    const { tenantId } = await requireModuleAccess(request, 'crm')

    // Check if deal exists and belongs to tenant
    const existing = await prisma.deal.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    await prisma.deal.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Delete deal error:', error)
    return NextResponse.json(
      { error: 'Failed to delete deal' },
      { status: 500 }
    )
  }
}

