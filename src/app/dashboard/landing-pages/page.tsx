import { ModuleGate } from '@/components/modules/ModuleGate'
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LandingPage {
  id: string
  name: string
  slug: string
  status: string
  views: number
  conversions: number
  conversionRate?: number
  createdAt: string
}

function LandingPagesPage() {
  const { data, isLoading } = useQuery<{ pages: LandingPage[] }>({
    queryKey: ['landing-pages'],
    queryFn: async () => {
      const response = await fetch('/api/landing-pages')
      if (!response.ok) throw new Error('Failed to fetch landing pages')
      return response.json()
    },
  })

  const pages = data?.pages || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Landing Pages</h1>
          <p className="mt-2 text-gray-600">Create high-converting landing pages with A/B testing</p>
        </div>
        <Link href="/dashboard/landing-pages/new">
          <Button>Create Landing Page</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">Loading...</div>
      ) : pages.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No landing pages found</p>
              <Link href="/dashboard/landing-pages/new">
                <Button>Create Your First Landing Page</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => (
            <Card key={page.id}>
              <CardHeader>
                <CardTitle>{page.name}</CardTitle>
                <CardDescription>/{page.slug}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      page.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                      page.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {page.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Views:</span>
                    <span className="font-semibold">{page.views.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Conversions:</span>
                    <span className="font-semibold">{page.conversions.toLocaleString()}</span>
                  </div>
                  {page.conversionRate !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Conversion Rate:</span>
                      <span className="font-semibold text-green-600">
                        {Number(page.conversionRate).toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
                <Link href={`/dashboard/landing-pages/${page.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    Edit Page
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


export default function Page() {
  return (
    <ModuleGate module="crm">
      <LandingPagesPage />
    </ModuleGate>
  )
}
