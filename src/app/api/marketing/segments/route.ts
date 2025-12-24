import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const createSegmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  criteria: z.string().min(1),
  criteriaConfig: z.string().optional(),
})

const updateSegmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  criteria: z.string().min(1).optional(),
  criteriaConfig: z.string().optional(),
})

// GET /api/marketing/segments - List all segments
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license (marketing segments are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    const segments = await prisma.segment.findMany({
      where: {
        tenantId: tenantId,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate contact count for each segment based on criteria
    const segmentsWithCounts = await Promise.all(
      segments.map(async (segment) => {
        let contactCount = 0
        
        try {
          // Parse criteria and get matching contacts
          // For now, we'll use a simple approach - in production, you'd parse the criteria properly
          const contacts = await getContactsForSegment(tenantId, segment.criteria)
          contactCount = contacts.length
        } catch (error) {
          console.error(`Error calculating contact count for segment ${segment.id}:`, error)
        }

        return {
          id: segment.id,
          name: segment.name,
          description: segment.description,
          criteria: segment.criteria,
          contactCount,
          createdAt: segment.createdAt.toISOString(),
          updatedAt: segment.updatedAt.toISOString(),
        }
      })
    )

    return NextResponse.json({ segments: segmentsWithCounts })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Get segments error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get segments',
        details: error instanceof Error ? error.message : 'Unknown error',
        segments: [],
      },
      { status: 500 }
    )
  }
}

// POST /api/marketing/segments - Create a new segment
export async function POST(request: NextRequest) {
  try {
    // Check CRM module license (marketing segments are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    const body = await request.json()
    const validated = createSegmentSchema.parse(body)

    const segment = await prisma.segment.create({
      data: {
        tenantId: tenantId,
        name: validated.name,
        description: validated.description,
        criteria: validated.criteria,
        criteriaConfig: validated.criteriaConfig,
      },
    })

    // Calculate initial contact count
    let contactCount = 0
    try {
      const contacts = await getContactsForSegment(tenantId, segment.criteria)
      contactCount = contacts.length
    } catch (error) {
      console.error('Error calculating contact count:', error)
    }

    return NextResponse.json(
      {
        success: true,
        segment: {
          id: segment.id,
          name: segment.name,
          description: segment.description,
          criteria: segment.criteria,
          contactCount,
          createdAt: segment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
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

    console.error('Create segment error:', error)
    return NextResponse.json(
      { error: 'Failed to create segment' },
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
