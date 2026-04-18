/**
 * src/router/ProtectedRoute.jsx
 *
 * Redirects unauthenticated users to /login.
 * Wrap any route element that requires authentication:
 *
 *   <Route path="/dashboard/*" element={
 *     <ProtectedRoute>
 *       <DashboardRouter />
 *     </ProtectedRoute>
 *   } />
 */

import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuthStore();
  const location       = useLocation();

  if (!isLoggedIn) {
    // Preserve the attempted URL so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
