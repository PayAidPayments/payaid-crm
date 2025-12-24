import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import { cache } from '@/lib/redis/client'

const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  type: z.enum(['customer', 'lead', 'vendor', 'employee']).optional(),
  status: z.enum(['active', 'inactive', 'lost']).optional(),
  source: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  likelyToBuy: z.boolean().optional(),
  churnRisk: z.boolean().optional(),
})

// GET /api/contacts/[id] - Get a single contact
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireCRMAccess(request)

    const contact = await prisma.contact.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        assignedTo: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        interactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        deals: {
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          where: { status: { not: 'completed' } },
          orderBy: { dueDate: 'asc' },
        },
      },
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(contact)
  } catch (error) {
    console.error('Get contact error:', error)
    return NextResponse.json(
      { error: 'Failed to get contact' },
      { status: 500 }
    )
  }
}

// PATCH /api/contacts/[id] - Update a contact
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireCRMAccess(request)

    const body = await request.json()
    const validated = updateContactSchema.parse(body)

    // Check if contact exists and belongs to tenant
    const existing = await prisma.contact.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Check for duplicate email if email is being updated
    if (validated.email && validated.email !== existing.email) {
      const duplicate = await prisma.contact.findFirst({
        where: {
          tenantId: tenantId,
          email: validated.email,
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Contact with this email already exists' },
          { status: 400 }
        )
      }
    }

    const contact = await prisma.contact.update({
      where: { id: params.id },
      data: validated,
    })

    // Invalidate cache
    await cache.deletePattern(`contacts:${user.tenantId}:*`)
    await cache.delete(`contact:${params.id}`)

    return NextResponse.json(contact)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update contact error:', error)
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    )
  }
}

// DELETE /api/contacts/[id] - Delete a contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireCRMAccess(request)

    // Check if contact exists and belongs to tenant
    const existing = await prisma.contact.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    await prisma.contact.delete({
      where: { id: params.id },
    })

    // Invalidate cache
    await cache.deletePattern(`contacts:${user.tenantId}:*`)
    await cache.delete(`contact:${params.id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete contact error:', error)
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    )
  }
}

