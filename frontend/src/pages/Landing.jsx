/**
 * src/pages/Landing.jsx
 * Netra — Transparent Investment Ecosystem
 * "The Sovereign Institution" design system
 *
 * Sections:
 *   1. Hero — Live TVL ticker, headline, CTAs
 *   2. Trust Strip — Key metrics
 *   3. How It Works — 3-step process
 *   4. Featured Startups — Credibility score cards (API or demo)
 *   5. Blockchain Transparency — Feature showcase
 *   6. CTA Band — Final conversion
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listCampaigns } from '../api/campaigns.api';
import { fundingPercent, daysRemaining } from '../utils/formatters';

/* ─── Animated counter hook ─────────────────────────────────────── */
function useCountUp(target, duration = 2000, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

/* ─── Demo startup data (shown when API returns nothing) ────────── */
const DEMO_STARTUPS = [
  {
    _id: 'd1', title: 'NovaMed AI', summary: 'AI-powered diagnostics platform reducing misdiagnosis by 87% across rural India.',
    currentRaised: 1800000, fundingGoal: 3000000, investorCount: 142, deadline: new Date(Date.now() + 38 * 864e5).toISOString(),
    credibility: 94, industry: 'HealthTech', stage: 'Series A', badge: '⬡ KYB Verified',
    color: '#10b981',
  },
  {
    _id: 'd2', title: 'ChainVault', summary: 'Decentralised escrow infrastructure for cross-border B2B payments, audited by CertiK.',
    currentRaised: 2750000, fundingGoal: 4000000, investorCount: 218, deadline: new Date(Date.now() + 22 * 864e5).toISOString(),
    credibility: 91, industry: 'DeFi', stage: 'Series B', badge: '⬡ Audited',
    color: '#6366f1',
  },
  {
    _id: 'd3', title: 'EcoGrid', summary: 'Peer-to-peer renewable energy trading network with on-chain carbon credit issuance.',
    currentRaised: 920000, fundingGoal: 2500000, investorCount: 88, deadline: new Date(Date.now() + 54 * 864e5).toISOString(),
    credibility: 87, industry: 'CleanTech', stage: 'Seed', badge: '⬡ Smart Contract',
    color: '#14b8a6',
  },
];

/* ─── Credibility Ring SVG ──────────────────────────────────────── */
function CredibilityRing({ score, color = '#10b981', size = 64 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  );
}

/* ─── Live Pulse Dot ────────────────────────────────────────────── */
function PulseDot({ color = '#10b981' }) {
  return (
    <span className="pulse-dot" style={{ '--pd-color': color }}>
      <span className="pulse-dot__ring" />
    </span>
  );
}

export default function Landing() {
  const [heroVisible, setHeroVisible] = useState(false);
  const heroRef = useRef(null);

  // Start animations when hero is visible
  useEffect(() => {
    const timer = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Animated TVL counter
  const tvlCount = useCountUp(234891432, 2500, heroVisible);

  // Silently fetch top 3 active campaigns
  const { data } = useQuery({
    queryKey: ['campaigns', 'featured'],
    queryFn: () => listCampaigns({ status: 'active', limit: 3, sortBy: 'raised' }),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const featured = data?.campaigns?.length > 0 ? data.campaigns : DEMO_STARTUPS;
  const isDemo = !(data?.campaigns?.length > 0);

  return (
    <div className="landing">

      {/* ══════════════════════════════════════════════════════════
          SECTION 1 · HERO
      ══════════════════════════════════════════════════════════ */}
      <section className="hero-sovereign" ref={heroRef}>
        {/* Background mesh */}
        <div className="hero-sovereign__mesh" aria-hidden />
        <div className="hero-sovereign__orb hero-sovereign__orb--1" aria-hidden />
        <div className="hero-sovereign__orb hero-sovereign__orb--2" aria-hidden />

        <div className="hero-sovereign__inner">

          {/* Left column */}
          <div className={`hero-sovereign__copy ${heroVisible ? 'hero-sovereign__copy--visible' : ''}`}>

            <div className="hero-sovereign__kicker">
              <PulseDot />
              <span>Live on Polygon · Transparent Audit Layer</span>
            </div>

            <h1 className="hero-sovereign__title">
              Where Trust is<br />
              <span className="text-gradient-emerald">Verified</span><br />
              On‑Chain.
            </h1>

            <p className="hero-sovereign__subtitle">
              Every investment recorded on Polygon. Every milestone
              tracked transparently. Connect your wallet, discover
              verified campaigns, and own a piece of the future — with
              institutional-grade accountability.
            </p>

            <div className="hero-sovereign__ctas">
              <Link to="/discover" className="btn-sovereign btn-sovereign--primary">
                🔍 Discover Campaigns
                <span className="btn-sovereign__arrow">→</span>
              </Link>
              <Link to="/auth/role?mode=signup" className="btn-sovereign btn-sovereign--ghost">
                🚀 Launch Your Startup
              </Link>
            </div>

            {/* Wallet strip */}
            <div className="hero-sovereign__wallets">
              <span className="hero-sovereign__wallets-label">Supported</span>
              {['🦊 MetaMask', '🔵 WalletConnect', '💳 Razorpay'].map(w => (
                <span key={w} className="wallet-pill">{w}</span>
              ))}
            </div>
          </div>

          {/* Right column — TVL card + mini stats */}
          <div className={`hero-sovereign__visual ${heroVisible ? 'hero-sovereign__visual--visible' : ''}`}>

            {/* TVL Glass Card */}
            <div className="tvl-card">
              <div className="tvl-card__header">
                <PulseDot />
                <span className="tvl-card__label">Total Value Locked</span>
              </div>
              <div className="tvl-card__value">
                ₹{tvlCount.toLocaleString('en-IN')}
              </div>
              <div className="tvl-card__sub">+12.4% this month · 847 active investors</div>

              <div className="tvl-card__chart" aria-hidden>
                {[40, 55, 45, 70, 60, 85, 75, 92, 88, 100].map((h, i) => (
                  <span key={i} className="tvl-card__bar" style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>

              <div className="tvl-card__stats">
                {[
                  { value: '847', label: 'Startups' },
                  { value: '99.2%', label: 'Accuracy' },
                  { value: '₹23+ Cr', label: 'Deployed' },
                ].map(s => (
                  <div key={s.label} className="tvl-card__stat">
                    <span className="tvl-card__stat-value">{s.value}</span>
                    <span className="tvl-card__stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating verified badge */}
            <div className="hero-sovereign__badge">
              <span>⬡</span>
              <div>
                <div className="hero-sovereign__badge-title">Verified on Chain</div>
                <div className="hero-sovereign__badge-sub">CertiK · Polygon · KYB</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 2 · TRUST METRICS STRIP
      ══════════════════════════════════════════════════════════ */}
      <section className="trust-strip">
        <div className="container">
          <div className="trust-strip__grid">
            {[
              { icon: '🚀', value: '847+', label: 'Verified Startups' },
              { icon: '💰', value: '₹23+ Cr', label: 'Total Invested' },
              { icon: '🌐', value: '100%', label: 'On-Chain Transparency' },
              { icon: '⚡', value: '99.2%', label: 'Milestone Accountability' },
              { icon: '🛡️', value: 'Escrow', label: 'Milestone-gated releases' },
              { icon: '👥', value: '12,400+', label: 'Active Investors' },
            ].map((s) => (
              <div className="trust-strip__item" key={s.label}>
                <span className="trust-strip__icon">{s.icon}</span>
                <span className="trust-strip__value">{s.value}</span>
                <span className="trust-strip__label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 3 · HOW IT WORKS
      ══════════════════════════════════════════════════════════ */}
      <section className="how-sovereign">
        <div className="container">
          <div className="how-sovereign__header">
            <span className="section-kicker">Process</span>
            <h2 className="how-sovereign__title">Built for Institutional Trust</h2>
            <p className="how-sovereign__sub">
              Three steps to transparent, blockchain-backed investment.
            </p>
          </div>

          <div className="how-sovereign__steps">
            {[
              {
                step: '01', emoji: '🔍', color: '#10b981',
                title: 'Discover & Verify',
                desc: 'Browse KYB-verified startup campaigns. Every campaign is audited and registered on Polygon before accepting a single rupee.',
                tags: ['KYB Verified', 'Smart Contract', 'CertiK Audit'],
              },
              {
                step: '02', emoji: '💼', color: '#6366f1',
                title: 'Invest Securely',
                desc: 'Choose an amount, connect your wallet or pay via Razorpay. Funds go into a smart contract escrow — not to the founder directly.',
                tags: ['MetaMask', 'Razorpay', 'Escrow'],
              },
              {
                step: '03', emoji: '✨', color: '#14b8a6',
                title: 'Track Transparently',
                desc: 'Monitor milestone progress on your dashboard. Funds are disbursed only when milestones are verified and approved by investors.',
                tags: ['On-Chain', 'Milestone Gated', 'Investor Vote'],
              },
            ].map((step) => (
              <div className="how-step" key={step.step}>
                <div className="how-step__number" style={{ color: step.color }}>{step.step}</div>
                <div className="how-step__emoji">{step.emoji}</div>
                <h3 className="how-step__title">{step.title}</h3>
                <p className="how-step__desc">{step.desc}</p>
                <div className="how-step__tags">
                  {step.tags.map(t => (
                    <span key={t} className="how-step__tag" style={{ '--step-color': step.color }}>
                      ⬡ {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 4 · FEATURED STARTUPS
      ══════════════════════════════════════════════════════════ */}
      <section className="featured-sovereign">
        <div className="container">
          <div className="featured-sovereign__header">
            <div>
              <span className="section-kicker">Verified Profiles</span>
              <h2 className="featured-sovereign__title">
                Institutional-Grade Startups
              </h2>
            </div>
            <Link to="/discover" className="btn-sovereign btn-sovereign--outline">
              View all →
            </Link>
          </div>

          {isDemo && (
            <div className="demo-notice">
              <span>🔔</span>
              <span>
                Showing sample cards because no live listings matched —{' '}
                <Link to="/register">create a startup profile</Link> or{' '}
                <Link to="/discover">open Discover</Link> for real campaigns.
              </span>
            </div>
          )}

          <div className="startup-cards-grid">
            {featured.map((c) => {
              const pct = isDemo ? Math.round((c.currentRaised / c.fundingGoal) * 100) : fundingPercent(c.currentRaised, c.fundingGoal);
              const days = isDemo ? Math.round((new Date(c.deadline) - Date.now()) / 864e5) : daysRemaining(c.deadline);
              const color = c.color || '#10b981';
              const score = c.credibilityScore ?? c.credibility ?? 88;
              const industry = c.startupProfileId?.industry || c.sector || 'Startup';
              const stageLabel = c.fundingStage ? String(c.fundingStage).replace(/-/g, ' ') : '';
              const badge =
                c.startupProfileId?.isVerified ? '⬡ KYB Verified' : c.badge || '⬡ Listed';
              return (
                <Link
                  to={isDemo ? '/discover' : `/campaigns/${c._id}`}
                  key={c._id}
                  className="startup-card"
                  style={{ '--card-accent': color }}
                >
                  {/* Credibility score */}
                  <div className="startup-card__score">
                    <div className="startup-card__ring">
                      <CredibilityRing score={score} color={color} size={64} />
                      <span className="startup-card__ring-value" style={{ color }}>{score}</span>
                    </div>
                    <div>
                      <div className="startup-card__score-label">Credibility Score</div>
                      <div className="startup-card__badge">{badge}</div>
                    </div>
                  </div>

                  <h3 className="startup-card__title">{c.title}</h3>

                  <div className="startup-card__meta">
                    <span className="startup-card__industry">{industry}</span>
                    {stageLabel && <span className="startup-card__stage">{stageLabel}</span>}
                  </div>

                  <p className="startup-card__desc">{c.summary}</p>

                  {/* Funding progress */}
                  <div className="startup-card__progress-wrap">
                    <div className="startup-card__progress-bar">
                      <div
                        className="startup-card__progress-fill"
                        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
                      />
                    </div>
                    <div className="startup-card__progress-meta">
                      <span style={{ color }}>{pct}% funded</span>
                      <span>₹{(c.currentRaised ?? 0).toLocaleString('en-IN')} / ₹{(c.fundingGoal).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="startup-card__footer">
                    <span>👥 {c.investorCount ?? 0} investors</span>
                    <span>{days === 0 ? '⌛ Ended' : `⏰ ${days}d left`}</span>
                  </div>

                  <div className="startup-card__cta">
                    View Campaign <span>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 5 · BLOCKCHAIN TRANSPARENCY
      ══════════════════════════════════════════════════════════ */}
      <section className="transparency-sovereign">
        <div className="container">
          <div className="transparency-sovereign__grid">

            {/* Left — copy */}
            <div className="transparency-sovereign__copy">
              <span className="section-kicker">Blockchain Infrastructure</span>
              <h2 className="transparency-sovereign__title">
                Every Transaction.<br />
                <span className="text-gradient-emerald">On‑Chain. Verified.</span>
              </h2>
              <p className="transparency-sovereign__sub">
                Netra is built on Polygon — a low-fee, high-speed Ethereum sidechain.
                Every investment, milestone approval, and fund disbursement is recorded
                as an immutable transaction. No black boxes.
              </p>

              <div className="transparency-sovereign__features">
                {[
                  { icon: '🔐', title: 'Smart Contract Escrow', desc: 'Funds locked until milestones are independently verified.' },
                  { icon: '🗳️', title: 'Investor Voting', desc: '51% threshold required to approve milestone fund release.' },
                  { icon: '📋', title: 'Immutable Audit Trail', desc: 'Every tx hash public on Polygon. Search it yourself.' },
                  { icon: '⚡', title: 'Real-Time Sync', desc: 'Dashboard updates within seconds of on-chain confirmation.' },
                ].map(f => (
                  <div key={f.title} className="transparency-feature">
                    <span className="transparency-feature__icon">{f.icon}</span>
                    <div>
                      <div className="transparency-feature__title">{f.title}</div>
                      <div className="transparency-feature__desc">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — mock blockchain card */}
            <div className="transparency-sovereign__visual">
              <div className="blockchain-card">
                <div className="blockchain-card__header">
                  <PulseDot />
                  <span>Polygon Amoy · Live</span>
                  <span className="blockchain-card__net">Testnet</span>
                </div>

                <div className="blockchain-card__block">
                  <div className="blockchain-card__label">Latest Block</div>
                  <div className="blockchain-card__value">#47,291,884</div>
                </div>

                <div className="blockchain-card__txs">
                  {[
                    { type: 'INVEST', amount: '₹50,000', addr: '0x7f3a...9b2c', status: 'Confirmed', color: '#10b981' },
                    { type: 'APPROVE', amount: 'M2 Vote', addr: '0x4c1e...3f8a', status: 'Pending', color: '#f59e0b' },
                    { type: 'RELEASE', amount: '₹1.2M', addr: '0x9d7b...2e1c', status: 'Confirmed', color: '#10b981' },
                    { type: 'KYB', amount: 'Verified', addr: '0x2a8f...7d4b', status: 'On-chain', color: '#6366f1' },
                  ].map((tx, i) => (
                    <div key={i} className="blockchain-tx">
                      <span className="blockchain-tx__type" style={{ color: tx.color }}>{tx.type}</span>
                      <span className="blockchain-tx__addr">{tx.addr}</span>
                      <span className="blockchain-tx__amount">{tx.amount}</span>
                      <span className="blockchain-tx__status" style={{ color: tx.color }}>● {tx.status}</span>
                    </div>
                  ))}
                </div>

                <div className="blockchain-card__contract">
                  <span className="blockchain-card__contract-label">Contract</span>
                  <span className="blockchain-card__contract-addr">0xNetra...3f2d · Polygon</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SECTION 6 · FINAL CTA BAND
      ══════════════════════════════════════════════════════════ */}
      <section className="cta-sovereign">
        <div className="cta-sovereign__glow" aria-hidden />
        <div className="container container--narrow">
          <div className="cta-sovereign__inner">
            <span className="section-kicker">Get Started</span>
            <h2 className="cta-sovereign__title">
              Fund the Future.<br />
              <span className="text-gradient-emerald">Transparently.</span>
            </h2>
            <p className="cta-sovereign__sub">
              Create your account, connect your wallet, and start investing in
              blockchain-verified startups today — with full on-chain accountability.
            </p>
            <div className="cta-sovereign__actions">
              <Link to="/auth/role?mode=signup" className="btn-sovereign btn-sovereign--primary btn-sovereign--lg">
                Create Account →
              </Link>
              <Link to="/discover" className="btn-sovereign btn-sovereign--ghost btn-sovereign--lg">
                Browse Campaigns
              </Link>
            </div>
            <div className="cta-sovereign__trust">
              {['⬡ KYB Verified', '⬡ CertiK Audited', '⬡ Polygon Secured', '⬡ SEBI Compliant'].map(t => (
                <span key={t} className="cta-sovereign__trust-item">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
