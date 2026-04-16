import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { storesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/common/Loading';
import ProductCard from '../components/common/ProductCard';
import { toAbsoluteImageUrl } from '../utils/imageUrl';

const StoreFront = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSupplier = user?.role === 'supplier';
  const [store, setStore] = useState(null);
  const [myStore, setMyStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!isSupplier) return;
    let cancelled = false;
    storesAPI.getAll()
      .then((res) => {
        const data = res.data.data;
        const ownStore = Array.isArray(data) ? data[0] : data;
        if (!cancelled) setMyStore(ownStore || null);
      })
      .catch(() => {
        if (!cancelled) setMyStore(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isSupplier]);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        setLoading(true);
        setLogoFailed(false);
        const res = await storesAPI.getPublicBySlug(slug);
        setStore(res.data.data);
      } catch (error) {
        console.error('Failed to load store:', error);
        setStore(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [slug]);

  useEffect(() => {
    if (!isSupplier) return;
    if (!store || !myStore) return;
    if (store.id !== myStore.id && myStore.slug) {
      navigate(`/stores/${myStore.slug}`, { replace: true });
    }
  }, [isSupplier, store, myStore, navigate]);

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Store not found</h1>
          <p className="text-gray-600 mb-4">The market you are looking for does not exist or is no longer active.</p>
          <Link to="/products" className="text-primary-600 hover:text-primary-700 font-medium">
            Browse all products
          </Link>
        </div>
      </div>
    );
  }

  const products = store.products || [];
  const storeLogoUrl = store?.logo ? toAbsoluteImageUrl(store.logo, '') : '';
  const storeInitial = store?.name?.trim()?.[0]?.toUpperCase() || 'S';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full border border-gray-200 bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
              {storeLogoUrl && !logoFailed ? (
                <img
                  src={storeLogoUrl}
                  alt={`${store.name} logo`}
                  className="w-full h-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="text-xl font-semibold text-primary-600">{storeInitial}</span>
              )}
            </div>
            <div>
            <h1 className="text-3xl font-display font-bold text-gray-800">
              {store.name}
            </h1>
            {store.description && (
              <p className="text-gray-600 mt-2 max-w-2xl">
                {store.description}
              </p>
            )}
            {store.address && (
              <p className="text-gray-500 mt-1 text-sm">
                Address: {store.address}
              </p>
            )}
            {store.phone && (
              <p className="text-gray-500 mt-1 text-sm">
                Contact: {store.phone}
              </p>
            )}
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <p>{products.length} products in this market</p>
            {isSupplier ? (
              <Link to="/products" className="text-primary-600 hover:text-primary-700 font-medium">
                View my catalog
              </Link>
            ) : (
              <Link to="/products" className="text-primary-600 hover:text-primary-700 font-medium">
                Browse all markets
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {products.length === 0 ? (
          <p className="text-gray-500 text-center">
            This market does not have any products available right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                mode={isSupplier ? 'supplier' : 'customer'}
                onEdit={(product) => navigate(`/supplier/products?edit=${product.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreFront;

