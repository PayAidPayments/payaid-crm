import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const createEmailTemplateSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  variables: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
})

// GET /api/email-templates - List all email templates
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const isActive = searchParams.get('isActive')

    const where: any = {
      tenantId: tenantId,
    }

    if (category) where.category = category
    if (isActive !== null) where.isActive = isActive === 'true'

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { timesUsed: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Get email templates error:', error)
    return NextResponse.json(
      { error: 'Failed to get email templates' },
      { status: 500 }
    )
  }
}

// POST /api/email-templates - Create email template
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const body = await request.json()
    const validated = createEmailTemplateSchema.parse(body)

    // If setting as default, unset other defaults
    if (validated.isDefault) {
      await prisma.emailTemplate.updateMany({
        where: {
          tenantId: tenantId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      })
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name: validated.name,
        category: validated.category,
        subject: validated.subject,
        htmlContent: validated.htmlContent,
        textContent: validated.textContent,
        variables: validated.variables || [],
        isDefault: validated.isDefault ?? false,
        isActive: true,
        tenantId: tenantId,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create email template error:', error)
    return NextResponse.json(
      { error: 'Failed to create email template' },
      { status: 500 }
    )
  }
}
