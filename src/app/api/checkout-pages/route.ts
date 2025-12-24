import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const createCheckoutPageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  paymentMethods: z.record(z.boolean()).optional(),
  couponsEnabled: z.boolean().optional(),
  showOrderSummary: z.boolean().optional(),
  showShippingOptions: z.boolean().optional(),
  contentJson: z.record(z.any()).optional(),
})

// GET /api/checkout-pages - List all checkout pages
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'sales')

    const pages = await prisma.checkoutPage.findMany({
      where: {
        tenantId: tenantId,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ pages })
  } catch (error) {
    console.error('Get checkout pages error:', error)
    return NextResponse.json(
      { error: 'Failed to get checkout pages' },
      { status: 500 }
    )
  }
}

// POST /api/checkout-pages - Create checkout page
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'sales')

    const body = await request.json()
    const validated = createCheckoutPageSchema.parse(body)

    // Check if slug exists
    const existing = await prisma.checkoutPage.findUnique({
      where: { slug: validated.slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already taken' },
        { status: 400 }
      )
    }

    const page = await prisma.checkoutPage.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        paymentMethods: validated.paymentMethods || {
          upi: true,
          cards: true,
          netbanking: true,
          wallets: true,
        },
        couponsEnabled: validated.couponsEnabled ?? true,
        showOrderSummary: validated.showOrderSummary ?? true,
        showShippingOptions: validated.showShippingOptions ?? true,
        contentJson: validated.contentJson || {},
        status: 'DRAFT',
        tenantId: tenantId,
      },
    })

    return NextResponse.json(page, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create checkout page error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout page' },
      { status: 500 }
    )
  }
}
