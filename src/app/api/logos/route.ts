import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@payaid/db'
import { requireModuleAccess, handleLicenseError } from '@/lib/middleware/auth'
import { z } from 'zod'
import { generateImage } from '@/lib/ai/image-generation'

const createLogoSchema = z.object({
  businessName: z.string().min(1),
  industry: z.string().optional(),
  style: z.enum(['modern', 'traditional', 'playful', 'elegant', 'minimal', 'bold']).optional(),
  colors: z.array(z.string()).optional(),
})

// GET /api/logos - List all logos
export async function GET(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'ai-studio')

    const logos = await prisma.logo.findMany({
      where: {
        tenantId: tenantId,
      },
      include: {
        variations: {
          where: { isSelected: true },
          take: 1,
        },
        _count: {
          select: { variations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ logos })
  } catch (error) {
    console.error('Get logos error:', error)
    return NextResponse.json(
      { error: 'Failed to get logos' },
      { status: 500 }
    )
  }
}

// POST /api/logos - Generate logo
export async function POST(request: NextRequest) {
  try {
    // Check crm module license
    const { tenantId, userId } = await requireModuleAccess(request, 'ai-studio')

    // Get token from request headers for passing to image generation
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || undefined

    const body = await request.json()
    const validated = createLogoSchema.parse(body)

    // Build logo prompt
    const styleDesc = validated.style || 'modern'
    const industryDesc = validated.industry ? `for ${validated.industry} industry` : ''
    const colorDesc = validated.colors && validated.colors.length > 0
      ? `using colors: ${validated.colors.join(', ')}`
      : ''
    
    const prompt = `Professional logo design ${industryDesc}, ${styleDesc} style, ${colorDesc}, business name: "${validated.businessName}", clean vector style, high quality, transparent background, professional branding`

    // Create logo record
    const logo = await prisma.logo.create({
      data: {
        businessName: validated.businessName,
        industry: validated.industry,
        style: validated.style,
        colors: validated.colors || [],
        prompt,
        status: 'GENERATING',
        tenantId: tenantId,
      },
    })

    // Generate 5 variations
    try {
      const variations = await Promise.all([
        generateLogoVariation(logo.id, prompt, validated.style || 'modern', tenantId, token),
        generateLogoVariation(logo.id, prompt, 'traditional', tenantId, token),
        generateLogoVariation(logo.id, prompt, 'playful', tenantId, token),
        generateLogoVariation(logo.id, prompt, 'elegant', tenantId, token),
        generateLogoVariation(logo.id, prompt, 'minimal', tenantId, token),
      ])

      // Update logo status
      await prisma.logo.update({
        where: { id: logo.id },
        data: {
          status: 'COMPLETED',
          modelUsed: 'stable-diffusion',
        },
      })

      return NextResponse.json({
        ...logo,
        status: 'COMPLETED',
        variations,
      }, { status: 201 })
    } catch (error) {
      // Update logo status to failed
      await prisma.logo.update({
        where: { id: logo.id },
        data: { status: 'FAILED' },
      })

      // Log detailed error for debugging
      console.error('Logo generation failed:', error)
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }

      throw error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Generate logo error:', error)
    
    // Extract detailed error message
    let errorMessage = 'Failed to generate logo'
    let hint = ''
    let details = ''
    
    if (error instanceof Error) {
      errorMessage = error.message || errorMessage
      details = error.stack || ''
      
      // Check for common error patterns
      if (error.message.includes('Hugging Face') || error.message.includes('HUGGINGFACE')) {
        hint = 'Hugging Face API may not be configured. Check your HUGGINGFACE_API_KEY in .env file.'
      } else if (error.message.includes('Google AI Studio') || error.message.includes('google')) {
        hint = 'Google AI Studio may not be configured. Set up your API key in Settings > AI Integrations.'
      } else if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        hint = 'Authentication failed. Please try logging out and back in.'
      } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        hint = 'Request timed out. The image generation service may be slow. Please try again.'
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        hint = 'Network error. Please check your internet connection.'
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        hint,
        details: details || (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    )
  }
}

async function generateLogoVariation(
  logoId: string,
  basePrompt: string,
  style: string,
  tenantId: string,
  token?: string
) {
  try {
    const stylePrompt = basePrompt.replace(/modern|traditional|playful|elegant|minimal|bold/g, style)
    
    console.log(`Generating logo variation: ${style} style for logo ${logoId}`)
    
    // Generate image using existing image generation API
    const imageResult = await generateImage({
      prompt: stylePrompt,
      size: '1024x1024',
      tenantId,
      token,
    })
    
    if (!imageResult.url) {
      throw new Error('Image generation returned empty URL')
    }
    
    console.log(`Logo variation generated successfully: ${imageResult.url.substring(0, 50)}...`)
    
    // Create variation record
    const variation = await prisma.logoVariation.create({
      data: {
        logoId,
        imageUrl: imageResult.url,
        thumbnailUrl: imageResult.url, // Use same URL for thumbnail (can optimize later)
        iconStyle: style,
        tenantId,
      },
    })

    return variation
  } catch (error) {
    console.error(`Failed to generate logo variation (${style}):`, error)
    throw error
  }
}

