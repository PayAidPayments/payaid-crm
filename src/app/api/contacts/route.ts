import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { checkTenantLimits } from '@/lib/middleware/tenant'
import { z } from 'zod'
import { cache } from '@/lib/redis/client'

const createContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  type: z.enum(['customer', 'lead', 'vendor', 'employee']).default('lead'),
  status: z.enum(['active', 'inactive', 'lost']).default('active'),
  source: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('India'),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

// GET /api/contacts - List all contacts
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license
    const { tenantId } = await requireCRMAccess(request)

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    // Build cache key (only cache non-search queries)
    const cacheKey = search 
      ? null 
      : `contacts:${tenantId}:${page}:${limit}:${type || 'all'}:${status || 'all'}`

    // Check cache for non-search queries (cache is optional, continue if it fails)
    if (cacheKey) {
      try {
        const cached = await cache.get(cacheKey)
        if (cached) {
          return NextResponse.json(cached)
        }
      } catch (cacheError) {
        // Cache error is not critical, continue without cache
        console.warn('Cache get error (continuing):', cacheError)
      }
    }

    const where: any = {
      tenantId: tenantId,
    }

    if (type) where.type = type
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Fetch contacts - only essential fields for invoice creation
    // Using minimal fields to avoid schema mismatch errors
    let contacts
    try {
      // Query with only the fields needed for invoice autofill
      // These are the fields used in the invoice creation page
      contacts = await prisma.contact.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          gstin: true,
        },
      })
    } catch (queryError: any) {
      // Log the full error to help identify the problematic field
      const errorDetails = {
        message: queryError?.message,
        code: queryError?.code,
        meta: queryError?.meta,
      }
      console.error('Contact query failed:', JSON.stringify(errorDetails, null, 2))
      console.error('Full error:', queryError)
      
      // If the error mentions an unknown field, try removing potentially missing fields one by one
      if (queryError?.message?.includes('Unknown argument') || queryError?.message?.includes('Available options') || queryError?.code === 'P2009') {
        console.warn('Retrying with reduced field set')
        
        // Try without gstin (might not exist in some schemas)
        try {
          contacts = await prisma.contact.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              company: true,
              address: true,
              city: true,
              state: true,
              postalCode: true,
            },
          })
        } catch (error1: any) {
          // Try without postalCode
          try {
            contacts = await prisma.contact.findMany({
              where,
              skip: (page - 1) * limit,
              take: limit,
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                company: true,
                address: true,
                city: true,
                state: true,
              },
            })
          } catch (error2: any) {
            // Last resort: absolute minimum
            try {
              contacts = await prisma.contact.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              })
            } catch (error3: any) {
              console.error('All fallback queries failed')
              throw queryError // Throw original error
            }
          }
        }
      } else {
        throw queryError
      }
    }

    // Count total contacts with error handling
    let total
    try {
      total = await prisma.contact.count({ where })
    } catch (countError: any) {
      console.error('Count query failed:', {
        message: countError?.message,
        code: countError?.code,
      })
      // Use contacts length as fallback
      total = contacts.length
    }

    const result = {
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }

    // Cache non-search results for 3 minutes (cache is optional, continue if it fails)
    if (cacheKey) {
      try {
        await cache.set(cacheKey, result, 180)
      } catch (cacheError) {
        // Cache error is not critical, continue without cache
        console.warn('Cache set error (continuing):', cacheError)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Get contacts error:', error)
    
    // Return more detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorCode = error?.code || error?.meta?.code
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Log full error details
    console.error('Full error details:', {
      message: errorMessage,
      code: errorCode,
      meta: error?.meta,
      stack: errorStack,
      error: error,
    })
    
    // Check for specific Prisma errors
    if (errorCode === 'P2002') {
      return NextResponse.json(
        { 
          error: 'Database constraint violation',
          message: errorMessage,
        },
        { status: 400 }
      )
    }
    
    if (errorCode === 'P1001' || errorMessage?.includes('connection')) {
      return NextResponse.json(
        { 
          error: 'Database connection failed',
          message: 'Unable to connect to database. Please check your database configuration.',
        },
        { status: 503 }
      )
    }
    
    // Always include error details in response for debugging
    const errorResponse: any = {
      error: 'Failed to get contacts',
      message: errorMessage,
    }
    
    if (errorCode) {
      errorResponse.code = errorCode
    }
    
    // Include additional details for debugging
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = errorStack
      errorResponse.meta = error?.meta
      errorResponse.rawError = error?.toString()
    }
    
    // Log to server console for debugging
    console.error('Returning error response:', JSON.stringify(errorResponse, null, 2))
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

// POST /api/contacts - Create a new contact
export async function POST(request: NextRequest) {
  try {
    // Check CRM module license
    const { tenantId } = await requireCRMAccess(request)

    // Check tenant limits
    const canCreate = await checkTenantLimits(tenantId, 'contacts')
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Contact limit reached. Please upgrade your plan.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = createContactSchema.parse(body)

    // Check for duplicate email if provided
    if (validated.email) {
      const existing = await prisma.contact.findFirst({
        where: {
          tenantId: tenantId,
          email: validated.email,
        },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Contact with this email already exists' },
          { status: 400 }
        )
      }
    }

    const contact = await prisma.contact.create({
      data: {
        ...validated,
        tenantId: tenantId,
      },
    })

    // Invalidate cache
    await cache.deletePattern(`contacts:${tenantId}:*`)

    return NextResponse.json(contact, { status: 201 })
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

    console.error('Create contact error:', error)
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    )
  }
}

