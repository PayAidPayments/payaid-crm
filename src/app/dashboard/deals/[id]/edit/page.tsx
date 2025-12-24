'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useDeal, useUpdateDeal, useContacts } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function EditDealPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { data: deal, isLoading } = useDeal(id)
  const { data: contactsData } = useContacts()
  const updateDeal = useUpdateDeal()
  const contacts = contactsData?.contacts || []
  
  const [formData, setFormData] = useState({
    name: '',
    value: '',
    probability: '50',
    stage: 'lead' as 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost',
    contactId: '',
    expectedCloseDate: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (deal) {
      setFormData({
        name: deal.name || '',
        value: deal.value?.toString() || '',
        probability: deal.probability?.toString() || '50',
        stage: deal.stage || 'lead',
        contactId: deal.contactId || '',
        expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : '',
      })
    }
  }, [deal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await updateDeal.mutateAsync({
        id,
        data: {
          ...formData,
          value: parseFloat(formData.value),
          probability: parseFloat(formData.probability),
          expectedCloseDate: formData.expectedCloseDate || undefined,
        },
      })
      router.push(`/dashboard/deals/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update deal')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Deal not found</p>
        <Link href="/dashboard/deals">
          <Button>Back to Deals</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Deal</h1>
          <p className="mt-2 text-gray-600">Update deal information</p>
        </div>
        <Link href={`/dashboard/deals/${id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deal Information</CardTitle>
          <CardDescription>Update the deal details below</CardDescription>
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
                <label htmlFor="name" className="text-sm font-medium">Deal Name *</label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={updateDeal.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="value" className="text-sm font-medium">Deal Value (₹) *</label>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={handleChange}
                  required
                  disabled={updateDeal.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="probability" className="text-sm font-medium">Probability (%)</label>
                <Input
                  id="probability"
                  name="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={handleChange}
                  disabled={updateDeal.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="stage" className="text-sm font-medium">Stage *</label>
                <select
                  id="stage"
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  required
                  disabled={updateDeal.isPending}
                >
                  <option value="lead">Lead</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="contactId" className="text-sm font-medium">Contact *</label>
                <select
                  id="contactId"
                  name="contactId"
                  value={formData.contactId}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  required
                  disabled={updateDeal.isPending}
                >
                  <option value="">Select Contact</option>
                  {contacts.map((contact: any) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="expectedCloseDate" className="text-sm font-medium">Expected Close Date</label>
                <Input
                  id="expectedCloseDate"
                  name="expectedCloseDate"
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={handleChange}
                  disabled={updateDeal.isPending}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href={`/dashboard/deals/${id}`}>
                <Button type="button" variant="outline" disabled={updateDeal.isPending}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={updateDeal.isPending}>
                {updateDeal.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
