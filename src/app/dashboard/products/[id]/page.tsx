'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useProduct } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ProductDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: product, isLoading } = useProduct(id)

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
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-2 text-gray-600">SKU: {product.sku}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/products">
            <Button variant="outline">Back</Button>
          </Link>
          <Link href={`/dashboard/products/${id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {product.description && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Description</div>
                  <div>{product.description}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Cost Price</div>
                  <div className="text-lg font-semibold">₹{product.costPrice.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Sale Price</div>
                  <div className="text-lg font-semibold text-blue-600">
                    ₹{product.salePrice.toLocaleString('en-IN')}
                  </div>
                </div>
                {product.discountPrice && (
                  <div>
                    <div className="text-sm text-gray-500">Discount Price</div>
                    <div className="text-lg font-semibold text-green-600">
                      ₹{product.discountPrice.toLocaleString('en-IN')}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-gray-500">Profit Margin</div>
                  <div className="text-lg font-semibold">
                    {((product.salePrice - product.costPrice) / product.costPrice * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {product.categories && product.categories.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Categories</div>
                  <div className="flex flex-wrap gap-2">
                    {product.categories.map((cat: string) => (
                      <span
                        key={cat}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Current Stock</div>
                <div className={`text-2xl font-bold ${product.quantity <= product.reorderLevel ? 'text-red-600' : ''}`}>
                  {product.quantity}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Reorder Level</div>
                <div className="text-lg font-semibold">{product.reorderLevel}</div>
              </div>
              {product.quantity <= product.reorderLevel && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                  ⚠️ Low stock! Reorder needed.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Total Sold</div>
                <div className="text-lg font-semibold">{product.totalSold || 0} units</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Revenue</div>
                <div className="text-lg font-semibold">
                  ₹{(product.totalRevenue || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
