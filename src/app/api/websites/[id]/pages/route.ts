import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const createPageSchema = z.object({
  path: z.string().min(1),
  title: z.string().min(1),
  contentJson: z.any().optional(),
})

// GET /api/websites/[id]/pages - Get all pages for a website
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'ai-studio')

    const website = await prisma.website.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!website) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      )
    }

    const pages = await prisma.websitePage.findMany({
      where: {
        websiteId: params.id,
      },
      orderBy: { path: 'asc' },
    })

    return NextResponse.json({ pages })
  } catch (error) {
    console.error('Get pages error:', error)
    return NextResponse.json(
      { error: 'Failed to get pages' },
      { status: 500 }
    )
  }
}

// POST /api/websites/[id]/pages - Create a new page
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'ai-studio')

    const website = await prisma.website.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!website) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validated = createPageSchema.parse(body)

    // Check if page with same path already exists
    const existing = await prisma.websitePage.findUnique({
      where: {
        websiteId_path: {
          websiteId: params.id,
          path: validated.path,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Page with this path already exists' },
        { status: 400 }
      )
    }

    const page = await prisma.websitePage.create({
      data: {
        websiteId: params.id,
        path: validated.path,
        title: validated.title,
        contentJson: validated.contentJson || {
          type: 'page',
          sections: [
            {
              type: 'hero',
              title: validated.title,
              subtitle: '',
            },
          ],
        },
        isPublished: false,
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

    console.error('Create page error:', error)
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 }
    )
  }
}


