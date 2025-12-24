import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { updateLeadScore, scoreLead } from '@/lib/ai-helpers/lead-scoring'
import { prisma } from '@payaid/db'
import { z } from 'zod'

const scoreRequestSchema = z.object({
  contactId: z.string().optional(),
  batch: z.boolean().optional().default(false),
})

/**
 * POST /api/leads/score
 * Score a single lead or batch of leads
 */
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const body = await request.json()
    const { contactId, batch } = scoreRequestSchema.parse(body)

    if (batch) {
      // Score all leads for this tenant
      const contacts = await prisma.contact.findMany({
        where: {
          tenantId: tenantId,
          type: 'lead',
        },
      })

      const results = await Promise.all(
        contacts.map(async (contact) => {
          const { score, components } = await scoreLead(contact)
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              leadScore: score,
              scoreUpdatedAt: new Date(),
              scoreComponents: components as any,
            },
          })
          return {
            contactId: contact.id,
            name: contact.name,
            score,
            components,
          }
        })
      )

      return NextResponse.json({
        success: true,
        count: results.length,
        results,
      })
    } else if (contactId) {
      // Score single lead
      const result = await updateLeadScore(contactId)
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, name: true },
      })

      return NextResponse.json({
        success: true,
        contactId,
        contactName: contact?.name,
        score: result.score,
        components: result.components,
      })
    } else {
      return NextResponse.json(
        { error: 'Either contactId or batch=true required' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Lead scoring error:', error)
    return NextResponse.json(
      {
        error: 'Failed to score leads',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/leads/score?contactId=xxx
 * Get score for a specific lead
 */
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const searchParams = request.nextUrl.searchParams
    const contactId = searchParams.get('contactId')

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId query parameter required' },
        { status: 400 }
      )
    }

    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId: tenantId,
      },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { score, components } = await scoreLead(contact)

    return NextResponse.json({
      contactId: contact.id,
      name: contact.name,
      score,
      components,
      currentScore: contact.leadScore,
      scoreUpdatedAt: contact.scoreUpdatedAt,
    })
  } catch (error) {
    console.error('Get lead score error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get lead score',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
