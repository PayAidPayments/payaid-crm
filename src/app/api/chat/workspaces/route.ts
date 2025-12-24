import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { prisma } from '@payaid/db'

// GET /api/chat/workspaces - Get chat workspace for tenant
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license (chat is part of team communication/CRM)
    const { tenantId, userId } = await requireModuleAccess(request, 'communication')
    
    // Get user info for member creation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatar: true },
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get or create workspace for tenant
    let workspace = await prisma.chatWorkspace.findUnique({
      where: { tenantId: tenantId },
      include: {
        channels: {
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
        },
        members: {
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
    })

    // Create workspace if it doesn't exist
    if (!workspace) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })

      workspace = await prisma.chatWorkspace.create({
        data: {
          tenantId: tenantId,
          name: tenant?.name || 'Workspace',
          description: 'Team communication workspace',
        },
        include: {
          channels: true,
          members: true,
        },
      })

      // Create default channels
      const defaultChannels = [
        { name: 'general', description: 'General team discussions', isPrivate: false },
        { name: 'announcements', description: 'Company announcements', isPrivate: false },
      ]

      await Promise.all(
        defaultChannels.map((channel) =>
          prisma.chatChannel.create({
            data: {
              workspaceId: workspace.id,
              name: channel.name,
              description: channel.description,
              isPrivate: channel.isPrivate,
            },
          })
        )
      )

      // Add user as member
      await prisma.chatMember.create({
        data: {
          workspaceId: workspace.id,
          userId: userId,
          displayName: user.name || user.email,
          avatar: user.avatar,
          status: 'online',
        },
      })

      // Reload with all relations
      workspace = await prisma.chatWorkspace.findUnique({
        where: { id: workspace.id },
        include: {
          channels: {
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
            },
            _count: {
              select: {
                messages: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        members: {
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
      })
    }

    return NextResponse.json({ workspace })
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    console.error('Get chat workspace error:', error)
    return NextResponse.json(
      { error: 'Failed to get chat workspace' },
      { status: 500 }
    )
  }
}
