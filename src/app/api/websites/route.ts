import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const createWebsiteSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
})

// GET /api/websites - List all websites
export async function GET(request: NextRequest) {
  try {
    // Check CRM module license (websites are part of marketing/CRM)
    const { tenantId } = await requireModuleAccess(request, 'ai-studio')

    const websites = await prisma.website.findMany({
      where: {
        tenantId: tenantId,
      },
      include: {
        _count: {
          select: {
            visits: true,
            sessions: true,
            pages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ websites })
  } catch (error) {
    console.error('Get websites error:', error)
    return NextResponse.json(
      { error: 'Failed to get websites' },
      { status: 500 }
    )
  }
}

// POST /api/websites - Create a new website
export async function POST(request: NextRequest) {
  console.log('📝 POST /api/websites - Starting website creation')
  try {
    // Check CRM module license (websites are part of marketing/CRM)
    const { tenantId } = await requireModuleAccess(request, 'ai-studio')
    console.log('✅ POST /api/websites - License verified')

    const body = await request.json()
    console.log('📦 POST /api/websites - Request body:', body)
    const validated = createWebsiteSchema.parse(body)
    console.log('✅ POST /api/websites - Validation passed')

    // Generate unique tracking code
    const trackingCode = `payaid_${randomBytes(16).toString('hex')}`
    console.log('🔑 POST /api/websites - Generated tracking code')

    // Generate subdomain if not provided
    let subdomain = validated.subdomain
    if (!subdomain) {
      const baseSubdomain = validated.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .substring(0, 30)
      subdomain = `${baseSubdomain}-${randomBytes(4).toString('hex')}`
      console.log('🔗 POST /api/websites - Generated subdomain:', subdomain)
    } else {
      console.log('🔗 POST /api/websites - Using provided subdomain:', subdomain)
    }

    // Check if subdomain/domain already exists (only if provided and not empty)
    if (subdomain && subdomain.trim()) {
      try {
        const existing = await prisma.website.findUnique({
          where: { subdomain: subdomain.trim() },
        })
        if (existing) {
          return NextResponse.json(
            { error: 'Subdomain already taken' },
            { status: 400 }
          )
        }
      } catch (dbError) {
        console.error('Error checking subdomain:', dbError)
        // Continue if check fails - might be a unique constraint issue
      }
    }

    if (validated.domain && validated.domain.trim()) {
      try {
        const existing = await prisma.website.findUnique({
          where: { domain: validated.domain.trim() },
        })
        if (existing) {
          return NextResponse.json(
            { error: 'Domain already taken' },
            { status: 400 }
          )
        }
      } catch (dbError) {
        console.error('Error checking domain:', dbError)
        // Continue if check fails
      }
    }

    console.log('💾 POST /api/websites - Creating website in database...')
    const website = await prisma.website.create({
      data: {
        name: validated.name.trim(),
        domain: validated.domain?.trim() || null,
        subdomain: subdomain?.trim() || null,
        metaTitle: validated.metaTitle?.trim() || null,
        metaDescription: validated.metaDescription?.trim() || null,
        trackingCode,
        status: 'DRAFT',
        tenantId: tenantId,
      },
    })
    console.log('✅ POST /api/websites - Website created successfully:', website.id)

    // Fetch tenant business data to populate pages
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        phone: true,
        email: true,
        logo: true,
        industry: true,
      },
    })

    // Fetch products for products page
    const products = await prisma.product.findMany({
      where: { tenantId: tenantId },
      select: {
        name: true,
        description: true,
        salePrice: true,
        sku: true,
      },
      take: 10,
    })

    // Create default pages for the website with business data
    console.log('📄 POST /api/websites - Creating default pages with business data...')
    
    const businessName = tenant?.name || validated.name
    const businessAddress = tenant?.address 
      ? `${tenant.address}${tenant.city ? `, ${tenant.city}` : ''}${tenant.state ? `, ${tenant.state}` : ''}${tenant.postalCode ? ` ${tenant.postalCode}` : ''}`
      : ''
    const businessContact = tenant?.phone || tenant?.email ? `${tenant.phone || ''}${tenant.phone && tenant.email ? ' | ' : ''}${tenant.email || ''}` : ''

    const defaultPages = [
      { 
        path: '/', 
        title: 'Home Page', 
        metaTitle: validated.metaTitle || `${businessName} - Home`,
        metaDescription: validated.metaDescription || `Welcome to ${businessName}`,
        content: {
          hero: {
            title: `Welcome to ${businessName}`,
            subtitle: validated.metaDescription || `Your trusted partner for ${tenant?.industry || 'business solutions'}`,
            cta: { text: 'Get Started', link: '/contact' },
          },
          content: {
            title: 'Why Choose Us?',
            content: `<p>At ${businessName}, we are committed to delivering excellence in everything we do. With years of experience and a dedicated team, we provide solutions that help your business grow.</p>
<p>Our mission is to provide exceptional service and value to our clients, building long-lasting relationships based on trust and results.</p>`,
          },
        },
      },
      { 
        path: '/about', 
        title: 'About Us', 
        metaTitle: `About - ${businessName}`,
        metaDescription: `Learn more about ${businessName} and our mission`,
        content: {
          hero: {
            title: `About ${businessName}`,
            subtitle: 'Learn more about our company and mission',
          },
          content: {
            title: 'Our Story',
            content: `<h3>Who We Are</h3>
<p>${businessName} is a ${tenant?.industry ? tenant.industry.replace('_', ' ') : 'leading'} company dedicated to providing exceptional services and solutions to our clients.</p>

${businessAddress ? `<h3>Our Location</h3>
<p>${businessAddress}</p>` : ''}

<h3>Our Mission</h3>
<p>We strive to deliver excellence in every project, building lasting relationships with our clients through trust, quality, and innovation.</p>

<h3>Our Values</h3>
<ul>
  <li><strong>Quality:</strong> We never compromise on the quality of our work</li>
  <li><strong>Integrity:</strong> Honest and transparent in all our dealings</li>
  <li><strong>Innovation:</strong> Constantly evolving to meet your needs</li>
  <li><strong>Customer Focus:</strong> Your success is our success</li>
</ul>`,
          },
        },
      },
      { 
        path: '/contact', 
        title: 'Contact Us', 
        metaTitle: `Contact - ${businessName}`,
        metaDescription: `Get in touch with ${businessName}. We would love to hear from you.`,
        content: {
          hero: {
            title: 'Contact Us',
            subtitle: 'We would love to hear from you. Get in touch with us today.',
          },
          content: {
            title: 'Get In Touch',
            content: `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin-top: 2rem;">
${businessAddress ? `<div>
  <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Address</h3>
  <p style="color: #6b7280;">${businessAddress}</p>
</div>` : ''}
${businessContact ? `<div>
  <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Contact</h3>
  <p style="color: #6b7280;">${businessContact}</p>
</div>` : ''}
</div>

<div style="margin-top: 3rem; padding: 2rem; background: #f3f4f6; border-radius: 0.5rem;">
  <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Send us a Message</h3>
  <p style="color: #6b7280; margin-bottom: 1rem;">Fill out the form below and we'll get back to you as soon as possible.</p>
  <form style="display: flex; flex-direction: column; gap: 1rem;">
    <input type="text" placeholder="Your Name" required style="padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
    <input type="email" placeholder="Your Email" required style="padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
    <textarea placeholder="Your Message" rows="4" required style="padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem;"></textarea>
    <button type="submit" style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 600;">Send Message</button>
  </form>
</div>`,
          },
        },
      },
      { 
        path: '/products', 
        title: 'Products & Services', 
        metaTitle: `Products - ${businessName}`,
        metaDescription: `Browse our product catalog and services from ${businessName}`,
        content: {
          hero: {
            title: 'Our Products & Services',
            subtitle: 'Discover what we have to offer',
          },
          content: {
            title: products.length > 0 ? 'Our Products' : 'Our Services',
            content: products.length > 0
              ? `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
${products.map((p) => `
  <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; background: white;">
    <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">${p.name}</h3>
    ${p.description ? `<p style="color: #6b7280; margin-bottom: 1rem;">${p.description}</p>` : ''}
    ${p.salePrice ? `<p style="font-size: 1.5rem; font-weight: 700; color: #2563eb;">₹${Number(p.salePrice).toLocaleString('en-IN')}</p>` : ''}
    ${p.sku ? `<p style="font-size: 0.875rem; color: #9ca3af; margin-top: 0.5rem;">SKU: ${p.sku}</p>` : ''}
  </div>
`).join('')}
</div>`
              : `<p>We offer a wide range of ${tenant?.industry ? tenant.industry.replace('_', ' ') : 'professional'} services tailored to meet your needs.</p>
<p>Contact us today to learn more about how we can help your business grow.</p>
<div style="margin-top: 2rem;">
  <a href="/contact" style="display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 0.375rem; font-weight: 600;">Contact Us for More Information</a>
</div>`,
          },
        },
      },
    ]

    try {
      await Promise.all(
        defaultPages.map((page) =>
          prisma.websitePage.create({
            data: {
              websiteId: website.id,
              path: page.path,
              title: page.title,
              contentJson: {
                type: 'page',
                sections: [
                  {
                    type: 'hero',
                    title: page.content.hero.title,
                    subtitle: page.content.hero.subtitle,
                    cta: page.content.hero.cta || null,
                  },
                  {
                    type: 'content',
                    title: page.content.content.title,
                    content: page.content.content.content,
                  },
                ],
              },
              isPublished: false, // Pages start as drafts
            },
          })
        )
      )
      console.log('✅ POST /api/websites - Default pages created successfully with business data')
    } catch (pageError) {
      console.error('⚠️ POST /api/websites - Error creating default pages:', pageError)
      // Continue even if page creation fails - website is still created
    }

    // Return website with pages included
    const websiteWithPages = await prisma.website.findUnique({
      where: { id: website.id },
      include: {
        pages: {
          select: {
            id: true,
            path: true,
            title: true,
            isPublished: true,
          },
        },
        _count: {
          select: {
            visits: true,
            sessions: true,
            pages: true,
          },
        },
      },
    })

    return NextResponse.json(websiteWithPages, { status: 201 })
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

    console.error('Create website error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { errorMessage, errorStack })
    
    // Check for Prisma unique constraint errors
    if (errorMessage.includes('Unique constraint') || errorMessage.includes('unique constraint')) {
      return NextResponse.json(
        { error: 'Subdomain or domain already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to create website',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}
