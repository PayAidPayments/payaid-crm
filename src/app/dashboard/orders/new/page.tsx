'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useContacts, useProducts } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/stores/auth'

interface OrderItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

export default function NewOrderPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const { data: contactsData } = useContacts({ limit: 100 })
  const { data: productsData } = useProducts({ limit: 100 })
  const contacts = contactsData?.contacts || []
  const products = productsData?.products || []

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
    shippingCity: '',
    shippingPostal: '',
    shippingCountry: 'India',
    paymentMethod: 'razorpay' as 'razorpay' | 'cod',
  })
  const [items, setItems] = useState<OrderItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.18 // 18% GST
  const shipping = 0 // Can be added later
  const total = subtotal + tax + shipping

  // When customer is selected, auto-fill details
  useEffect(() => {
    if (formData.customerId) {
      const contact = contacts.find((c: any) => c.id === formData.customerId)
      if (contact) {
        setFormData(prev => ({
          ...prev,
          customerName: contact.name || '',
          customerEmail: contact.email || '',
          customerPhone: contact.phone || '',
          shippingAddress: contact.address || '',
          shippingCity: contact.city || '',
          shippingPostal: contact.postalCode || '',
          shippingCountry: contact.country || 'India',
        }))
      }
    }
  }, [formData.customerId, contacts])

  const handleAddProduct = () => {
    if (!selectedProductId) {
      setError('Please select a product')
      return
    }

    const product = products.find((p: any) => p.id === selectedProductId)
    if (!product) {
      setError('Product not found')
      return
    }

    // Check if product already added
    if (items.find(item => item.productId === product.id)) {
      setError('Product already added. Update quantity instead.')
      return
    }

    setItems([...items, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      price: product.salePrice || product.discountPrice || 0,
    }])
    setSelectedProductId('')
    setError('')
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleUpdateItem = (index: number, field: 'quantity' | 'price', value: number) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    }
    setItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    if (items.length === 0) {
      setError('Please add at least one product')
      setIsSubmitting(false)
      return
    }

    if (!formData.customerName || !formData.shippingAddress) {
      setError('Please fill in all required fields')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId: formData.customerId || undefined,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail || undefined,
          customerPhone: formData.customerPhone || undefined,
          items: items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
          shippingAddress: formData.shippingAddress,
          shippingCity: formData.shippingCity,
          shippingPostal: formData.shippingPostal,
          shippingCountry: formData.shippingCountry,
          paymentMethod: formData.paymentMethod,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create order')
      }

      const order = await response.json()
      router.push(`/dashboard/orders/${order.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
      setIsSubmitting(false)
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
          <h1 className="text-3xl font-bold text-gray-900">New Order</h1>
          <p className="mt-2 text-gray-600">Create a new order for a customer</p>
        </div>
        <Link href="/dashboard/orders">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
                <CardDescription>Select or enter customer details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="customerId" className="text-sm font-medium">
                    Select Customer
                  </label>
                  <select
                    id="customerId"
                    name="customerId"
                    value={formData.customerId}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    disabled={isSubmitting}
                  >
                    <option value="">New Customer</option>
                    {contacts
                      .filter((c: any) => c.type === 'customer')
                      .map((contact: any) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name} {contact.email ? `(${contact.email})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="customerName" className="text-sm font-medium">
                      Customer Name *
                    </label>
                    <Input
                      id="customerName"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="customerEmail" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="customerEmail"
                      name="customerEmail"
                      type="email"
                      value={formData.customerEmail}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="customerPhone" className="text-sm font-medium">
                      Phone
                    </label>
                    <Input
                      id="customerPhone"
                      name="customerPhone"
                      type="tel"
                      value={formData.customerPhone}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="shippingAddress" className="text-sm font-medium">
                    Address *
                  </label>
                  <Input
                    id="shippingAddress"
                    name="shippingAddress"
                    value={formData.shippingAddress}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="shippingCity" className="text-sm font-medium">
                      City *
                    </label>
                    <Input
                      id="shippingCity"
                      name="shippingCity"
                      value={formData.shippingCity}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="shippingPostal" className="text-sm font-medium">
                      Postal Code *
                    </label>
                    <Input
                      id="shippingPostal"
                      name="shippingPostal"
                      value={formData.shippingPostal}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="shippingCountry" className="text-sm font-medium">
                      Country
                    </label>
                    <Input
                      id="shippingCountry"
                      name="shippingCountry"
                      value={formData.shippingCountry}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
                <CardDescription>Add products to this order</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    disabled={isSubmitting}
                  >
                    <option value="">Select Product</option>
                    {products.map((product: any) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - ₹{product.salePrice?.toLocaleString('en-IN') || 0}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={handleAddProduct}
                    disabled={!selectedProductId || isSubmitting}
                  >
                    Add Product
                  </Button>
                </div>

                {items.length > 0 && (
                  <div className="border rounded-md">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium">Product</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Quantity</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Price</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Total</th>
                          <th className="px-4 py-2 text-right text-sm font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2">{item.productName}</td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-20"
                                disabled={isSubmitting}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.price}
                                onChange={(e) => handleUpdateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                className="w-32"
                                disabled={isSubmitting}
                              />
                            </td>
                            <td className="px-4 py-2 font-medium">
                              ₹{(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                                disabled={isSubmitting}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (18%)</span>
                    <span className="font-medium">₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium">₹{shipping.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-blue-600">
                      ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  disabled={isSubmitting}
                >
                  <option value="razorpay">Online Payment (PayAid Payments)</option>
                  <option value="cod">Cash on Delivery (COD)</option>
                </select>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Link href="/dashboard/orders" className="flex-1">
                <Button type="button" variant="outline" className="w-full" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={isSubmitting || items.length === 0}>
                {isSubmitting ? 'Creating...' : 'Create Order'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
