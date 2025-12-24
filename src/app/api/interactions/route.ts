import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { authenticateRequest } from '@/lib/middleware/auth'
import { z } from 'zod'

const createInteractionSchema = z.object({
  contactId: z.string().min(1),
  type: z.enum(['email', 'call', 'meeting', 'whatsapp', 'sms']),
  subject: z.string().optional(),
  notes: z.string().optional(),
  duration: z.number().int().positive().optional(),
  outcome: z.enum(['positive', 'neutral', 'negative']).optional(),
})

// GET /api/interactions - List all interactions
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const contactId = searchParams.get('contactId')
    const type = searchParams.get('type')

    const where: any = {
      contact: {
        tenantId: user.tenantId,
      },
    }

    if (contactId) where.contactId = contactId
    if (type) where.type = type

    const [interactions, total] = await Promise.all([
      prisma.interaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.interaction.count({ where }),
    ])

    return NextResponse.json({
      interactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get interactions error:', error)
    return NextResponse.json(
      { error: 'Failed to get interactions' },
      { status: 500 }
    )
  }
}

// POST /api/interactions - Create a new interaction
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createInteractionSchema.parse(body)

    // Verify contact belongs to tenant
    const contact = await prisma.contact.findFirst({
      where: {
        id: validated.contactId,
        tenantId: user.tenantId,
      },
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const interaction = await prisma.interaction.create({
      data: {
        contactId: validated.contactId,
        type: validated.type,
        subject: validated.subject,
        notes: validated.notes,
        duration: validated.duration,
        outcome: validated.outcome,
      },
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

    // Update contact's lastContactedAt
    await prisma.contact.update({
      where: { id: validated.contactId },
      data: { lastContactedAt: new Date() },
    })

    return NextResponse.json(interaction, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create interaction error:', error)
    return NextResponse.json(
      { error: 'Failed to create interaction' },
      { status: 500 }
    )
  }
}

