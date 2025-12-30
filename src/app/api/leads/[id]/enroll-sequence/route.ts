import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'
import { z } from 'zod'
import { enrollLeadInSequence } from '@/lib/marketing/nurture-sequences'

const enrollSchema = z.object({
  templateId: z.string().min(1),
})

/**
 * POST /api/leads/[id]/enroll-sequence
 * Enroll a lead in a nurture sequence
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const contactId = params.id
    const body = await request.json()
    const { templateId } = enrollSchema.parse(body)

    // Verify contact belongs to tenant
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId: tenantId,
        type: 'lead',
      },
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Verify template belongs to tenant
    const template = await prisma.nurtureTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: tenantId,
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Check if already enrolled
    const existing = await prisma.nurtureEnrollment.findFirst({
      where: {
        contactId,
        templateId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Lead is already enrolled in this sequence' },
        { status: 400 }
      )
    }

    // Enroll lead
    const enrollment = await enrollLeadInSequence(
      contactId,
      templateId,
      tenantId
    )

    return NextResponse.json(
      {
        success: true,
        enrollment: {
          id: enrollment.id,
          templateName: template.name,
          status: enrollment.status,
          totalSteps: enrollment.totalSteps,
          completedSteps: enrollment.completedSteps,
          enrolledAt: enrollment.enrolledAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Enroll sequence error:', error)
    return NextResponse.json(
      {
        error: 'Failed to enroll lead in sequence',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
