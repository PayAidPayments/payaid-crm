'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'

interface LandingPage {
  id: string
  name: string
  slug: string
  status: string
  contentJson: any
  metaTitle?: string
  metaDescription?: string
  views: number
  conversions: number
  conversionRate?: number
  createdAt: string
}

export default function LandingPageDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    metaTitle: '',
    metaDescription: '',
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  })

  const { data: page, refetch } = useQuery<LandingPage>({
    queryKey: ['landing-page', id],
    queryFn: async () => {
      const response = await fetch(`/api/landing-pages/${id}`)
      if (!response.ok) throw new Error('Failed to fetch landing page')
      const data = await response.json()
      setFormData({
        name: data.name,
        slug: data.slug,
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
        status: data.status,
      })
      return data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/landing-pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          metaTitle: data.metaTitle || null,
          metaDescription: data.metaDescription || null,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update landing page')
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
              <Link href="/dashboard/landing-pages">
                <Button variant="outline">Back</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Landing Page</CardTitle>
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
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="metaTitle" className="text-sm font-medium text-gray-700">
                    Meta Title
                  </label>
                  <Input
                    id="metaTitle"
                    name="metaTitle"
                    value={formData.metaTitle}
                    onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="metaDescription" className="text-sm font-medium text-gray-700">
                    Meta Description
                  </label>
                  <textarea
                    id="metaDescription"
                    name="metaDescription"
                    value={formData.metaDescription}
                    onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
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
                      page.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {page.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Views</dt>
                  <dd className="mt-1 text-sm text-gray-900">{page.views.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Conversions</dt>
                  <dd className="mt-1 text-sm text-gray-900">{page.conversions.toLocaleString()}</dd>
                </div>
                {page.conversionRate !== null && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Conversion Rate</dt>
                    <dd className="mt-1 text-sm text-gray-900 text-green-600 font-semibold">
                      {Number(page.conversionRate).toFixed(2)}%
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">{format(new Date(page.createdAt), 'PPp')}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Page Preview</CardTitle>
                <CardDescription>Visual preview of your landing page</CardDescription>
              </div>
              <Link href={`/dashboard/landing-pages/${id}/preview`}>
                <Button variant="outline" size="sm">
                  👁️ Full Preview
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {page.contentJson && page.contentJson.sections ? (
                <div className="space-y-6">
                  {page.contentJson.sections.map((section: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      {section.type === 'hero' && (
                        <div className="relative rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
                          {section.backgroundImage && (
                            <img
                              src={section.backgroundImage}
                              alt={section.title}
                              className="w-full h-64 object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                              }}
                            />
                          )}
                          <div className={`${section.backgroundImage ? 'absolute inset-0 bg-black bg-opacity-40' : 'bg-gradient-to-r from-blue-600 to-purple-600'} flex items-center justify-center p-8`}>
                            <div className="text-center text-white">
                              <h2 className="text-3xl font-bold mb-2">{section.title}</h2>
                              {section.subtitle && <p className="text-xl mb-4">{section.subtitle}</p>}
                              {section.cta && (
                                <Button variant="secondary">{section.cta.text}</Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {section.type === 'features' && (
                        <div>
                          <h3 className="text-xl font-bold mb-4">{section.title}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {section.items?.map((item: any, idx: number) => (
                              <div key={idx} className="border rounded p-4">
                                {item.image && (
                                  <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-full h-32 object-cover rounded mb-2"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.style.display = 'none'
                                    }}
                                  />
                                )}
                                <h4 className="font-semibold">{item.icon} {item.title}</h4>
                                <p className="text-sm text-gray-600">{item.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {section.type === 'testimonials' && (
                        <div>
                          <h3 className="text-xl font-bold mb-4">{section.title}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {section.items?.map((item: any, idx: number) => (
                              <div key={idx} className="border rounded p-4">
                                <div className="flex items-center gap-3 mb-2">
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-12 h-12 rounded-full"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                      }}
                                    />
                                  )}
                                  <div>
                                    <div className="font-semibold">{item.name}</div>
                                    <div className="text-sm text-gray-500">{item.role}</div>
                                  </div>
                                </div>
                                <p className="text-sm italic">&quot;{item.quote}&quot;</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {section.type === 'products' && (
                        <div>
                          <h3 className="text-xl font-bold mb-4">{section.title}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {section.items?.map((item: any, idx: number) => (
                              <div key={idx} className="border rounded p-4">
                                {item.image && (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-48 object-cover rounded mb-2"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.style.display = 'none'
                                    }}
                                  />
                                )}
                                <h4 className="font-semibold">{item.name}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-blue-600">{item.price}</span>
                                  {item.originalPrice && (
                                    <span className="text-sm text-gray-400 line-through">{item.originalPrice}</span>
                                  )}
                                  {item.discount && (
                                    <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">{item.discount}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
