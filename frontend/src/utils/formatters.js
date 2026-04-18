/**
 * src/utils/formatters.js
 * Display formatting utilities. Pure functions — no imports.
 */

/**
 * Format an INR amount with Indian grouping system.
 * e.g. 150000 → "₹1,50,000"   |   1250000 → "₹12,50,000"
 */
export const formatINR = (amount, decimals = 0) => {
  if (amount == null || isNaN(amount)) return '—';
  return `₹${parseFloat(amount).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

/**
 * Compact INR for dashboard stat cards.
 * e.g. 1500000 → "₹15L"   |   10000000 → "₹1Cr"   |   50000 → "₹50K"
 */
export const compactINR = (amount) => {
  if (amount == null || isNaN(amount)) return '—';
  const n = parseFloat(amount);
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
};

/** Shorten an Ethereum address → "0x1234...abcd" */
export const shortenAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/** Format a date string or Date → "Apr 16, 2026" */
export const formatDate = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day:   'numeric',
  }).format(new Date(date));
};

/** Number of days remaining until a deadline. Returns 0 if past. */
export const daysRemaining = (deadline) => {
  if (!deadline) return 0;
  const diff = new Date(deadline) - new Date();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
};

/** Funding percentage (raised / goal × 100), capped at 100. */
export const fundingPercent = (raised, goal) => {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round((raised / goal) * 100));
};

/** Compact number → "1.2k", "3.5M" (generic, non-INR) */
export const compactNumber = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};
