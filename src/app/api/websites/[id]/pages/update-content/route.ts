import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'

// POST /api/websites/[id]/pages/update-content - Update all pages with business content
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'ai-studio')

    // Handle both sync and async params (Next.js 15+ uses async params)
    const resolvedParams = await Promise.resolve(params)
    const websiteId = resolvedParams.id

    console.log('📝 Update content request for website:', websiteId)

    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        tenantId: tenantId,
      },
      include: {
        tenant: {
          select: {
            name: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
            phone: true,
            email: true,
            industry: true,
          },
        },
      },
    })

    if (!website) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      )
    }

    // Fetch products
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

    const businessName = website.tenant.name || website.name
    const businessAddress = website.tenant.address 
      ? `${website.tenant.address}${website.tenant.city ? `, ${website.tenant.city}` : ''}${website.tenant.state ? `, ${website.tenant.state}` : ''}${website.tenant.postalCode ? ` ${website.tenant.postalCode}` : ''}`
      : ''
    const businessContact = website.tenant.phone || website.tenant.email ? `${website.tenant.phone || ''}${website.tenant.phone && website.tenant.email ? ' | ' : ''}${website.tenant.email || ''}` : ''

    // Get all pages
    const pages = await prisma.websitePage.findMany({
      where: { websiteId: websiteId },
    })

    console.log(`📄 Found ${pages.length} pages to update`)

    // Update each page with content
    const updates = await Promise.all(
      pages.map(async (page) => {
        let contentSection = null

        switch (page.path) {
          case '/':
            contentSection = {
              type: 'content',
              title: 'Why Choose Us?',
              content: `<p>At ${businessName}, we are committed to delivering excellence in everything we do. With years of experience and a dedicated team, we provide solutions that help your business grow.</p>
<p>Our mission is to provide exceptional service and value to our clients, building long-lasting relationships based on trust and results.</p>`,
            }
            break
          case '/about':
            contentSection = {
              type: 'content',
              title: 'Our Story',
              content: `<h3>Who We Are</h3>
<p>${businessName} is a ${website.tenant.industry ? website.tenant.industry.replace('_', ' ') : 'leading'} company dedicated to providing exceptional services and solutions to our clients.</p>

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
            }
            break
          case '/contact':
            contentSection = {
              type: 'content',
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
            }
            break
          case '/products':
            contentSection = {
              type: 'content',
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
                : `<p>We offer a wide range of ${website.tenant.industry ? website.tenant.industry.replace('_', ' ') : 'professional'} services tailored to meet your needs.</p>
<p>Contact us today to learn more about how we can help your business grow.</p>
<div style="margin-top: 2rem;">
  <a href="/contact" style="display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 0.375rem; font-weight: 600;">Contact Us for More Information</a>
</div>`,
            }
            break
        }

        if (contentSection) {
          // Get current contentJson
          const currentContent = page.contentJson as any
          const sections = Array.isArray(currentContent?.sections) ? currentContent.sections : []
          
          // Check if content section already exists
          const hasContentSection = sections.some((s: any) => s && s.type === 'content')
          
          if (!hasContentSection) {
            // Add content section after hero
            const updatedSections = [...sections, contentSection]
            
            try {
              const updated = await prisma.websitePage.update({
                where: { id: page.id },
                data: {
                  contentJson: {
                    type: 'page',
                    sections: updatedSections,
                  },
                },
              })
              console.log(`✅ Updated page ${page.path} with content section`)
              return updated
            } catch (updateError) {
              console.error(`❌ Error updating page ${page.path}:`, updateError)
              throw updateError
            }
          } else {
            console.log(`⏭️ Page ${page.path} already has content section, skipping`)
          }
        } else {
          console.log(`⏭️ No content section defined for path ${page.path}`)
        }
        
        return null // Return null for pages that weren't updated
      })
    )

    const updatedCount = updates.filter((u) => u !== null && u !== undefined && typeof u === 'object' && 'id' in u).length
    console.log(`✅ Update complete: ${updatedCount} pages updated out of ${pages.length} total pages`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Updated ${updatedCount} pages with business content`,
      updated: updatedCount,
      total: pages.length,
    })
  } catch (error) {
    console.error('Update pages content error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { errorMessage, errorStack })
    
    return NextResponse.json(
      { 
        error: 'Failed to update pages content',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}


