import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const createChatbotSchema = z.object({
  name: z.string().min(1),
  websiteId: z.string().optional(),
  position: z.string().optional(),
  primaryColor: z.string().optional(),
  greetingMessage: z.string().optional(),
  autoGreet: z.boolean().optional(),
  autoGreetDelay: z.number().optional(),
  leadQualification: z.boolean().optional(),
  faqEnabled: z.boolean().optional(),
  knowledgeBase: z.record(z.any()).optional(),
})

// GET /api/chatbots - List all chatbots
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const chatbots = await prisma.websiteChatbot.findMany({
      where: {
        tenantId: tenantId,
      },
      include: {
        website: {
          select: {
            id: true,
            name: true,
            domain: true,
            subdomain: true,
          },
        },
        _count: {
          select: { conversations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ chatbots })
  } catch (error) {
    console.error('Get chatbots error:', error)
    return NextResponse.json(
      { error: 'Failed to get chatbots' },
      { status: 500 }
    )
  }
}

// POST /api/chatbots - Create chatbot
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const body = await request.json()
    const validated = createChatbotSchema.parse(body)

    // Verify website belongs to tenant if provided
    if (validated.websiteId) {
      const website = await prisma.website.findFirst({
        where: {
          id: validated.websiteId,
          tenantId: tenantId,
        },
      })

      if (!website) {
        return NextResponse.json(
          { error: 'Website not found' },
          { status: 404 }
        )
      }
    }

    const chatbot = await prisma.websiteChatbot.create({
      data: {
        name: validated.name,
        websiteId: validated.websiteId || null,
        position: validated.position || 'bottom-right',
        primaryColor: validated.primaryColor || '#007bff',
        greetingMessage: validated.greetingMessage || 'Hello! How can I help you today?',
        autoGreet: validated.autoGreet ?? true,
        autoGreetDelay: validated.autoGreetDelay || 3000,
        leadQualification: validated.leadQualification ?? true,
        faqEnabled: validated.faqEnabled ?? true,
        knowledgeBase: validated.knowledgeBase || {},
        isActive: true,
        temperature: new Decimal('0.7'),
        tenantId: tenantId,
      },
    })

    return NextResponse.json(chatbot, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create chatbot error:', error)
    return NextResponse.json(
      { error: 'Failed to create chatbot' },
      { status: 500 }
    )
  }
}
