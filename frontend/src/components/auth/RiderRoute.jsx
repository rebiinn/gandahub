import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loading from '../common/Loading';

const RiderRoute = ({ children }) => {
  const { isAuthenticated, isRider, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Allow both riders and admins to access rider routes
  if (!isRider && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RiderRoute;
