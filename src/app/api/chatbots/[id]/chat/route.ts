import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { z } from 'zod'

const chatMessageSchema = z.object({
  message: z.string().min(1),
  visitorId: z.string().optional(),
  sessionId: z.string().optional(),
})

// POST /api/chatbots/[id]/chat - Handle chatbot conversation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validated = chatMessageSchema.parse(body)

    const chatbot = await prisma.websiteChatbot.findUnique({
      where: { id: params.id },
      include: {
        website: true,
      },
    })

    if (!chatbot || !chatbot.isActive) {
      return NextResponse.json(
        { error: 'Chatbot not found or inactive' },
        { status: 404 }
      )
    }

    // Get or create conversation
    const sessionId = validated.sessionId || generateSessionId()
    const visitorId = validated.visitorId || generateVisitorId()

    let conversation = await prisma.chatbotConversation.findFirst({
      where: {
        chatbotId: params.id,
        sessionId,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!conversation) {
      conversation = await prisma.chatbotConversation.create({
        data: {
          chatbotId: params.id,
          visitorId,
          sessionId,
          messages: [],
          messageCount: 0,
          tenantId: chatbot.tenantId,
        },
      })
    }

    // Get messages
    const messages = (conversation.messages as any[]) || []
    const newMessage = {
      role: 'user',
      content: validated.message,
      timestamp: new Date().toISOString(),
    }
    messages.push(newMessage)

    // TODO: Use AI to generate response
    // For now, check FAQ knowledge base
    let aiResponse = 'I apologize, but I need more information to help you. Could you please provide more details?'

    if (chatbot.faqEnabled && chatbot.knowledgeBase) {
      const kb = chatbot.knowledgeBase as Record<string, string>
      const userMessage = validated.message.toLowerCase()

      // Simple keyword matching (in production, use NLP)
      for (const [question, answer] of Object.entries(kb)) {
        if (userMessage.includes(question.toLowerCase()) || 
            question.toLowerCase().includes(userMessage)) {
          aiResponse = answer
          break
        }
      }
    }

    // TODO: Use AI chat API for better responses
    // const aiResponse = await generateAIResponse({
    //   messages: messages.map(m => ({ role: m.role, content: m.content })),
    //   context: chatbot.knowledgeBase,
    //   model: chatbot.aiModel,
    // })

    const botMessage = {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
    }
    messages.push(botMessage)

    // Update conversation
    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: {
        messages,
        messageCount: messages.length,
        endedAt: null,
      },
    })

    // Check if lead should be qualified
    let contactId: string | undefined
    let leadId: string | undefined

    if (chatbot.leadQualification && messages.length >= 3) {
      // Extract email/phone from conversation
      const emailMatch = validated.message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)
      const phoneMatch = validated.message.match(/\b\d{10}\b/)

      if (emailMatch || phoneMatch) {
        // TODO: Create contact/lead in CRM
        // This would integrate with existing Contact/Deal APIs
      }
    }

    return NextResponse.json({
      response: aiResponse,
      sessionId,
      visitorId,
      contactId,
      leadId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Chatbot chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateVisitorId(): string {
  return `visitor_${Math.random().toString(36).substr(2, 16)}`
}
