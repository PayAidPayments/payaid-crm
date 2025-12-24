import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import { mediumPriorityQueue } from '@/lib/queue/bull'

const createCampaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['email', 'whatsapp', 'sms']),
  subject: z.string().optional(),
  content: z.string().min(1),
  segmentId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  scheduledFor: z.string().datetime().optional(),
})

// GET /api/marketing/campaigns - List all campaigns
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license (marketing campaigns are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type')

    const where: any = {
      tenantId: tenantId,
    }

    if (type) where.type = type

    // Fetch campaigns from database
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ])

    // Format campaigns with analytics
    const formattedCampaigns = campaigns.map((campaign) => {
      const analytics = campaign.status === 'sent' && campaign.sent > 0 ? {
        sent: campaign.sent,
        delivered: campaign.delivered,
        opened: campaign.opened,
        clicked: campaign.clicked,
        bounced: campaign.bounced,
        unsubscribed: campaign.unsubscribed,
        openRate: campaign.delivered > 0 ? (campaign.opened / campaign.delivered) * 100 : 0,
        clickRate: campaign.delivered > 0 ? (campaign.clicked / campaign.delivered) * 100 : 0,
        clickThroughRate: campaign.opened > 0 ? (campaign.clicked / campaign.opened) * 100 : 0,
      } : null

      return {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        subject: campaign.subject,
        content: campaign.content,
        recipientCount: campaign.recipientCount,
        createdAt: campaign.createdAt.toISOString(),
        sentAt: campaign.sentAt?.toISOString(),
        scheduledFor: campaign.scheduledFor?.toISOString(),
        analytics,
      }
    })

    return NextResponse.json({
      campaigns: formattedCampaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get campaigns error:', error)
    
    // Log full error details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get campaigns',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'Unknown',
        campaigns: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
        },
      },
      { status: 500 }
    )
  } catch (error) {
    // Handle license errors
    if (error && typeof error === 'object' && 'moduleId' in error) {
      return handleLicenseError(error)
    }
    throw error
  }
}

// POST /api/marketing/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
  try {
    // Check CRM module license (marketing campaigns are part of CRM)
    const { tenantId } = await requireModuleAccess(request, 'marketing')

    const body = await request.json()
    const validated = createCampaignSchema.parse(body)

    // Get contacts to send to
    let contactIds: string[] = []
    
    if (validated.contactIds && validated.contactIds.length > 0) {
      // Use provided contact IDs
      contactIds = validated.contactIds
    } else if (validated.segmentId) {
      // Get contacts from segment based on segment criteria
      // For demo segments, we'll map them to actual queries
      const segmentId = validated.segmentId
      
      if (segmentId === 'segment-1') {
        // High Value Customers - customers with orders above ₹50,000
        const highValueContacts = await prisma.contact.findMany({
          where: {
            tenantId: tenantId,
            status: 'active',
            type: 'customer',
            orders: {
              some: {
                total: {
                  gte: 50000,
                },
              },
            },
          },
          select: { id: true },
        })
        contactIds = highValueContacts.map(c => c.id)
      } else if (segmentId === 'segment-2') {
        // Active Leads - leads contacted in last 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const activeLeads = await prisma.contact.findMany({
          where: {
            tenantId: user.tenantId,
            status: 'active',
            type: 'lead',
            lastContactedAt: {
              gte: thirtyDaysAgo,
            },
          },
          select: { id: true },
        })
        contactIds = activeLeads.map(c => c.id)
      } else if (segmentId === 'segment-3') {
        // Proposal Stage - deals in proposal or negotiation stage
        const proposalContacts = await prisma.contact.findMany({
          where: {
            tenantId: user.tenantId,
            status: 'active',
            deals: {
              some: {
                stage: {
                  in: ['proposal', 'negotiation'],
                },
              },
            },
          },
          select: { id: true },
        })
        contactIds = proposalContacts.map(c => c.id)
      } else if (segmentId === 'segment-4') {
        // Inactive Customers - customers with no orders in last 90 days
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        
        const inactiveCustomers = await prisma.contact.findMany({
          where: {
            tenantId: user.tenantId,
            status: 'active',
            type: 'customer',
            orders: {
              none: {
                createdAt: {
                  gte: ninetyDaysAgo,
                },
              },
            },
          },
          select: { id: true },
        })
        contactIds = inactiveCustomers.map(c => c.id)
      } else {
        // Unknown segment - fallback to all active contacts
        const contacts = await prisma.contact.findMany({
          where: {
            tenantId: user.tenantId,
            status: 'active',
          },
          select: { id: true },
        })
        contactIds = contacts.map(c => c.id)
      }
    } else {
      // Default: all active contacts
      const contacts = await prisma.contact.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'active',
        },
        select: { id: true },
      })
      contactIds = contacts.map(c => c.id)
    }

    // Create campaign in database
    const campaign = await prisma.campaign.create({
      data: {
        tenantId: user.tenantId,
        name: validated.name,
        type: validated.type,
        subject: validated.subject,
        content: validated.content,
        segmentId: validated.segmentId || null,
        contactIds,
        recipientCount: contactIds.length,
        scheduledFor: validated.scheduledFor ? new Date(validated.scheduledFor) : null,
        status: validated.scheduledFor ? 'scheduled' : 'draft',
      },
    })

    // Queue campaign sending
    await mediumPriorityQueue.add('send-marketing-campaign', {
      campaignId: campaign.id,
      tenantId: user.tenantId,
      campaignName: validated.name,
      type: validated.type,
      subject: validated.subject,
      content: validated.content,
      contactIds,
      scheduledFor: validated.scheduledFor,
    })

    return NextResponse.json({
      success: true,
      message: validated.scheduledFor ? 'Campaign scheduled' : 'Campaign queued for sending',
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
      },
      contactCount: contactIds.length,
    }, { status: 201 })
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

    console.error('Create campaign error:', error)
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}

