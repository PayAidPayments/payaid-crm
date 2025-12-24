'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewCheckoutPagePage() {
  const router = useRouter()
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
  })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('/api/checkout-pages', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          contentJson: {},
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout page')
      }
      return response.json()
    },
    onSuccess: (data) => {
      router.push(`/dashboard/checkout-pages/${data.id}`)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    createMutation.mutate(formData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Checkout Page</h1>
          <p className="mt-2 text-gray-600">Create a new checkout page</p>
        </div>
        <Link href="/dashboard/checkout-pages">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Checkout Page Details</CardTitle>
          <CardDescription>Configure your checkout page settings</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

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
                  placeholder="e.g., Standard Checkout"
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
                  placeholder="standard-checkout"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Methods</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.paymentMethods.upi}
                      onChange={(e) => setFormData({
                        ...formData,
                        paymentMethods: { ...formData.paymentMethods, upi: e.target.checked },
                      })}
                      className="rounded"
                    />
                    <span className="text-sm">UPI</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.paymentMethods.cards}
                      onChange={(e) => setFormData({
                        ...formData,
                        paymentMethods: { ...formData.paymentMethods, cards: e.target.checked },
                      })}
                      className="rounded"
                    />
                    <span className="text-sm">Cards</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.paymentMethods.netbanking}
                      onChange={(e) => setFormData({
                        ...formData,
                        paymentMethods: { ...formData.paymentMethods, netbanking: e.target.checked },
                      })}
                      className="rounded"
                    />
                    <span className="text-sm">Net Banking</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.paymentMethods.wallets}
                      onChange={(e) => setFormData({
                        ...formData,
                        paymentMethods: { ...formData.paymentMethods, wallets: e.target.checked },
                      })}
                      className="rounded"
                    />
                    <span className="text-sm">Wallets</span>
                  </label>
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

            <div className="flex justify-end gap-4 pt-4">
              <Link href="/dashboard/checkout-pages">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Checkout Page'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
