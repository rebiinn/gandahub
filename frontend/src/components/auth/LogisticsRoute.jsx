import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loading from '../common/Loading';

const LogisticsRoute = ({ children }) => {
  const { isAuthenticated, isLogistics, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isLogistics) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default LogisticsRoute;

