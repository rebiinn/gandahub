import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loading from '../common/Loading';

const SupplierRoute = ({ children }) => {
  const { isAuthenticated, isSupplier, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isSupplier) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default SupplierRoute;
