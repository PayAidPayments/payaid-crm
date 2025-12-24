import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const updateLandingPageSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  contentJson: z.record(z.any()).optional(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
})

// GET /api/landing-pages/[id] - Get single landing page
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'sales')

    const page = await prisma.landingPage.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('Get landing page error:', error)
    return NextResponse.json(
      { error: 'Failed to get landing page' },
      { status: 500 }
    )
  }
}

// PATCH /api/landing-pages/[id] - Update landing page
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'sales')

    const body = await request.json()
    const validated = updateLandingPageSchema.parse(body)

    const existing = await prisma.landingPage.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      )
    }

    // Check slug uniqueness if changed
    if (validated.slug && validated.slug !== existing.slug) {
      const slugExists = await prisma.landingPage.findUnique({
        where: { slug: validated.slug },
      })
      if (slugExists && slugExists.id !== params.id) {
        return NextResponse.json(
          { error: 'Slug already taken' },
          { status: 400 }
        )
      }
    }

    const page = await prisma.landingPage.update({
      where: { id: params.id },
      data: {
        name: validated.name,
        slug: validated.slug,
        contentJson: validated.contentJson,
        metaTitle: validated.metaTitle,
        metaDescription: validated.metaDescription,
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

    console.error('Update landing page error:', error)
    return NextResponse.json(
      { error: 'Failed to update landing page' },
      { status: 500 }
    )
  }
}
