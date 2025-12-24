import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const updateOrderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  trackingUrl: z.string().url().optional(),
  shiprocketOrderId: z.string().optional(),
})

// GET /api/orders/[id] - Get a single order
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (orders are part of sales/CRM)
    const { tenantId } = await requireCRMAccess(request)

    const order = await prisma.order.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(order)
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Get order error:', error)
    return NextResponse.json(
      { error: 'Failed to get order' },
      { status: 500 }
    )
  }
}

// PATCH /api/orders/[id] - Update an order
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (orders are part of sales/CRM)
    const { tenantId } = await requireCRMAccess(request)

    const body = await request.json()
    const validated = updateOrderSchema.parse(body)

    // Check if order exists and belongs to tenant
    const existing = await prisma.order.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (validated.status) {
      updateData.status = validated.status
      if (validated.status === 'shipped') {
        updateData.shippedAt = new Date()
      } else if (validated.status === 'delivered') {
        updateData.deliveredAt = new Date()
      }
    }
    if (validated.trackingUrl) updateData.trackingUrl = validated.trackingUrl
    if (validated.shiprocketOrderId) updateData.shiprocketOrderId = validated.shiprocketOrderId

    const order = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: true,
      },
    })

    return NextResponse.json(order)
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

    console.error('Update order error:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

