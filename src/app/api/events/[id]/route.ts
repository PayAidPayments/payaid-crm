import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'LIVE', 'ENDED', 'CANCELLED']).optional(),
})

// GET /api/events/[id] - Get single event
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const event = await prisma.event.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        registrations: {
          orderBy: { registeredAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { registrations: true },
        },
      },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Get event error:', error)
    return NextResponse.json(
      { error: 'Failed to get event' },
      { status: 500 }
    )
  }
}

// PATCH /api/events/[id] - Update event
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const body = await request.json()
    const validated = updateEventSchema.parse(body)

    const existing = await prisma.event.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (validated.title) updateData.title = validated.title
    if (validated.slug) updateData.slug = validated.slug
    if (validated.description !== undefined) updateData.description = validated.description
    if (validated.startDate) updateData.startDate = new Date(validated.startDate)
    if (validated.endDate) updateData.endDate = new Date(validated.endDate)
    if (validated.status) updateData.status = validated.status

    const event = await prisma.event.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(event)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update event error:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}
