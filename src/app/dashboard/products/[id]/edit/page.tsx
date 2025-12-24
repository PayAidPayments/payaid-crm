'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useProduct, useUpdateProduct } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { commonGSTRates } from '@/lib/data/gst-rates'
import { generateSKU } from '@/lib/products/sku-generator'
import { detectItemType } from '@/lib/products/item-type-detector'
import { findBestHSNMatch } from '@/lib/products/smart-hsn-matcher'

interface HSNResult {
  code: string
  description: string
  cgstRate: number
  sgstRate: number
  igstRate: number
  schedule: string
  type: 'goods' | 'services'
}

export default function EditProductPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { data: product, isLoading } = useProduct(id)
  const updateProduct = useUpdateProduct()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    costPrice: '',
    salePrice: '',
    discountPrice: '',
    quantity: '0',
    reorderLevel: '10',
    categories: [] as string[],
    itemType: 'goods' as 'goods' | 'services',
    hsnCode: '',
    sacCode: '',
    gstRate: '',
  })
  const [error, setError] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [hsnSearchQuery, setHsnSearchQuery] = useState('')
  const [hsnResults, setHsnResults] = useState<HSNResult[]>([])
  const [showHsnResults, setShowHsnResults] = useState(false)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  // Search HSN/SAC codes
  const searchHSNCodes = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setHsnResults([])
      setShowHsnResults(false)
      return
    }

    try {
      const response = await fetch(
        `/api/gst/search?q=${encodeURIComponent(query)}&type=${formData.itemType}`
      )
      const data = await response.json()
      if (data.results) {
        setHsnResults(data.results)
        setShowHsnResults(true)
      }
    } catch (err) {
      console.error('HSN search error:', err)
    }
  }, [formData.itemType])

  // Auto-generate SKU when product name changes (only if SKU is empty)
  useEffect(() => {
    if (formData.name && formData.name.trim().length >= 3 && !formData.sku) {
      const generatedSKU = generateSKU(formData.name)
      setFormData(prev => ({
        ...prev,
        sku: generatedSKU,
      }))
    }
  }, [formData.name, formData.sku])

  // Auto-detect item type when product name or description changes
  useEffect(() => {
    if (formData.name && formData.name.trim().length >= 2) {
      const detectedType = detectItemType(formData.name, formData.description)
      // Only update if current type doesn't match detected type and no HSN/SAC is set
      if (formData.itemType !== detectedType && !formData.hsnCode && !formData.sacCode) {
        setFormData(prev => ({
          ...prev,
          itemType: detectedType,
        }))
      }
    }
  }, [formData.name, formData.description])

  // Auto-search and auto-select best HSN/SAC code when product name or description changes
  useEffect(() => {
    const searchText = `${formData.name} ${formData.description}`.trim()
    if (searchText.length >= 3 && !formData.hsnCode && !formData.sacCode) {
      setHsnSearchQuery(searchText)
      
      // Auto-select best match after a delay
      const autoSelectTimeout = setTimeout(() => {
        const bestMatch = findBestHSNMatch(
          formData.name,
          formData.description,
          formData.itemType
        )
        
        if (bestMatch && bestMatch.score >= 0.4) {
          // Auto-select if confidence is high enough
          if (bestMatch.item.type === 'goods') {
            setFormData(prev => ({
              ...prev,
              hsnCode: bestMatch.item.code,
              sacCode: '',
              gstRate: bestMatch.item.igstRate.toString(),
            }))
            setHsnSearchQuery('')
            setShowHsnResults(false)
          } else {
            setFormData(prev => ({
              ...prev,
              sacCode: bestMatch.item.code,
              hsnCode: '',
              gstRate: bestMatch.item.igstRate.toString(),
            }))
            setHsnSearchQuery('')
            setShowHsnResults(false)
          }
        }
      }, 1500) // Wait 1.5 seconds after user stops typing

      return () => clearTimeout(autoSelectTimeout)
    }
  }, [formData.name, formData.description, formData.itemType, formData.hsnCode, formData.sacCode])

  // Debounced search
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    const timeout = setTimeout(() => {
      if (hsnSearchQuery) {
        searchHSNCodes(hsnSearchQuery)
      } else {
        setHsnResults([])
        setShowHsnResults(false)
      }
    }, 300)

    setSearchTimeout(timeout)

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [hsnSearchQuery, searchHSNCodes])

  const selectHSNCode = (item: HSNResult) => {
    if (item.type === 'goods') {
      setFormData(prev => ({
        ...prev,
        hsnCode: item.code,
        sacCode: '',
        gstRate: item.igstRate.toString(),
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        sacCode: item.code,
        hsnCode: '',
        gstRate: item.igstRate.toString(),
      }))
    }
    setHsnSearchQuery('')
    setShowHsnResults(false)
  }

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        costPrice: product.costPrice?.toString() || '',
        salePrice: product.salePrice?.toString() || '',
        discountPrice: product.discountPrice?.toString() || '',
        quantity: product.quantity?.toString() || '0',
        reorderLevel: product.reorderLevel?.toString() || '10',
        categories: product.categories || [],
        itemType: (product.itemType as 'goods' | 'services') || 'goods',
        hsnCode: product.hsnCode || '',
        sacCode: product.sacCode || '',
        gstRate: product.gstRate?.toString() || '',
      })
    }
  }, [product])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await updateProduct.mutateAsync({
        id,
        data: {
          ...formData,
          costPrice: parseFloat(formData.costPrice),
          salePrice: parseFloat(formData.salePrice),
          discountPrice: formData.discountPrice ? parseFloat(formData.discountPrice) : undefined,
          quantity: parseInt(formData.quantity),
          reorderLevel: parseInt(formData.reorderLevel),
          hsnCode: formData.hsnCode || undefined,
          sacCode: formData.sacCode || undefined,
          gstRate: formData.gstRate ? parseFloat(formData.gstRate) : undefined,
          itemType: formData.itemType || undefined,
        },
      })
      router.push(`/dashboard/products/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const addCategory = () => {
    if (newCategory && !formData.categories.includes(newCategory)) {
      setFormData({
        ...formData,
        categories: [...formData.categories, newCategory],
      })
      setNewCategory('')
    }
  }

  const removeCategory = (category: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter(c => c !== category),
    })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Product not found</p>
        <Link href="/dashboard/products">
          <Button>Back to Products</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
          <p className="mt-2 text-gray-600">Update product information</p>
        </div>
        <Link href={`/dashboard/products/${id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
          <CardDescription>Update the product details below</CardDescription>
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
                <label htmlFor="name" className="text-sm font-medium">Product Name *</label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={updateProduct.isPending}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="description" className="text-sm font-medium">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  disabled={updateProduct.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="sku" className="text-sm font-medium">SKU</label>
                <Input
                  id="sku"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  disabled={updateProduct.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="barcode" className="text-sm font-medium">Barcode</label>
                <Input
                  id="barcode"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  disabled={updateProduct.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="costPrice" className="text-sm font-medium">Cost Price (₹)</label>
                <Input
                  id="costPrice"
                  name="costPrice"
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={handleChange}
                  disabled={updateProduct.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="salePrice" className="text-sm font-medium">Sale Price (₹) *</label>
                <Input
                  id="salePrice"
                  name="salePrice"
                  type="number"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={handleChange}
                  required
                  disabled={updateProduct.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="discountPrice" className="text-sm font-medium">Discount Price (₹)</label>
                <Input
                  id="discountPrice"
                  name="discountPrice"
                  type="number"
                  step="0.01"
                  value={formData.discountPrice}
                  onChange={handleChange}
                  disabled={updateProduct.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="quantity" className="text-sm font-medium">Quantity</label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={handleChange}
                  disabled={updateProduct.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="reorderLevel" className="text-sm font-medium">Reorder Level</label>
                <Input
                  id="reorderLevel"
                  name="reorderLevel"
                  type="number"
                  value={formData.reorderLevel}
                  onChange={handleChange}
                  disabled={updateProduct.isPending}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Categories</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Add category"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCategory()
                      }
                    }}
                    disabled={updateProduct.isPending}
                  />
                  <Button type="button" onClick={addCategory} disabled={updateProduct.isPending}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => removeCategory(cat)}
                        className="text-blue-600 hover:text-blue-800"
                        disabled={updateProduct.isPending}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Item Type Selection */}
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="itemType" className="text-sm font-medium">
                  Item Type *
                </label>
                <select
                  id="itemType"
                  name="itemType"
                  value={formData.itemType}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      itemType: e.target.value as 'goods' | 'services',
                      hsnCode: prev.itemType === 'goods' ? prev.hsnCode : '',
                      sacCode: prev.itemType === 'services' ? prev.sacCode : '',
                    }))
                    setHsnSearchQuery('')
                    setShowHsnResults(false)
                  }}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  disabled={updateProduct.isPending}
                  required
                >
                  <option value="goods">Goods (HSN Code)</option>
                  <option value="services">Services (SAC Code)</option>
                </select>
              </div>

              {/* HSN/SAC Code Search */}
              <div className="space-y-2 md:col-span-2 relative">
                <label htmlFor="hsnSearch" className="text-sm font-medium">
                  {formData.itemType === 'goods' ? 'HSN Code' : 'SAC Code'} Search
                  <span className="text-gray-500 text-xs ml-2">
                    (Search by product name or description)
                  </span>
                </label>
                <div className="relative">
                  <Input
                    id="hsnSearch"
                    placeholder={`Search ${formData.itemType === 'goods' ? 'HSN' : 'SAC'} code by product name or description...`}
                    value={hsnSearchQuery}
                    onChange={(e) => setHsnSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (hsnResults.length > 0) setShowHsnResults(true)
                    }}
                    disabled={updateProduct.isPending}
                  />
                  {showHsnResults && hsnResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {hsnResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectHSNCode(item)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                        >
                          <div className="font-medium text-sm">{item.code}</div>
                          <div className="text-xs text-gray-600 truncate">{item.description}</div>
                          <div className="text-xs text-gray-500">
                            GST: {item.igstRate}% (CGST: {item.cgstRate}% + SGST: {item.sgstRate}%)
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(formData.hsnCode || formData.sacCode) && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-sm">
                      <span className="font-medium">
                        Selected {formData.itemType === 'goods' ? 'HSN' : 'SAC'} Code:
                      </span>{' '}
                      <span className="text-green-700">{formData.hsnCode || formData.sacCode}</span>
                      {formData.gstRate && (
                        <span className="ml-2 text-gray-600">
                          (GST Rate: {formData.gstRate}%)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          hsnCode: '',
                          sacCode: '',
                          gstRate: '',
                        }))
                      }}
                      className="text-xs text-red-600 hover:text-red-800 mt-1"
                      disabled={updateProduct.isPending}
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>

              {/* Manual HSN/SAC Code Entry */}
              <div className="space-y-2">
                <label htmlFor={formData.itemType === 'goods' ? 'hsnCode' : 'sacCode'} className="text-sm font-medium">
                  {formData.itemType === 'goods' ? 'HSN Code' : 'SAC Code'}
                  <span className="text-gray-500 text-xs ml-2">(or enter manually)</span>
                </label>
                <Input
                  id={formData.itemType === 'goods' ? 'hsnCode' : 'sacCode'}
                  name={formData.itemType === 'goods' ? 'hsnCode' : 'sacCode'}
                  value={formData.itemType === 'goods' ? formData.hsnCode : formData.sacCode}
                  onChange={(e) => {
                    if (formData.itemType === 'goods') {
                      setFormData(prev => ({ ...prev, hsnCode: e.target.value }))
                    } else {
                      setFormData(prev => ({ ...prev, sacCode: e.target.value }))
                    }
                  }}
                  placeholder={formData.itemType === 'goods' ? 'Enter HSN code' : 'Enter SAC code'}
                  disabled={updateProduct.isPending}
                />
              </div>

              {/* GST Rate Selection */}
              <div className="space-y-2">
                <label htmlFor="gstRate" className="text-sm font-medium">
                  GST Rate (%)
                  <span className="text-gray-500 text-xs ml-2">(IGST rate)</span>
                </label>
                <select
                  id="gstRate"
                  name="gstRate"
                  value={formData.gstRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, gstRate: e.target.value }))}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  disabled={updateProduct.isPending}
                >
                  <option value="">Select GST Rate</option>
                  {commonGSTRates.map((rate) => (
                    <option key={rate.rate} value={rate.rate.toString()}>
                      {rate.label}
                    </option>
                  ))}
                </select>
                {formData.gstRate && (
                  <div className="text-xs text-gray-500 mt-1">
                    CGST: {parseFloat(formData.gstRate) / 2}% + SGST: {parseFloat(formData.gstRate) / 2}% = IGST: {formData.gstRate}%
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href={`/dashboard/products/${id}`}>
                <Button type="button" variant="outline" disabled={updateProduct.isPending}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={updateProduct.isPending}>
                {updateProduct.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
