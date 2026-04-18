/**
 * src/layouts/AppShell.jsx
 * Wraps all pages with Navbar + page content + Footer.
 * Used as the parent <Route element> so every child route gets Navbar/Footer.
 */

import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function AppShell() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
