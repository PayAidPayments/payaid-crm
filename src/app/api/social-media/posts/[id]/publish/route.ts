import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

// POST /api/social-media/posts/[id]/publish - Publish a post to social media
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'crm')

    const post = await prisma.socialPost.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        account: true,
      },
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    if (post.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Post already published' },
        { status: 400 }
      )
    }

    // TODO: In production, integrate with actual social media APIs
    // For now, simulate publishing
    const platformPostId = `platform_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const updatedPost = await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        platformPostId,
      },
      include: {
        account: {
          select: {
            id: true,
            platform: true,
            accountName: true,
          },
        },
      },
    })

    return NextResponse.json({
      ...updatedPost,
      message: 'Post published successfully (simulated - OAuth integration pending)',
    })
  } catch (error) {
    console.error('Publish social media post error:', error)
    return NextResponse.json(
      { error: 'Failed to publish post' },
      { status: 500 }
    )
  }
}
