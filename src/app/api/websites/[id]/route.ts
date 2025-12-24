import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const updateWebsiteSchema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().optional().nullable(),
  subdomain: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
})

// GET /api/websites/[id] - Get single website
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
      include: {
        pages: {
          orderBy: { path: 'asc' },
        },
        _count: {
          select: {
            visits: true,
            sessions: true,
            pages: true,
          },
        },
      },
    })

    if (!website) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(website)
  } catch (error) {
    console.error('Get website error:', error)
    return NextResponse.json(
      { error: 'Failed to get website' },
      { status: 500 }
    )
  }
}

// PATCH /api/websites/[id] - Update website
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'ai-studio')

    const body = await request.json()
    const validated = updateWebsiteSchema.parse(body)

    const existing = await prisma.website.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      )
    }

    // Check domain/subdomain uniqueness if changed
    if (validated.domain !== undefined && validated.domain !== existing.domain) {
      if (validated.domain) {
        const domainExists = await prisma.website.findUnique({
          where: { domain: validated.domain },
        })
        if (domainExists && domainExists.id !== params.id) {
          return NextResponse.json(
            { error: 'Domain already taken' },
            { status: 400 }
          )
        }
      }
    }

    if (validated.subdomain !== undefined && validated.subdomain !== existing.subdomain) {
      if (validated.subdomain) {
        const subdomainExists = await prisma.website.findUnique({
          where: { subdomain: validated.subdomain },
        })
        if (subdomainExists && subdomainExists.id !== params.id) {
          return NextResponse.json(
            { error: 'Subdomain already taken' },
            { status: 400 }
          )
        }
      }
    }

    const website = await prisma.website.update({
      where: { id: params.id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.domain !== undefined && { domain: validated.domain }),
        ...(validated.subdomain !== undefined && { subdomain: validated.subdomain }),
        ...(validated.metaTitle !== undefined && { metaTitle: validated.metaTitle }),
        ...(validated.metaDescription !== undefined && { metaDescription: validated.metaDescription }),
        ...(validated.status && { status: validated.status }),
      },
    })

    return NextResponse.json(website)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update website error:', error)
    return NextResponse.json(
      { error: 'Failed to update website' },
      { status: 500 }
    )
  }
}
