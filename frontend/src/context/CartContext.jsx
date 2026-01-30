import { createContext, useContext, useState, useEffect } from 'react';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itemsCount, setItemsCount] = useState(0);

  // Fetch cart when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    } else {
      // Load from localStorage for guests
      const savedCart = localStorage.getItem('guestCart');
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setItems(parsedCart.items || []);
        setItemsCount(parsedCart.items?.reduce((acc, item) => acc + item.quantity, 0) || 0);
      }
    }
  }, [isAuthenticated]);

  const fetchCart = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const response = await cartAPI.get();
      const data = response.data.data;
      setCart(data.cart);
      setItems(data.items || []);
      setItemsCount(data.items_count || 0);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId, quantity = 1, options = null) => {
    if (!isAuthenticated) {
      // Handle guest cart
      toast.info('Please login to add items to cart');
      return false;
    }

    try {
      setLoading(true);
      const response = await cartAPI.addItem({
        product_id: productId,
        quantity,
        options,
      });
      const data = response.data.data;
      setCart(data.cart);
      setItems(data.cart.items || []);
      setItemsCount(data.items_count || 0);
      toast.success('Added to cart!');
      return true;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to add to cart';
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const response = await cartAPI.updateItem(itemId, { quantity });
      const data = response.data.data;
      setCart(data.cart);
      setItems(data.cart.items || []);
      setItemsCount(data.items_count || 0);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update cart';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (itemId) => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const response = await cartAPI.removeItem(itemId);
      const data = response.data.data;
      setCart(data.cart);
      setItems(data.cart.items || []);
      setItemsCount(data.items_count || 0);
      toast.success('Item removed from cart');
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to remove item';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    if (!isAuthenticated) {
      setItems([]);
      setItemsCount(0);
      localStorage.removeItem('guestCart');
      return;
    }

    try {
      setLoading(true);
      await cartAPI.clear();
      setCart(null);
      setItems([]);
      setItemsCount(0);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to clear cart';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const applyCoupon = async (code) => {
    if (!isAuthenticated) return false;

    try {
      setLoading(true);
      const response = await cartAPI.applyCoupon(code);
      const data = response.data.data;
      setCart(data.cart);
      toast.success('Coupon applied!');
      return true;
    } catch (error) {
      const message = error.response?.data?.message || 'Invalid coupon code';
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeCoupon = async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const response = await cartAPI.removeCoupon();
      setCart(response.data.data);
      toast.success('Coupon removed');
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to remove coupon';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    cart,
    items,
    itemsCount,
    loading,
    fetchCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
