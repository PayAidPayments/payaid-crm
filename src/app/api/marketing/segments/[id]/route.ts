import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const updateSegmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  criteria: z.string().min(1).optional(),
  criteriaConfig: z.string().optional(),
})

// GET /api/marketing/segments/[id] - Get a single segment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (marketing segments are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    const segment = await prisma.segment.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    // Calculate contact count
    let contactCount = 0
    try {
      const contacts = await getContactsForSegment(tenantId, segment.criteria)
      contactCount = contacts.length
    } catch (error) {
      console.error('Error calculating contact count:', error)
    }

    return NextResponse.json({
      id: segment.id,
      name: segment.name,
      description: segment.description,
      criteria: segment.criteria,
      contactCount,
      createdAt: segment.createdAt.toISOString(),
      updatedAt: segment.updatedAt.toISOString(),
    })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Get segment error:', error)
    return NextResponse.json(
      { error: 'Failed to get segment' },
      { status: 500 }
    )
  }
}

// PUT /api/marketing/segments/[id] - Update a segment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (marketing segments are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    const body = await request.json()
    const validated = updateSegmentSchema.parse(body)

    // Check if segment exists and belongs to tenant
    const existingSegment = await prisma.segment.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existingSegment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    const segment = await prisma.segment.update({
      where: { id: params.id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.criteria && { criteria: validated.criteria }),
        ...(validated.criteriaConfig !== undefined && { criteriaConfig: validated.criteriaConfig }),
      },
    })

    // Calculate contact count
    let contactCount = 0
    try {
      const contacts = await getContactsForSegment(tenantId, segment.criteria)
      contactCount = contacts.length
    } catch (error) {
      console.error('Error calculating contact count:', error)
    }

    return NextResponse.json({
      success: true,
      segment: {
        id: segment.id,
        name: segment.name,
        description: segment.description,
        criteria: segment.criteria,
        contactCount,
        createdAt: segment.createdAt.toISOString(),
        updatedAt: segment.updatedAt.toISOString(),
      },
    })
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

    console.error('Update segment error:', error)
    return NextResponse.json(
      { error: 'Failed to update segment' },
      { status: 500 }
    )
  }
}

// DELETE /api/marketing/segments/[id] - Delete a segment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (marketing segments are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    // Check if segment exists and belongs to tenant
    const segment = await prisma.segment.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    await prisma.segment.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Delete segment error:', error)
    return NextResponse.json(
      { error: 'Failed to delete segment' },
      { status: 500 }
    )
  }
}

// Helper function to get contacts based on segment criteria
async function getContactsForSegment(tenantId: string, criteria: string): Promise<string[]> {
  // This is a simplified version - in production, you'd parse the criteria properly
  // For now, we'll handle common patterns
  
  if (criteria.includes('Total orders >') || criteria.includes('orders above')) {
    // High value customers - extract amount from criteria
    const amountMatch = criteria.match(/₹?([\d,]+)/)
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 50000
    
    const contacts = await prisma.contact.findMany({
      where: {
        tenantId,
        status: 'active',
        type: 'customer',
        orders: {
          some: {
            total: {
              gte: amount,
            },
          },
        },
      },
      select: { id: true },
    })
    return contacts.map(c => c.id)
  }
  
  if (criteria.includes('Last contacted') || criteria.includes('contacted in last')) {
    // Active leads - extract days from criteria
    const daysMatch = criteria.match(/(\d+)\s*days?/)
    const days = daysMatch ? parseInt(daysMatch[1]) : 30
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)
    
    const contacts = await prisma.contact.findMany({
      where: {
        tenantId,
        status: 'active',
        type: 'lead',
        lastContactedAt: {
          gte: dateThreshold,
        },
      },
      select: { id: true },
    })
    return contacts.map(c => c.id)
  }
  
  if (criteria.includes('Deal stage') || criteria.includes('proposal') || criteria.includes('negotiation')) {
    // Proposal stage deals
    const contacts = await prisma.contact.findMany({
      where: {
        tenantId,
        status: 'active',
        deals: {
          some: {
            stage: {
              in: ['proposal', 'negotiation'],
            },
          },
        },
      },
      select: { id: true },
    })
    return contacts.map(c => c.id)
  }
  
  if (criteria.includes('no orders') || criteria.includes('Inactive')) {
    // Inactive customers - extract days from criteria
    const daysMatch = criteria.match(/(\d+)\s*days?/)
    const days = daysMatch ? parseInt(daysMatch[1]) : 90
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)
    
    const contacts = await prisma.contact.findMany({
      where: {
        tenantId,
        status: 'active',
        type: 'customer',
        orders: {
          none: {
            createdAt: {
              gte: dateThreshold,
            },
          },
        },
      },
      select: { id: true },
    })
    return contacts.map(c => c.id)
  }
  
  // Default: return all active contacts
  const contacts = await prisma.contact.findMany({
    where: {
      tenantId,
      status: 'active',
    },
    select: { id: true },
  })
  return contacts.map(c => c.id)
}
