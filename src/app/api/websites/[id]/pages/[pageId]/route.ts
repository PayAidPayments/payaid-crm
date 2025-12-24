import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const updatePageSchema = z.object({
  title: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  contentJson: z.any().optional(),
  isPublished: z.boolean().optional(),
})

// GET /api/websites/[id]/pages/[pageId] - Get single page
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; pageId: string } }
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

    const page = await prisma.websitePage.findFirst({
      where: {
        id: params.pageId,
        websiteId: params.id,
      },
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('Get page error:', error)
    return NextResponse.json(
      { error: 'Failed to get page' },
      { status: 500 }
    )
  }
}

// PATCH /api/websites/[id]/pages/[pageId] - Update page
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; pageId: string } }
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
    const validated = updatePageSchema.parse(body)

    const existing = await prisma.websitePage.findFirst({
      where: {
        id: params.pageId,
        websiteId: params.id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }

    // Check if path is being changed and if new path already exists
    if (validated.path && validated.path !== existing.path) {
      const pathExists = await prisma.websitePage.findUnique({
        where: {
          websiteId_path: {
            websiteId: params.id,
            path: validated.path,
          },
        },
      })
      if (pathExists) {
        return NextResponse.json(
          { error: 'Page with this path already exists' },
          { status: 400 }
        )
      }
    }

    const page = await prisma.websitePage.update({
      where: { id: params.pageId },
      data: {
        title: validated.title,
        path: validated.path,
        contentJson: validated.contentJson,
        isPublished: validated.isPublished,
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

    console.error('Update page error:', error)
    return NextResponse.json(
      { error: 'Failed to update page' },
      { status: 500 }
    )
  }
}

// DELETE /api/websites/[id]/pages/[pageId] - Delete page
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; pageId: string } }
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

    const page = await prisma.websitePage.findFirst({
      where: {
        id: params.pageId,
        websiteId: params.id,
      },
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }

    await prisma.websitePage.delete({
      where: { id: params.pageId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete page error:', error)
    return NextResponse.json(
      { error: 'Failed to delete page' },
      { status: 500 }
    )
  }
}


