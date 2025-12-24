import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { autoAllocateLead, assignLeadToRep } from '@/lib/sales-automation/lead-allocation'
import { sendLeadAlert } from '@/lib/notifications/send-lead-alert'
import { prisma } from '@payaid/db'
import { z } from 'zod'

const allocateRequestSchema = z.object({
  repId: z.string().optional(), // Optional: specify rep, otherwise auto-allocate
  autoAssign: z.boolean().optional().default(false), // Auto-assign without confirmation
})

/**
 * POST /api/leads/[id]/allocate
 * Allocate a lead to a sales rep (auto or manual)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const contactId = params.id
    const body = await request.json().catch(() => ({}))
    const { repId, autoAssign } = allocateRequestSchema.parse(body)

    // Get contact
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId: tenantId,
      },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    let assignedRepId: string
    let suggestions: any[] = []

    if (repId) {
      // Manual assignment
      await assignLeadToRep(contactId, repId, tenantId)
      assignedRepId = repId
    } else {
      // Auto-allocation
      const allocation = await autoAllocateLead(contact, tenantId)
      assignedRepId = allocation.bestRep.rep.id
      suggestions = allocation.suggestions

      if (autoAssign) {
        // Auto-assign immediately
        await assignLeadToRep(contactId, assignedRepId, tenantId)
      }
    }

    // Get assigned rep details
    const assignedRep = await prisma.salesRep.findUnique({
      where: { id: assignedRepId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!assignedRep) {
      return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 })
    }

    // Send notification if auto-assigned
    if (autoAssign || repId) {
      try {
        await sendLeadAlert({
          rep: assignedRep as any,
          contact,
          type: 'NEW_LEAD_ASSIGNED',
        })
      } catch (error) {
        console.error('Failed to send notification:', error)
        // Don't fail the request if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      assigned: autoAssign || !!repId,
      rep: {
        id: assignedRep.id,
        name: assignedRep.user.name,
        email: assignedRep.user.email,
        specialization: assignedRep.specialization,
        conversionRate: assignedRep.conversionRate,
      },
      suggestions: suggestions.map((s) => ({
        rep: {
          id: s.rep.id,
          name: s.rep.user.name,
          email: s.rep.user.email,
          specialization: s.rep.specialization,
          conversionRate: s.rep.conversionRate,
          assignedLeadsCount: s.rep.assignedLeads?.length || 0,
        },
        score: s.score,
        reasons: s.reasons,
      })),
    })
  } catch (error) {
    console.error('Lead allocation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to allocate lead',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
