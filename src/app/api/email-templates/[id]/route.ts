import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const updateEmailTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional().nullable(),
  subject: z.string().min(1).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().optional().nullable(),
  variables: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/email-templates/[id] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Get email template error:', error)
    return NextResponse.json(
      { error: 'Failed to get email template' },
      { status: 500 }
    )
  }
}

// PATCH /api/email-templates/[id] - Update template
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const body = await request.json()
    const validated = updateEmailTemplateSchema.parse(body)

    const existing = await prisma.emailTemplate.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      )
    }

    // If setting as default, unset other defaults
    if (validated.isDefault === true) {
      await prisma.emailTemplate.updateMany({
        where: {
          tenantId: tenantId,
          isDefault: true,
          id: { not: params.id },
        },
        data: {
          isDefault: false,
        },
      })
    }

    const template = await prisma.emailTemplate.update({
      where: { id: params.id },
      data: {
        name: validated.name,
        category: validated.category,
        subject: validated.subject,
        htmlContent: validated.htmlContent,
        textContent: validated.textContent,
        variables: validated.variables,
        isDefault: validated.isDefault,
        isActive: validated.isActive,
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Update email template error:', error)
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    )
  }
}
