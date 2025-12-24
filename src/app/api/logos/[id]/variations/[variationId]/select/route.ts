import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

// PUT /api/logos/[id]/variations/[variationId]/select - Select logo variation
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; variationId: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'ai-studio')

    const logo = await prisma.logo.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!logo) {
      return NextResponse.json(
        { error: 'Logo not found' },
        { status: 404 }
      )
    }

    // Unselect all variations
    await prisma.logoVariation.updateMany({
      where: {
        logoId: params.id,
        tenantId: tenantId,
      },
      data: {
        isSelected: false,
      },
    })

    // Select the specified variation
    const variation = await prisma.logoVariation.update({
      where: {
        id: params.variationId,
      },
      data: {
        isSelected: true,
      },
    })

    return NextResponse.json(variation)
  } catch (error) {
    console.error('Select logo variation error:', error)
    return NextResponse.json(
      { error: 'Failed to select logo variation' },
      { status: 500 }
    )
  }
}
