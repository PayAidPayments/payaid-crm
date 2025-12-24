import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { getPayAidPayments } from '@/lib/payments/payaid'
import { calculateGST, getGSTRate } from '@/lib/invoicing/gst'
import { z } from 'zod'
import { mediumPriorityQueue } from '@/lib/queue/bull'
import { getSendGridClient } from '@/lib/email/sendgrid'
import { emailTemplates, renderTemplate } from '@/lib/email/templates'

const createOrderSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().optional(),
    productName: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
  })),
  shippingAddress: z.string().min(1),
  shippingCity: z.string().min(1),
  shippingPostal: z.string().min(1),
  shippingCountry: z.string().default('India'),
  paymentMethod: z.enum(['razorpay', 'cod']).default('razorpay'),
  discountCode: z.string().optional(),
  discountAmount: z.number().optional(),
})

// GET /api/orders - List all orders
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license (orders are part of sales/CRM)
    const { tenantId } = await requireCRMAccess(request)

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')

    const where: any = {
      tenantId: tenantId,
    }

    if (status) where.status = status
    if (customerId) where.customerId = customerId

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json(
      { error: 'Failed to get orders' },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
  try {
    // Check CRM module license (orders are part of sales/CRM)
    const { tenantId } = await requireCRMAccess(request)

    const body = await request.json()
    const validated = createOrderSchema.parse(body)

    // Calculate totals
    const subtotal = validated.items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
    const discountAmount = validated.discountAmount || 0
    const afterDiscount = subtotal - discountAmount
    
    // Calculate GST (18% standard rate)
    const gstRate = 18
    const gst = calculateGST(afterDiscount, gstRate, false)
    
    // Shipping (simplified - would calculate based on address)
    const shipping = 0 // Free shipping for now
    
    const total = gst.totalAmount + shipping

    // Generate order number
    const orderCount = await prisma.order.count({
      where: { tenantId: tenantId },
    })
    const orderNumber = `ORD-${String(orderCount + 1).padStart(6, '0')}`

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        tenantId: tenantId,
        customerId: validated.customerId,
        subtotal,
        tax: gst.totalGST,
        shipping,
        total,
        discountCode: validated.discountCode,
        discountAmount,
        shippingAddress: validated.shippingAddress,
        shippingCity: validated.shippingCity,
        shippingPostal: validated.shippingPostal,
        shippingCountry: validated.shippingCountry,
        status: 'pending',
        items: {
          create: validated.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    // Handle payment based on method
    if (validated.paymentMethod === 'razorpay') {
      // Create PayAid Payments request (Two Step Integration - recommended for mobile apps)
      const payaid = getPayAidPayments()
      const paymentUrlData = await payaid.getPaymentRequestUrl({
        order_id: order.id,
        amount: total,
        currency: 'INR',
        description: `Order ${orderNumber}`,
        name: validated.customerName,
        email: validated.customerEmail || '',
        phone: validated.customerPhone || '',
        address_line_1: validated.shippingAddress,
        city: validated.shippingCity,
        state: validated.shippingCountry, // Can be updated with proper state field
        country: validated.shippingCountry || 'India',
        zip_code: validated.shippingPostal,
        return_url: `${process.env.APP_URL}/orders/${order.id}/callback?status=success`,
        return_url_failure: `${process.env.APP_URL}/orders/${order.id}/callback?status=failure`,
        return_url_cancel: `${process.env.APP_URL}/orders/${order.id}/callback?status=cancel`,
        mode: process.env.NODE_ENV === 'production' ? 'LIVE' : 'TEST',
        expiry_in_minutes: 60, // URL expires in 1 hour
      })

      // Update order with payment URL
      await prisma.order.update({
        where: { id: order.id },
        data: {
          // Store payment URL UUID if needed
        },
      })

      // Send order confirmation email (async)
      if (validated.customerEmail) {
        mediumPriorityQueue.add('send-order-confirmation-email', {
          orderId: order.id,
          customerEmail: validated.customerEmail,
          orderNumber,
          orderDate: order.createdAt,
          total,
          paymentLink: paymentUrlData.url,
        })
      }

      return NextResponse.json({
        ...order,
        paymentUrl: paymentUrlData.url,
        paymentUuid: paymentUrlData.uuid,
        paymentExpiry: paymentUrlData.expiry_datetime,
      }, { status: 201 })
    } else {
      // COD - mark as confirmed and create shipment
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'confirmed' },
      })

      // Create Shiprocket order (async)
      mediumPriorityQueue.add('create-shiprocket-order', {
        orderId: order.id,
        orderData: {
          orderNumber,
          customerName: validated.customerName,
          customerPhone: validated.customerPhone,
          shippingAddress: validated.shippingAddress,
          shippingCity: validated.shippingCity,
          shippingPostal: validated.shippingPostal,
          items: validated.items,
        },
      })

      // Send order confirmation email (async)
      if (validated.customerEmail) {
        mediumPriorityQueue.add('send-order-confirmation-email', {
          orderId: order.id,
          customerEmail: validated.customerEmail,
          orderNumber,
          orderDate: order.createdAt,
          total,
        })
      }

      return NextResponse.json(order, { status: 201 })
    }
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

    console.error('Create order error:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

