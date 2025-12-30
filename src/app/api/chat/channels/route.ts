import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'
import { z } from 'zod'

const createChannelSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
  topic: z.string().optional(),
  purpose: z.string().optional(),
})

// GET /api/chat/channels - List channels in workspace
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license (chat is part of team communication/CRM)
    const { tenantId } = await requireModuleAccess(request, 'communication')

    // Get workspace
    const workspace = await prisma.chatWorkspace.findUnique({
      where: { tenantId: tenantId },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    const channels = await prisma.chatChannel.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        members: {
          include: {
            member: {
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
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ channels })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Get channels error:', error)
    return NextResponse.json(
      { error: 'Failed to get channels' },
      { status: 500 }
    )
  }
}

// POST /api/chat/channels - Create new channel
export async function POST(request: NextRequest) {
  try {
    // Check CRM module license (chat is part of team communication/CRM)
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')
    
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatar: true },
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const validated = createChannelSchema.parse(body)

    // Get workspace
    const workspace = await prisma.chatWorkspace.findUnique({
      where: { tenantId: tenantId },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Check if channel name already exists
    const existing = await prisma.chatChannel.findFirst({
      where: {
        workspaceId: workspace.id,
        name: validated.name,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Channel name already exists' },
        { status: 409 }
      )
    }

    // Create channel
    const channel = await prisma.chatChannel.create({
      data: {
        workspaceId: workspace.id,
        name: validated.name,
        description: validated.description,
        isPrivate: validated.isPrivate || false,
        topic: validated.topic,
        purpose: validated.purpose,
      },
      include: {
        members: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
    })

    // Add creator as member
    let chatMember = await prisma.chatMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: userId,
      },
    })

    if (!chatMember) {
      chatMember = await prisma.chatMember.create({
        data: {
          workspaceId: workspace.id,
          userId: userId,
          displayName: user.name || user.email || 'User',
          avatar: user.avatar,
          status: 'online',
        },
      })
    }

    await prisma.chatChannelMember.create({
      data: {
        channelId: channel.id,
        memberId: chatMember.id,
        role: 'admin',
      },
    })

    return NextResponse.json(channel, { status: 201 })
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

    console.error('Create channel error:', error)
    return NextResponse.json(
      { error: 'Failed to create channel' },
      { status: 500 }
    )
  }
}
