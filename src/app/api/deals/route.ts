import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { cache } from '@/lib/redis/client'
import { z } from 'zod'

const createDealSchema = z.object({
  name: z.string().min(1, 'Deal name is required'),
  value: z.number().positive('Deal value must be greater than 0'),
  probability: z.number().min(0).max(100).default(50),
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).default('lead'),
  contactId: z.string().min(1, 'Please select a contact'),
  expectedCloseDate: z.preprocess(
    (val) => {
      // Transform empty string, null, or undefined to undefined
      if (!val || val === null || val === undefined) {
        return undefined
      }
      if (typeof val === 'string' && val.trim() === '') {
        return undefined
      }
      // If it's already a datetime string, return as is
      if (typeof val === 'string' && (val.includes('T') || val.includes('Z'))) {
        return val
      }
      // If it's a date string (YYYY-MM-DD), convert to ISO datetime
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const date = new Date(val + 'T00:00:00.000Z')
        if (isNaN(date.getTime())) {
          return undefined // Invalid date
        }
        return date.toISOString()
      }
      return undefined // Invalid format, treat as optional
    },
    z.string().datetime().optional().or(z.undefined())
  ).optional(),
})

// GET /api/deals - List all deals
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license
    const { tenantId } = await requireModuleAccess(request, 'crm')

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const stage = searchParams.get('stage')
    const contactId = searchParams.get('contactId')

    // Build cache key
    const cacheKey = `deals:${tenantId}:${page}:${limit}:${stage || 'all'}:${contactId || 'all'}`

    // Check cache
    const cached = await cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const where: any = {
      tenantId: tenantId,
    }

    if (stage) where.stage = stage
    if (contactId) where.contactId = contactId

    const [deals, total, pipelineSummary] = await Promise.all([
      prisma.deal.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          value: true,
          stage: true,
          probability: true,
          expectedCloseDate: true,
          createdAt: true,
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              company: true,
            },
          },
        },
      }),
      prisma.deal.count({ where }),
      prisma.deal.groupBy({
        by: ['stage'],
        where: { tenantId: tenantId },
        _sum: {
          value: true,
        },
        _count: {
          id: true,
        },
      }),
    ])

    const result = {
      deals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      pipelineSummary,
    }

    // Cache for 3 minutes
    await cache.set(cacheKey, result, 180)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get deals error:', error)
    return NextResponse.json(
      { error: 'Failed to get deals' },
      { status: 500 }
    )
  }
}

// POST /api/deals - Create a new deal
export async function POST(request: NextRequest) {
  try {
    // Check CRM module license
    const { tenantId } = await requireModuleAccess(request, 'crm')

    const body = await request.json()
    const validated = createDealSchema.parse(body)

    // Verify contact belongs to tenant
    const contact = await prisma.contact.findFirst({
      where: {
        id: validated.contactId,
        tenantId: tenantId,
      },
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const deal = await prisma.deal.create({
      data: {
        name: validated.name,
        value: validated.value,
        probability: validated.probability,
        stage: validated.stage,
        contactId: validated.contactId,
        tenantId: tenantId,
        expectedCloseDate: validated.expectedCloseDate
          ? new Date(validated.expectedCloseDate)
          : null,
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

    return NextResponse.json(deal, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Create user-friendly error messages
      const errorMessages = error.errors.map((err) => {
        const field = err.path.join('.')
        switch (err.code) {
          case 'too_small':
            if (field === 'name') return 'Deal name is required'
            if (field === 'value') return 'Deal value must be greater than 0'
            if (field === 'contactId') return 'Please select a contact'
            return `${field} is required`
          case 'invalid_type':
            if (field === 'value') return 'Deal value must be a number'
            if (field === 'probability') return 'Probability must be a number between 0 and 100'
            return `${field} has an invalid format`
          case 'invalid_enum_value':
            return `Invalid ${field}. Please select a valid option.`
          case 'invalid_string':
            if (field === 'expectedCloseDate') return 'Invalid date format'
            return `Invalid ${field} format`
          default:
            return err.message || `Invalid ${field}`
        }
      })

      return NextResponse.json(
        {
          error: 'Validation error',
          message: errorMessages.join('. '),
          details: error.errors,
        },
        { status: 400 }
      )
    }

    console.error('Create deal error:', error)
    return NextResponse.json(
      { error: 'Failed to create deal' },
      { status: 500 }
    )
  }
}

