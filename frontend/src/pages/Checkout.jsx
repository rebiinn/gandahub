import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FaCreditCard, FaMoneyBill, FaMobile } from 'react-icons/fa';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ordersAPI } from '../services/api';
import { toast } from 'react-toastify';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';

const Checkout = () => {
  const navigate = useNavigate();
  const { cart, items, clearCart, loading: cartLoading } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      shipping_first_name: user?.first_name || '',
      shipping_last_name: user?.last_name || '',
      shipping_email: user?.email || '',
      shipping_phone: user?.phone || '',
      shipping_address: user?.address || '',
      shipping_city: user?.city || '',
      shipping_state: user?.state || '',
      shipping_zip_code: user?.zip_code || '',
    },
  });

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount || 0);
  };

  const paymentMethods = [
    { id: 'cod', name: 'Cash on Delivery', icon: FaMoneyBill, description: 'Pay when you receive' },
    { id: 'gcash', name: 'GCash', icon: FaMobile, description: 'Pay via GCash' },
    { id: 'maya', name: 'Maya', icon: FaMobile, description: 'Pay via Maya' },
    { id: 'credit_card', name: 'Credit Card', icon: FaCreditCard, description: 'Visa, Mastercard' },
  ];

  const onSubmit = async (data) => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    try {
      setLoading(true);
      const orderData = {
        ...data,
        payment_method: paymentMethod,
      };

      const response = await ordersAPI.create(orderData);
      const order = response.data.data;
      
      toast.success('Order placed successfully!');
      navigate(`/orders/${order.id}`);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to place order';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (cartLoading) {
    return <Loading fullScreen />;
  }

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-display font-bold text-gray-800 mb-8">Checkout</h1>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            {/* Checkout Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Shipping Information */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-6">
                  Shipping Information
                </h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    placeholder="John"
                    error={errors.shipping_first_name?.message}
                    {...register('shipping_first_name', {
                      required: 'First name is required',
                    })}
                  />
                  <Input
                    label="Last Name"
                    placeholder="Doe"
                    error={errors.shipping_last_name?.message}
                    {...register('shipping_last_name', {
                      required: 'Last name is required',
                    })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Input
                    label="Email"
                    type="email"
                    placeholder="john@example.com"
                    error={errors.shipping_email?.message}
                    {...register('shipping_email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                  />
                  <Input
                    label="Phone"
                    placeholder="+63 912 345 6789"
                    error={errors.shipping_phone?.message}
                    {...register('shipping_phone', {
                      required: 'Phone is required',
                    })}
                  />
                </div>

                <div className="mt-4">
                  <Input
                    label="Address"
                    placeholder="123 Main Street, Barangay Example"
                    error={errors.shipping_address?.message}
                    {...register('shipping_address', {
                      required: 'Address is required',
                    })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <Input
                    label="City"
                    placeholder="Makati City"
                    error={errors.shipping_city?.message}
                    {...register('shipping_city', {
                      required: 'City is required',
                    })}
                  />
                  <Input
                    label="State/Province"
                    placeholder="Metro Manila"
                    error={errors.shipping_state?.message}
                    {...register('shipping_state')}
                  />
                  <Input
                    label="ZIP Code"
                    placeholder="1234"
                    error={errors.shipping_zip_code?.message}
                    {...register('shipping_zip_code', {
                      required: 'ZIP code is required',
                    })}
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-6">
                  Payment Method
                </h2>

                <div className="space-y-3">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    return (
                      <label
                        key={method.id}
                        className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                          paymentMethod === method.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment_method"
                          value={method.id}
                          checked={paymentMethod === method.id}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                        />
                        <Icon className="w-6 h-6 text-gray-600" />
                        <div>
                          <p className="font-medium text-gray-800">{method.name}</p>
                          <p className="text-sm text-gray-500">{method.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Order Notes */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Order Notes (Optional)
                </h2>
                <textarea
                  placeholder="Any special instructions for your order..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
                  {...register('notes')}
                />
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-6">
                  Order Summary
                </h2>

                {/* Items */}
                <div className="space-y-4 mb-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <img
                        src={item.product?.thumbnail || '/placeholder-product.jpg'}
                        alt={item.product?.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-grow">
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">
                          {item.product?.name}
                        </p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        <p className="text-sm font-medium text-primary-600">
                          {formatPrice(item.total_price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <hr className="my-4" />

                {/* Totals */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatPrice(cart?.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (12% VAT)</span>
                    <span className="font-medium">{formatPrice(cart?.tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium">
                      {cart?.shipping === 0 ? 'Free' : formatPrice(cart?.shipping)}
                    </span>
                  </div>
                  {cart?.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">-{formatPrice(cart?.discount)}</span>
                    </div>
                  )}
                  <hr className="my-4" />
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-primary-600">{formatPrice(cart?.total)}</span>
                  </div>
                </div>

                {/* Place Order Button */}
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  className="mt-6"
                  loading={loading}
                >
                  Place Order
                </Button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  By placing this order, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
