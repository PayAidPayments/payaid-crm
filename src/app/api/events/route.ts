import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const createEventSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(), // ISO string
  endDate: z.string(), // ISO string
  timezone: z.string().optional(),
  locationType: z.enum(['PHYSICAL', 'VIRTUAL', 'HYBRID']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  virtualUrl: z.string().optional(),
  registrationEnabled: z.boolean().optional(),
  maxAttendees: z.number().optional(),
  registrationDeadline: z.string().optional(), // ISO string
  priceInr: z.number().optional(),
  streamingEnabled: z.boolean().optional(),
  streamingUrl: z.string().optional(),
})

// GET /api/events - List all events
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const upcoming = searchParams.get('upcoming') === 'true'

    const where: any = {
      tenantId: tenantId,
    }

    if (status) where.status = status
    if (upcoming) {
      where.startDate = { gte: new Date() }
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { startDate: 'asc' },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Get events error:', error)
    return NextResponse.json(
      { error: 'Failed to get events' },
      { status: 500 }
    )
  }
}

// POST /api/events - Create event
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const body = await request.json()
    const validated = createEventSchema.parse(body)

    // Check if slug exists
    const existing = await prisma.event.findUnique({
      where: { slug: validated.slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already taken' },
        { status: 400 }
      )
    }

    const event = await prisma.event.create({
      data: {
        title: validated.title,
        slug: validated.slug,
        description: validated.description,
        startDate: new Date(validated.startDate),
        endDate: new Date(validated.endDate),
        timezone: validated.timezone || 'Asia/Kolkata',
        locationType: validated.locationType || 'PHYSICAL',
        address: validated.address,
        city: validated.city,
        state: validated.state,
        virtualUrl: validated.virtualUrl,
        registrationEnabled: validated.registrationEnabled ?? true,
        maxAttendees: validated.maxAttendees,
        registrationDeadline: validated.registrationDeadline
          ? new Date(validated.registrationDeadline)
          : null,
        priceInr: validated.priceInr ? new Decimal(validated.priceInr.toString()) : null,
        streamingEnabled: validated.streamingEnabled ?? false,
        streamingUrl: validated.streamingUrl,
        status: 'DRAFT',
        tenantId: tenantId,
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create event error:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
