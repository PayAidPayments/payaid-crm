import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

// GET /api/logos/[id] - Get single logo
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'ai-studio')

    const logo = await prisma.logo.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        variations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!logo) {
      return NextResponse.json(
        { error: 'Logo not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(logo)
  } catch (error) {
    console.error('Get logo error:', error)
    return NextResponse.json(
      { error: 'Failed to get logo' },
      { status: 500 }
    )
  }
}
