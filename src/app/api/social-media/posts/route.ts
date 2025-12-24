import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'

const createPostSchema = z.object({
  accountId: z.string().min(1),
  content: z.string().min(1),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  scheduledAt: z.string().optional(), // ISO date string
})

// GET /api/social-media/posts - List all social media posts
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const searchParams = request.nextUrl.searchParams
    const platform = searchParams.get('platform')
    const status = searchParams.get('status')
    const accountId = searchParams.get('accountId')

    const where: any = {
      tenantId: tenantId,
    }

    if (platform) where.platform = platform
    if (status) where.status = status
    if (accountId) where.accountId = accountId

    const posts = await prisma.socialPost.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            platform: true,
            accountName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Get social media posts error:', error)
    return NextResponse.json(
      { error: 'Failed to get social media posts' },
      { status: 500 }
    )
  }
}

// POST /api/social-media/posts - Create a new social media post
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireCRMAccess(request)

    const body = await request.json()
    const validated = createPostSchema.parse(body)

    // Verify account belongs to tenant
    const account = await prisma.socialMediaAccount.findFirst({
      where: {
        id: validated.accountId,
        tenantId: tenantId,
        isConnected: true,
      },
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Social media account not found or not connected' },
        { status: 404 }
      )
    }

    // Determine if this is a scheduled post or immediate post
    const scheduledAt = validated.scheduledAt ? new Date(validated.scheduledAt) : null
    const isScheduled = scheduledAt && scheduledAt > new Date()

    if (isScheduled) {
      // Create scheduled post
      const scheduledPost = await prisma.scheduledPost.create({
        data: {
          tenantId: tenantId,
          accountId: validated.accountId,
          content: validated.content,
          imageUrl: validated.imageUrl,
          videoUrl: validated.videoUrl,
          platform: account.platform,
          scheduledAt,
          status: 'SCHEDULED',
        },
      })

      return NextResponse.json({
        ...scheduledPost,
        type: 'scheduled',
      }, { status: 201 })
    } else {
      // Create immediate post (status: DRAFT - will need to be published via separate endpoint)
      const post = await prisma.socialPost.create({
        data: {
          tenantId: tenantId,
          accountId: validated.accountId,
          content: validated.content,
          imageUrl: validated.imageUrl,
          videoUrl: validated.videoUrl,
          platform: account.platform,
          status: 'DRAFT',
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
        ...post,
        type: 'immediate',
      }, { status: 201 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create social media post error:', error)
    return NextResponse.json(
      { error: 'Failed to create social media post' },
      { status: 500 }
    )
  }
}
