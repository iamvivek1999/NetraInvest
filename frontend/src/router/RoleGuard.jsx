/**
 * src/router/RoleGuard.jsx
 *
 * Restricts access to a specific role.
 * Must be used INSIDE a ProtectedRoute (assumes user is authenticated).
 *
 * @prop {string|string[]} role - required role(s), e.g. "startup" or ["startup","admin"]
 * @prop {ReactNode}       children
 * @prop {string}          [fallback="/dashboard"] - redirect destination if role mismatch
 *
 * Usage:
 *   <RoleGuard role="startup">
 *     <CampaignManager />
 *   </RoleGuard>
 *
 *   <RoleGuard role={["startup","admin"]}>
 *     <AdminMilestones />
 *   </RoleGuard>
 */

import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

function RoleGuard({ role, children, fallback = '/dashboard' }) {
  const { role: userRole, isLoggedIn } = useAuthStore();

  // Belt-and-suspenders: redirect to login if somehow not authenticated
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  const allowed = Array.isArray(role) ? role : [role];

  if (!allowed.includes(userRole)) {
    return <Navigate to={fallback} replace />;
  }

  return children;
}

export default RoleGuard;
