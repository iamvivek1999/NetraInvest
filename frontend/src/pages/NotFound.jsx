/**
 * src/pages/NotFound.jsx
 * 404 page shown for any unmatched route.
 */

import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="not-found animate-fade-in">
      <div className="not-found__code">404</div>
      <h2 style={{ marginTop: '1rem' }}>Page not found</h2>
      <p style={{ marginTop: '0.75rem', marginBottom: '2rem' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Link to="/"        className="btn btn--primary">Go Home</Link>
        <Link to="/discover" className="btn btn--secondary">Browse Campaigns</Link>
      </div>
    </div>
  );
}
