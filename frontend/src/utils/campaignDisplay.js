/**
 * Normalizes campaign status for UI when API omits derived fields (back-compat).
 */
export function getCampaignViewStatus(c) {
  if (!c) return 'unknown';
  return (
    c.status ??
    c.displayStatus ??
    (c.onChainStatus && c.onChainStatus !== 'unregistered'
      ? c.onChainStatus
      : c.localStatus) ??
    'unknown'
  );
}
