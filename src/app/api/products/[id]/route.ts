import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import { cache } from '@/lib/redis/client'

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sku: z.string().min(1).optional(),
  barcode: z.string().optional(),
  costPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  discountPrice: z.number().positive().optional(),
  quantity: z.number().int().optional(),
  reorderLevel: z.number().int().optional(),
  images: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  // GST/Tax Information
  hsnCode: z.string().optional(),
  sacCode: z.string().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  itemType: z.enum(['goods', 'services']).optional(),
})

// GET /api/products/[id] - Get a single product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (products are part of sales/CRM)
    const { tenantId } = await requireModuleAccess(request, 'crm')

    const product = await prisma.product.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Get product error:', error)
    return NextResponse.json(
      { error: 'Failed to get product' },
      { status: 500 }
    )
  }
}

// PATCH /api/products/[id] - Update a product
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (products are part of sales/CRM)
    const { tenantId } = await requireModuleAccess(request, 'crm')

    const body = await request.json()
    const validated = updateProductSchema.parse(body)

    // Check if product exists and belongs to tenant
    const existing = await prisma.product.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check for duplicate SKU if SKU is being updated
    if (validated.sku && validated.sku !== existing.sku) {
      const duplicate = await prisma.product.findFirst({
        where: {
          tenantId: tenantId,
          sku: validated.sku,
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Product with this SKU already exists' },
          { status: 400 }
        )
      }
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: validated,
    })

    // Invalidate cache
    await cache.deletePattern(`products:${tenantId}:*`)
    await cache.delete(`product:${params.id}`)

    return NextResponse.json(product)
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

    console.error('Update product error:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Delete a product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check CRM module license (products are part of sales/CRM)
    const { tenantId } = await requireModuleAccess(request, 'crm')

    // Check if product exists and belongs to tenant
    const existing = await prisma.product.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    await prisma.product.delete({
      where: { id: params.id },
    })

    // Invalidate cache
    await cache.deletePattern(`products:${tenantId}:*`)
    await cache.delete(`product:${params.id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Delete product error:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}

