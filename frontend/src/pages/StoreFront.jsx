import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { storesAPI } from '../services/api';
import Loading from '../components/common/Loading';
import ProductCard from '../components/common/ProductCard';

const StoreFront = () => {
  const { slug } = useParams();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        setLoading(true);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
          <div className="text-sm text-gray-600">
            <p>{products.length} products in this market</p>
            <Link to="/products" className="text-primary-600 hover:text-primary-700 font-medium">
              Browse all markets
            </Link>
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
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreFront;

