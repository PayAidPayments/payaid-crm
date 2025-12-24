import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const registerEventSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
})

// POST /api/events/[id]/register - Register for event (public)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validated = registerEventSchema.parse(body)

    const event = await prisma.event.findUnique({
      where: { id: params.id },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    if (event.status !== 'PUBLISHED' && event.status !== 'LIVE') {
      return NextResponse.json(
        { error: 'Event registration is not open' },
        { status: 400 }
      )
    }

    if (!event.registrationEnabled) {
      return NextResponse.json(
        { error: 'Registration is disabled for this event' },
        { status: 400 }
      )
    }

    // Check registration deadline
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return NextResponse.json(
        { error: 'Registration deadline has passed' },
        { status: 400 }
      )
    }

    // Check max attendees
    if (event.maxAttendees) {
      const currentRegistrations = await prisma.eventRegistration.count({
        where: {
          eventId: params.id,
          status: { in: ['REGISTERED', 'CONFIRMED'] },
        },
      })

      if (currentRegistrations >= event.maxAttendees) {
        return NextResponse.json(
          { error: 'Event is full' },
          { status: 400 }
        )
      }
    }

    // Check if already registered
    const existing = await prisma.eventRegistration.findUnique({
      where: {
        eventId_email: {
          eventId: params.id,
          email: validated.email,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Already registered for this event' },
        { status: 400 }
      )
    }

    // Create registration
    const registration = await prisma.eventRegistration.create({
      data: {
        eventId: params.id,
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        company: validated.company,
        status: 'REGISTERED',
        paidAmountInr: event.priceInr,
        paymentStatus: event.priceInr && event.priceInr.gt(0) ? 'PENDING' : null,
        tenantId: event.tenantId,
      },
    })

    // TODO: If paid event, create payment link via PayAid Payments

    return NextResponse.json(registration, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Register event error:', error)
    return NextResponse.json(
      { error: 'Failed to register for event' },
      { status: 500 }
    )
  }
}
