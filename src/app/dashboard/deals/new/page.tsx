'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useContacts } from '@/lib/hooks/use-api'
import { useCreateDeal } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewDealPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillContactId = searchParams.get('contactId')
  const { data: contactsData } = useContacts()
  const createDeal = useCreateDeal()
  
  const [formData, setFormData] = useState({
    name: '',
    value: '',
    probability: '50',
    stage: 'lead' as 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost',
    contactId: prefillContactId || '',
    expectedCloseDate: '',
  })
  const [error, setError] = useState('')

  const contacts = contactsData?.contacts || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Frontend validation
    if (!formData.name.trim()) {
      setError('Deal name is required')
      return
    }

    if (!formData.contactId) {
      setError('Please select a contact')
      return
    }

    const value = parseFloat(formData.value)
    if (isNaN(value) || value <= 0) {
      setError('Deal value must be greater than 0')
      return
    }

    const probability = parseFloat(formData.probability)
    if (isNaN(probability) || probability < 0 || probability > 100) {
      setError('Probability must be between 0 and 100')
      return
    }

    try {
      // Prepare data with proper types and handle empty strings
      const dealData: any = {
        name: formData.name.trim(),
        value: value,
        probability: probability,
        stage: formData.stage,
        contactId: formData.contactId,
      }

      // Only include expectedCloseDate if it has a value
      if (formData.expectedCloseDate && formData.expectedCloseDate.trim() !== '') {
        dealData.expectedCloseDate = formData.expectedCloseDate
      }

      const deal = await createDeal.mutateAsync(dealData)
      router.push(`/dashboard/deals/${deal.id}`)
    } catch (err: any) {
      // Extract error message from the error object
      let errorMessage = 'Failed to create deal'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (err?.response?.data?.message) {
        // Handle API error response
        errorMessage = err.response.data.message
      } else if (err?.message) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      
      // If it's a validation error with details, show them
      if (err?.response?.data?.details) {
        const details = err.response.data.details
        if (Array.isArray(details)) {
          const detailMessages = details.map((d: any) => {
            const field = d.path?.join('.') || 'field'
            return `${field}: ${d.message || 'Invalid value'}`
          }).join('. ')
          errorMessage = `${errorMessage}. ${detailMessages}`
        }
      }
      
      setError(errorMessage)
      console.error('Deal creation error:', err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Deal</h1>
          <p className="mt-2 text-gray-600">Create a new deal in your pipeline</p>
        </div>
        <Link href="/dashboard/deals">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deal Information</CardTitle>
          <CardDescription>Enter the deal details below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Deal Name *
                </label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={createDeal.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="contactId" className="text-sm font-medium">
                  Contact *
                </label>
                <select
                  id="contactId"
                  name="contactId"
                  value={formData.contactId}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  required
                  disabled={createDeal.isPending}
                >
                  <option value="">Select a contact</option>
                  {contacts.map((contact: any) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} {contact.company ? `(${contact.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="value" className="text-sm font-medium">
                  Deal Value (₹) *
                </label>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.value}
                  onChange={handleChange}
                  required
                  disabled={createDeal.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="probability" className="text-sm font-medium">
                  Probability (%) *
                </label>
                <Input
                  id="probability"
                  name="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={handleChange}
                  required
                  disabled={createDeal.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="stage" className="text-sm font-medium">
                  Stage *
                </label>
                <select
                  id="stage"
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  required
                  disabled={createDeal.isPending}
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
                <label htmlFor="expectedCloseDate" className="text-sm font-medium">
                  Expected Close Date
                </label>
                <Input
                  id="expectedCloseDate"
                  name="expectedCloseDate"
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={handleChange}
                  disabled={createDeal.isPending}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/dashboard/deals">
                <Button type="button" variant="outline" disabled={createDeal.isPending}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createDeal.isPending}>
                {createDeal.isPending ? 'Creating...' : 'Create Deal'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
