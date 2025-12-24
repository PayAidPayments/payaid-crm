import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { updateLeadScore } from '@/lib/ai-helpers/lead-scoring'
import { prisma } from '@payaid/db'

/**
 * PUT /api/leads/[id]/update-score
 * Manually update/recalculate score for a specific lead
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const contactId = params.id

    // Verify contact belongs to user's tenant
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId: tenantId,
      },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Update score
    const result = await updateLeadScore(contactId)

    return NextResponse.json({
      success: true,
      contactId,
      contactName: contact.name,
      score: result.score,
      components: result.components,
      updatedAt: new Date(),
    })
  } catch (error) {
    console.error('Update lead score error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update lead score',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
