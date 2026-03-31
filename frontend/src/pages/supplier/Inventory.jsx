import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaWarehouse, FaExclamationTriangle, FaMinus, FaCheck } from 'react-icons/fa';
import { stockRequestsAPI } from '../../services/api';
import Loading from '../../components/common/Loading';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import { toAbsoluteImageUrl, PLACEHOLDER_PRODUCT } from '../../utils/imageUrl';

const SupplierInventory = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });

  const fetchInventory = async (page = 1) => {
    try {
      setLoading(true);
      const res = await stockRequestsAPI.getSupplierInventory({ per_page: 15, page });
      setProducts(res.data.data || []);
      setMeta(res.data.meta || { current_page: 1, last_page: 1, total: 0 });
    } catch (error) {
      console.error('Failed to load supplier inventory:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory(1);
  }, []);

  const getInShopBadge = (p) => {
    const stockQuantity = Number(p.stock_quantity ?? 0);
    const threshold = Number(p.low_stock_threshold ?? 0);

    if (stockQuantity === 0) return <Badge variant="danger">Out of stock</Badge>;
    if (stockQuantity <= threshold) return <Badge variant="warning">Low stock</Badge>;
    return <Badge variant="success">In stock</Badge>;
  };

  if (loading) return <Loading />;

  const lowStockCount = products.filter(
    (p) => Number(p.stock_quantity ?? 0) > 0 && Number(p.stock_quantity ?? 0) <= Number(p.low_stock_threshold ?? 0)
  ).length;
  const outOfStockCount = products.filter((p) => Number(p.stock_quantity ?? 0) === 0).length;
  const inStockCount = products.length - lowStockCount - outOfStockCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
        <Link to="/supplier/stock-requests" className="text-sm text-primary-600 hover:text-primary-700">
          View stock requests
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FaCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{inStockCount}</p>
              <p className="text-sm text-gray-500">In Shop OK</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FaExclamationTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{lowStockCount}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <FaMinus className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{outOfStockCount}</p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-700">
              <FaWarehouse className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">What to watch</h2>
              <p className="text-sm text-gray-600">
                Admin requests stock when the product is <span className="font-medium">Low Stock</span> or{" "}
                <span className="font-medium">Out of Stock</span> in the shop. Pending requests below show what admins
                already asked you for.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier Available</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">In Shop</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warehouse</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending Requests</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                    No inventory items found.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={toAbsoluteImageUrl(p.thumbnail)}
                          alt={p.name}
                          className="w-12 h-12 object-cover rounded-lg"
                          onError={(e) => {
                            if (e.target.src !== PLACEHOLDER_PRODUCT) e.target.src = PLACEHOLDER_PRODUCT;
                          }}
                        />
                        <div>
                          <p className="font-medium text-gray-800">{p.name}</p>
                          <p className="text-sm text-gray-500">
                            {p.pending_quantity > 0 ? (
                              <span className="text-amber-700 font-medium">{p.pending_quantity} requested</span>
                            ) : (
                              <span className="text-gray-400">No pending request</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{p.sku}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{p.supplier_stock_quantity ?? 0}</td>
                    <td className="px-6 py-4 font-medium">
                      <span
                        className={
                          Number(p.stock_quantity ?? 0) === 0
                            ? 'text-red-600 font-bold'
                            : Number(p.stock_quantity ?? 0) <= Number(p.low_stock_threshold ?? 0)
                              ? 'text-yellow-600 font-bold'
                              : 'text-green-600 font-bold'
                        }
                      >
                        {p.stock_quantity ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{p.inventory_stock ?? 0}</td>
                    <td className="px-6 py-4 text-gray-600">{p.low_stock_threshold ?? 0}</td>
                    <td className="px-6 py-4">
                      {Number(p.pending_quantity ?? 0) > 0 ? (
                        <Badge variant="warning">Pending: {p.pending_quantity}</Badge>
                      ) : (
                        <Badge variant="default">—</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">{getInShopBadge(p)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t">
          <Pagination
            currentPage={meta.current_page}
            totalPages={meta.last_page}
            onPageChange={(p) => fetchInventory(p)}
          />
        </div>
      </div>
    </div>
  );
};

export default SupplierInventory;

