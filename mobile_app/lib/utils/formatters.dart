/// formatters.dart — Enigma Invest
///
/// Shared number and date formatting utilities.
/// All monetary values use the Indian number system (en-IN locale).
///
/// Usage:
///   import '../utils/formatters.dart';
///   text = formatINR(150000);   // → '₹1,50,000'
///   text = compactINR(1500000); // → '₹15.0L'
library;

import 'package:intl/intl.dart';

// ─── Private singleton formatters (lazy-init) ─────────────────────────────────

final _inrFull = NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: 0,
);

final _inrDecimal = NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: 2,
);

final _dateFormatter = DateFormat('dd MMM yyyy');
final _dateTimeFormatter = DateFormat('dd MMM yyyy, hh:mm a');

// ─── Public API ───────────────────────────────────────────────────────────────

/// Format a monetary value in Indian Rupees with full Indian grouping.
/// e.g. 150000 → '₹1,50,000'   |   1250000 → '₹12,50,000'
String formatINR(num? amount, {bool decimals = false}) {
  if (amount == null) return '—';
  return decimals
      ? _inrDecimal.format(amount)
      : _inrFull.format(amount);
}

/// Compact INR for stat cards.
/// e.g. 15000000 → '₹1.50Cr'   |   500000 → '₹5.00L'   |   5000 → '₹5.0K'
String compactINR(num? amount) {
  if (amount == null) return '—';
  final n = amount.toDouble();
  if (n >= 1e7) return '₹${(n / 1e7).toStringAsFixed(2)}Cr';
  if (n >= 1e5) return '₹${(n / 1e5).toStringAsFixed(2)}L';
  if (n >= 1e3) return '₹${(n / 1e3).toStringAsFixed(1)}K';
  return formatINR(amount);
}

/// Format a percentage. e.g. 0.75 → '75%'
String formatPercent(double? value) {
  if (value == null) return '—';
  return '${(value * 100).clamp(0, 100).toStringAsFixed(0)}%';
}

/// Format a date. e.g. '2026-04-18T...' → '18 Apr 2026'
String formatDate(dynamic date) {
  if (date == null) return '—';
  try {
    final dt = date is DateTime ? date : DateTime.parse(date.toString());
    return _dateFormatter.format(dt);
  } catch (_) {
    return '—';
  }
}

/// Format a date + time. e.g. '18 Apr 2026, 02:30 PM'
String formatDateTime(dynamic date) {
  if (date == null) return '—';
  try {
    final dt = date is DateTime ? date : DateTime.parse(date.toString());
    return _dateTimeFormatter.format(dt);
  } catch (_) {
    return '—';
  }
}

/// Days remaining until deadline. Returns 0 if past.
int daysRemaining(dynamic deadline) {
  if (deadline == null) return 0;
  try {
    final dt = deadline is DateTime
        ? deadline
        : DateTime.parse(deadline.toString());
    final diff = dt.difference(DateTime.now()).inDays;
    return diff < 0 ? 0 : diff;
  } catch (_) {
    return 0;
  }
}

/// Funding progress [0.0 – 1.0]. Capped at 1.0.
double fundingProgress(num? raised, num? goal) {
  if (goal == null || goal <= 0) return 0.0;
  return ((raised ?? 0) / goal).clamp(0.0, 1.0);
}
