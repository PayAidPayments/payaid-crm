import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(
    z.object({
      dayNumber: z.number().int().min(0),
      subject: z.string().min(1),
      body: z.string().min(1),
      order: z.number().int().min(0),
    })
  ),
})

// GET /api/nurture/templates - List all nurture templates
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const templates = await prisma.nurtureTemplate.findMany({
      where: {
        tenantId: tenantId,
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        steps: template.steps.map((step) => ({
          id: step.id,
          dayNumber: step.dayNumber,
          subject: step.subject,
          body: step.body,
          order: step.order,
        })),
        enrollmentsCount: template._count.enrollments,
        createdAt: template.createdAt,
      })),
    })
  } catch (error) {
    console.error('Get nurture templates error:', error)
    return NextResponse.json(
      { error: 'Failed to get nurture templates' },
      { status: 500 }
    )
  }
}

// POST /api/nurture/templates - Create a new nurture template
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const body = await request.json()
    const { name, description, steps } = createTemplateSchema.parse(body)

    // Create template with steps
    const template = await prisma.nurtureTemplate.create({
      data: {
        name,
        description,
        tenantId: tenantId,
        steps: {
          create: steps.map((step) => ({
            dayNumber: step.dayNumber,
            subject: step.subject,
            body: step.body,
            order: step.order,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json(
      {
        id: template.id,
        name: template.name,
        description: template.description,
        steps: template.steps,
        totalSteps: template.steps.length,
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

    console.error('Create nurture template error:', error)
    return NextResponse.json(
      { error: 'Failed to create nurture template' },
      { status: 500 }
    )
  }
}
