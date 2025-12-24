import { ModuleGate } from '@/components/modules/ModuleGate'
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CheckoutPage {
  id: string
  name: string
  slug: string
  status: string
  paymentMethods: any
  couponsEnabled: boolean
  showOrderSummary: boolean
  createdAt: string
}

function CheckoutPagesPage() {
  const { data, isLoading } = useQuery<{ pages: CheckoutPage[] }>({
    queryKey: ['checkout-pages'],
    queryFn: async () => {
      const response = await fetch('/api/checkout-pages')
      if (!response.ok) throw new Error('Failed to fetch checkout pages')
      return response.json()
    },
  })

  const pages = data?.pages || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Checkout Pages</h1>
          <p className="mt-2 text-gray-600">Manage checkout pages with payment options</p>
        </div>
        <Link href="/dashboard/checkout-pages/new">
          <Button>Create Checkout Page</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">Loading...</div>
      ) : pages.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No checkout pages found</p>
              <Link href="/dashboard/checkout-pages/new">
                <Button>Create Your First Checkout Page</Button>
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
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {page.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Coupons:</span>
                    <span className={page.couponsEnabled ? 'text-green-600' : 'text-gray-400'}>
                      {page.couponsEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Order Summary:</span>
                    <span className={page.showOrderSummary ? 'text-green-600' : 'text-gray-400'}>
                      {page.showOrderSummary ? 'Shown' : 'Hidden'}
                    </span>
                  </div>
                </div>
                <Link href={`/dashboard/checkout-pages/${page.id}`}>
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
      <CheckoutPagesPage />
    </ModuleGate>
  )
}
