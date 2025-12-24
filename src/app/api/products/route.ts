import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { authenticateRequest } from '@/lib/middleware/auth'
import { cache } from '@/lib/redis/client'
import { z } from 'zod'

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  costPrice: z.number().positive(),
  salePrice: z.number().positive(),
  discountPrice: z.number().positive().optional(),
  quantity: z.number().int().default(0),
  reorderLevel: z.number().int().default(10),
  images: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  // GST/Tax Information
  hsnCode: z.string().optional(),
  sacCode: z.string().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  itemType: z.enum(['goods', 'services']).optional(),
})

// GET /api/products - List all products
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license (products are part of sales/CRM)
    const { tenantId } = await requireCRMAccess(request)

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const lowStock = searchParams.get('lowStock') === 'true'

    // Build cache key (only cache non-search queries)
    const cacheKey = search 
      ? null 
      : `products:${tenantId}:${page}:${limit}:${category || 'all'}:${lowStock ? 'lowstock' : 'all'}`

    // Check cache for non-search queries
    if (cacheKey) {
      const cached = await cache.get(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    const where: any = {
      tenantId: tenantId,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (category) {
      where.categories = { has: category }
    }

    if (lowStock) {
      where.quantity = { lte: prisma.product.fields.reorderLevel }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          sku: true,
          salePrice: true,
          quantity: true,
          categories: true,
          images: true,
          createdAt: true,
        },
      }),
      prisma.product.count({ where }),
    ])

    const result = {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }

    // Cache non-search results for 3 minutes
    if (cacheKey) {
      await cache.set(cacheKey, result, 180)
    }

    return NextResponse.json(result)
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Get products error:', error)
    return NextResponse.json(
      { error: 'Failed to get products' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create a new product
export async function POST(request: NextRequest) {
  try {
    // Check CRM module license (products are part of sales/CRM)
    const { tenantId } = await requireCRMAccess(request)

    const body = await request.json()
    const validated = createProductSchema.parse(body)

    // Check for duplicate SKU
    const existing = await prisma.product.findFirst({
      where: {
        tenantId: tenantId,
        sku: validated.sku,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Product with this SKU already exists' },
        { status: 400 }
      )
    }

    const product = await prisma.product.create({
      data: {
        ...validated,
        tenantId: tenantId,
      },
    })

    // Invalidate cache
    await cache.deletePattern(`products:${tenantId}:*`)

    return NextResponse.json(product, { status: 201 })
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

    console.error('Create product error:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}

