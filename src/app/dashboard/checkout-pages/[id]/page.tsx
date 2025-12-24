'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'

interface CheckoutPage {
  id: string
  name: string
  slug: string
  status: string
  paymentMethods: any
  couponsEnabled: boolean
  showOrderSummary: boolean
  showShippingOptions: boolean
  contentJson: any
  createdAt: string
}

export default function CheckoutPageDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    paymentMethods: {
      upi: true,
      cards: true,
      netbanking: true,
      wallets: true,
    },
    couponsEnabled: true,
    showOrderSummary: true,
    showShippingOptions: true,
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
  })

  const { data: page, refetch } = useQuery<CheckoutPage>({
    queryKey: ['checkout-page', id],
    queryFn: async () => {
      const response = await fetch(`/api/checkout-pages/${id}`)
      if (!response.ok) throw new Error('Failed to fetch checkout page')
      const data = await response.json()
      setFormData({
        name: data.name,
        slug: data.slug,
        paymentMethods: data.paymentMethods || {
          upi: true,
          cards: true,
          netbanking: true,
          wallets: true,
        },
        couponsEnabled: data.couponsEnabled,
        showOrderSummary: data.showOrderSummary,
        showShippingOptions: data.showShippingOptions,
        status: data.status,
      })
      return data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/checkout-pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update checkout page')
      }
      return response.json()
    },
    onSuccess: () => {
      setIsEditing(false)
      refetch()
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  if (!page) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{page.name}</h1>
          <p className="mt-2 text-gray-600">/{page.slug}</p>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <>
              <Button onClick={() => setIsEditing(true)} variant="outline">
                Edit
              </Button>
              <Link href="/dashboard/checkout-pages">
                <Button variant="outline">Back</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Checkout Page</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Page Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="slug" className="text-sm font-medium text-gray-700">
                    URL Slug <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="status" className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full h-10 rounded-md border border-gray-300 px-3"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Methods</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(formData.paymentMethods).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setFormData({
                            ...formData,
                            paymentMethods: { ...formData.paymentMethods, [key]: e.target.checked },
                          })}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.couponsEnabled}
                      onChange={(e) => setFormData({ ...formData, couponsEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable Coupons</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.showOrderSummary}
                      onChange={(e) => setFormData({ ...formData, showOrderSummary: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Show Order Summary</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.showShippingOptions}
                      onChange={(e) => setFormData({ ...formData, showShippingOptions: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Show Shipping Options</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Page Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      page.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {page.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">{format(new Date(page.createdAt), 'PPp')}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Payment Methods</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {Object.entries(page.paymentMethods)
                      .filter(([_, enabled]) => enabled)
                      .map(([key]) => key.toUpperCase())
                      .join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Features</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {page.couponsEnabled && 'Coupons, '}
                    {page.showOrderSummary && 'Order Summary, '}
                    {page.showShippingOptions && 'Shipping'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Page Preview</CardTitle>
              <CardDescription>Visual preview of your checkout page</CardDescription>
            </div>
            <Link href={`/dashboard/checkout-pages/${id}/preview`}>
              <Button variant="outline" size="sm">
                👁️ Full Preview
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {page.contentJson && page.contentJson.type === 'checkout-page' ? (
              <div className="space-y-4 border rounded-lg p-6 bg-gray-50">
                {page.contentJson.header && (
                  <div className="bg-white p-4 rounded border-b">
                    {page.contentJson.header.logo && (
                      <img
                        src={page.contentJson.header.logo}
                        alt="Logo"
                        className="h-10 mb-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    )}
                    <h3 className="text-xl font-bold">{page.contentJson.header.title}</h3>
                  </div>
                )}
                {page.showOrderSummary && (
                  <div className="bg-white p-4 rounded">
                    <h4 className="font-semibold mb-4">Order Summary</h4>
                    {page.contentJson.orderSummary?.image && (
                      <div className="flex items-center gap-3 mb-4">
                        <img
                          src={page.contentJson.orderSummary.image}
                          alt="Product"
                          className="w-16 h-16 object-cover rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                        <div>
                          <div className="font-medium">Sample Product</div>
                          <div className="text-sm text-gray-500">Quantity: 1</div>
                          <div className="font-semibold">₹999.00</div>
                        </div>
                      </div>
                    )}
                    <div className="border-t pt-4">
                      <div className="flex justify-between mb-2">
                        <span>Subtotal</span>
                        <span>₹999.00</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>₹999.00</span>
                      </div>
                    </div>
                  </div>
                )}
                {page.contentJson.trustBadges && page.contentJson.trustBadges.length > 0 && (
                  <div className="flex gap-2 justify-center">
                    {page.contentJson.trustBadges.map((badge: any, idx: number) => (
                      <img
                        key={idx}
                        src={badge.image}
                        alt={badge.alt || 'Trust badge'}
                        className="h-8"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    ))}
                  </div>
                )}
                {page.contentJson.footer && (
                  <div className="text-center text-sm text-gray-500 mt-4">
                    {page.contentJson.footer.text}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(page.contentJson, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}
    </div>
  )
}
