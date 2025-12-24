import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const updateCheckoutPageSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  paymentMethods: z.record(z.boolean()).optional(),
  couponsEnabled: z.boolean().optional(),
  showOrderSummary: z.boolean().optional(),
  showShippingOptions: z.boolean().optional(),
  contentJson: z.record(z.any()).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
})

// GET /api/checkout-pages/[id] - Get single checkout page
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'sales')

    const page = await prisma.checkoutPage.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Checkout page not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('Get checkout page error:', error)
    return NextResponse.json(
      { error: 'Failed to get checkout page' },
      { status: 500 }
    )
  }
}

// PATCH /api/checkout-pages/[id] - Update checkout page
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'sales')

    const body = await request.json()
    const validated = updateCheckoutPageSchema.parse(body)

    const existing = await prisma.checkoutPage.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Checkout page not found' },
        { status: 404 }
      )
    }

    // Check slug uniqueness if changed
    if (validated.slug && validated.slug !== existing.slug) {
      const slugExists = await prisma.checkoutPage.findUnique({
        where: { slug: validated.slug },
      })
      if (slugExists && slugExists.id !== params.id) {
        return NextResponse.json(
          { error: 'Slug already taken' },
          { status: 400 }
        )
      }
    }

    const page = await prisma.checkoutPage.update({
      where: { id: params.id },
      data: {
        name: validated.name,
        slug: validated.slug,
        paymentMethods: validated.paymentMethods,
        couponsEnabled: validated.couponsEnabled,
        showOrderSummary: validated.showOrderSummary,
        showShippingOptions: validated.showShippingOptions,
        contentJson: validated.contentJson,
        status: validated.status,
      },
    })

    return NextResponse.json(page)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update checkout page error:', error)
    return NextResponse.json(
      { error: 'Failed to update checkout page' },
      { status: 500 }
    )
  }
}
