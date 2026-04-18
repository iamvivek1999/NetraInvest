/**
 * src/layouts/Footer.jsx
 */

import { Link } from 'react-router-dom';
import { APP_NAME } from '../utils/constants';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">

          {/* Brand */}
          <div className="footer__brand">
            <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
              ✦ {APP_NAME.split(' ')[0].toUpperCase()}
            </div>
            <p>Transparent, blockchain-backed startup investment. Every INR tracked on-chain.</p>
          </div>

          {/* Platform links */}
          <div className="footer__link-group">
            <span className="footer__link-title">Platform</span>
            <Link to="/discover"  className="footer__link">Discover Campaigns</Link>
            <Link to="/register"  className="footer__link">For Investors</Link>
            <Link to="/register"  className="footer__link">For Startups</Link>
          </div>

          {/* Resources */}
          <div className="footer__link-group">
            <span className="footer__link-title">Resources</span>
            <a href="https://amoy.polygonscan.com" target="_blank" rel="noreferrer" className="footer__link">
              Polygon Explorer ↗
            </a>
            <a href="https://metamask.io" target="_blank" rel="noreferrer" className="footer__link">
              MetaMask ↗
            </a>
          </div>

        </div>

        <div className="footer__bottom">
          <span className="footer__copy">
            © {year} {APP_NAME}. Built on Polygon Amoy. Hackathon MVP.
          </span>
          <span className="footer__copy" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: '#10b981' }}>●</span> Polygon Amoy Testnet
          </span>
        </div>
      </div>
    </footer>
  );
}
