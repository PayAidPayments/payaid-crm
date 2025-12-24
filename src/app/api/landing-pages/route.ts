import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const createLandingPageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  contentJson: z.record(z.any()).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
})

// GET /api/landing-pages - List all landing pages
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'sales')

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')

    const where: any = {
      tenantId: tenantId,
    }

    if (status) where.status = status

    const pages = await prisma.landingPage.findMany({
      where,
      include: {
        _count: {
          select: { registrations: false }, // Event registrations don't exist on landing page
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ pages })
  } catch (error) {
    console.error('Get landing pages error:', error)
    return NextResponse.json(
      { error: 'Failed to get landing pages' },
      { status: 500 }
    )
  }
}

// POST /api/landing-pages - Create landing page
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'sales')

    const body = await request.json()
    const validated = createLandingPageSchema.parse(body)

    // Check if slug exists
    const existing = await prisma.landingPage.findUnique({
      where: { slug: validated.slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already taken' },
        { status: 400 }
      )
    }

    const page = await prisma.landingPage.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        contentJson: validated.contentJson || {},
        metaTitle: validated.metaTitle,
        metaDescription: validated.metaDescription,
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

    console.error('Create landing page error:', error)
    return NextResponse.json(
      { error: 'Failed to create landing page' },
      { status: 500 }
    )
  }
}
