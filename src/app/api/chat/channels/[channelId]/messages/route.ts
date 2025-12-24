import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'
import { z } from 'zod'

const sendMessageSchema = z.object({
  content: z.string().min(1),
  mentionedContactIds: z.array(z.string()).optional(),
  mentionedDealIds: z.array(z.string()).optional(),
})

// GET /api/chat/channels/[channelId]/messages - Get messages in channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    // Check CRM module license (chat is part of team communication/CRM)
    const { tenantId } = await requireModuleAccess(request, 'communication')

    const { channelId } = await params

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') // Message ID for pagination

    // Verify channel belongs to tenant
    const channel = await prisma.chatChannel.findFirst({
      where: {
        id: channelId,
        workspace: {
          tenantId: tenantId,
        },
      },
    })

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    const where: any = {
      channelId,
    }

    if (before) {
      const beforeMessage = await prisma.chatChannelMessage.findUnique({
        where: { id: before },
      })
      if (beforeMessage) {
        where.createdAt = {
          lt: beforeMessage.createdAt,
        }
      }
    }

    const messages = await prisma.chatChannelMessage.findMany({
      where,
      include: {
        sender: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            mimeType: true,
            fileSize: true,
          },
        },
        reactions: {
          include: {
            channelMessage: false,
            directMessage: false,
          },
        },
        threadMessages: {
          take: 5,
          include: {
            sender: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      messages: messages.reverse(), // Oldest first
      hasMore: messages.length === limit,
    })
  } catch (error) {
    console.error('Get channel messages error:', error)
    return NextResponse.json(
      { error: 'Failed to get channel messages' },
      { status: 500 }
    )
  }
}

// POST /api/chat/channels/[channelId]/messages - Send message to channel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    // Check CRM module license (chat is part of team communication/CRM)
    const { tenantId, userId } = await requireCRMAccess(request)
    
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatar: true },
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { channelId } = await params

    const body = await request.json()
    const validated = sendMessageSchema.parse(body)

    // Verify channel belongs to tenant
    const channel = await prisma.chatChannel.findFirst({
      where: {
        id: channelId,
        workspace: {
          tenantId: tenantId,
        },
      },
    })

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    // Get or create chat member
    let chatMember = await prisma.chatMember.findFirst({
      where: {
        workspaceId: channel.workspaceId,
        userId: userId,
      },
    })

    if (!chatMember) {
      chatMember = await prisma.chatMember.create({
        data: {
          workspaceId: channel.workspaceId,
          userId: userId,
          displayName: user.name || user.email || 'User',
          avatar: user.avatar,
          status: 'online',
        },
      })
    }

    // Create message
    const message = await prisma.chatChannelMessage.create({
      data: {
        channelId,
        senderId: chatMember.id,
        content: validated.content,
        mentionedContactIds: validated.mentionedContactIds || [],
        mentionedDealIds: validated.mentionedDealIds || [],
      },
      include: {
        sender: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        attachments: true,
        reactions: true,
      },
    })

    // TODO: Broadcast via WebSocket in production
    // For now, return the message
    // In production: io.to(`channel-${channelId}`).emit('new_message', message)

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Send channel message error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
