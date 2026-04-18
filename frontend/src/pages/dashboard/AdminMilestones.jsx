/**
 * src/pages/dashboard/AdminMilestones.jsx
 *
 * Admin view for managing milestone lifecycle (approve, reject, disburse).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { listCampaigns } from '../../api/campaigns.api';
import { getMilestones, approveMilestone, rejectMilestone, markDisbursed } from '../../api/milestones.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const MILESTONE_STATUS_META = {
  pending:   { color: 'var(--color-text-muted)', label: 'Pending'    },
  submitted: { color: 'var(--color-warning)',    label: 'Submitted'  },
  approved:  { color: 'var(--color-success)',    label: 'Approved'   },
  rejected:  { color: 'var(--color-error)',      label: 'Rejected'   },
  disbursed: { color: 'var(--color-secondary)',  label: 'Disbursed 💸' },
};

// ─── Sub-Components ─────────────────────────────────────────────────────────

function RejectionModal({ milestone, campaignId, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error('Rejection reason is required');
    setLoading(true);
    try {
      await rejectMilestone(campaignId, milestone._id, reason);
      toast.success('Milestone rejected.');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reject milestone.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 450, background: 'var(--color-bg)' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Reject Proof: {milestone.title}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Rejection Reason</label>
            <textarea 
              className="form-input" 
              rows="4" 
              placeholder="Why is this proof insufficient?"
              value={reason} onChange={e => setReason(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" style={{ background: 'var(--color-error)' }} disabled={loading}>
              {loading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampaignMilestoneView({ campaign, onBack }) {
  const [rejectTarget, setRejectTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const { data: milestones = [], isLoading, refetch } = useQuery({
    queryKey: ['campaignMilestones', campaign._id],
    queryFn: () => getMilestones(campaign._id)
  });

  const handleApprove = async (msId) => {
    setActionLoading(msId + 'approve');
    try {
      await approveMilestone(campaign._id, msId);
      toast.success('Milestone approved! Now pending disbursal.');
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisburse = async (msId) => {
    setActionLoading(msId + 'disburse');
    try {
      await markDisbursed(campaign._id, msId);
      toast.success(`Milestone marked as disbursed!`);
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark disbursed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <button className="btn btn--outline btn--sm" onClick={onBack} style={{ marginBottom: '1.5rem' }}>
        ← Back to Campaigns
      </button>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Reviewing: {campaign.title}</h2>
        <p className="text-muted text-sm" style={{ marginTop: '0.4rem' }}>
          Current Milestone: #{campaign.currentMilestoneIndex + 1} of {campaign.milestoneCount}
        </p>
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto', width: 30, height: 30, borderWidth: 3 }} />
        </div>
      ) : milestones.length === 0 ? (
        <div className="empty-state">
           <span className="empty-state__emoji">📭</span>
           <p className="empty-state__title">No milestones found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {milestones.map((ms, i) => {
            const meta = MILESTONE_STATUS_META[ms.status] || MILESTONE_STATUS_META.pending;
            return (
              <div key={ms._id} className="card" style={{ padding: '1.25rem', border: ms.status === 'submitted' ? '1px solid var(--color-warning)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>#{i + 1}: {ms.title}</h3>
                    <p style={{ margin: '0.2rem 0', fontSize: '0.85rem' }}>{ms.percentage}% • {ms.estimatedAmount} {campaign.currency}</p>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: meta.color, background: 'rgba(0,0,0,0.1)', padding: '0.2rem 0.5rem', borderRadius: 99 }}>
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {ms.status === 'submitted' && (
                      <>
                        <button className="btn btn--outline btn--sm" style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }} onClick={() => setRejectTarget(ms)}>
                          Reject
                        </button>
                        <button className="btn btn--primary btn--sm" style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }} disabled={actionLoading === ms._id + 'approve'} onClick={() => handleApprove(ms._id)}>
                          {actionLoading === ms._id + 'approve' ? 'Approving...' : 'Approve'}
                        </button>
                      </>
                    )}
                    {ms.status === 'approved' && (
                      <button className="btn btn--primary btn--sm" disabled={actionLoading === ms._id + 'disburse'} onClick={() => handleDisburse(ms._id)}>
                        {actionLoading === ms._id + 'disburse' ? 'Marking Disbursed...' : 'Mark Disbursed 💸'}
                      </button>
                    )}
                  </div>
                </div>

                {ms.proofSubmission && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--r-md)', fontSize: '0.875rem' }}>
                    <strong>Proof of Work:</strong>
                    <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>{ms.proofSubmission.description}</p>
                    {ms.proofSubmission.proofLinks?.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <strong>Links:</strong>
                        <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.5rem' }}>
                          {ms.proofSubmission.proofLinks.map((l, idx) => (
                            <li key={idx}><a href={l} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>{l}</a></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {ms.rejectionReason && ms.status === 'rejected' && (
                   <div style={{ marginTop: '1rem', padding: '0.75rem', borderLeft: '4px solid var(--color-error)', background: 'rgba(239,68,68,0.05)', fontSize: '0.85rem' }}>
                     <strong>Rejection Reason:</strong> {ms.rejectionReason}
                   </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rejectTarget && (
        <RejectionModal 
          milestone={rejectTarget} 
          campaignId={campaign._id} 
          onClose={() => setRejectTarget(null)} 
          onSuccess={() => { setRejectTarget(null); refetch(); }} 
        />
      )}
    </div>
  );
}

// ─── Main Admin Component ───────────────────────────────────────────────────

export default function AdminMilestones() {
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // Fetch campaigns that could have milestones (active or funded)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin_campaigns'],
    queryFn: () => listCampaigns({ status: 'active,funded', limit: 100 })
  });

  if (selectedCampaign) {
    return <CampaignMilestoneView campaign={selectedCampaign} onBack={() => setSelectedCampaign(null)} />;
  }

  const campaigns = data?.campaigns || [];

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>⚙️ Admin — Milestone management</h2>
        <p className="text-muted text-sm" style={{ marginTop: '0.4rem' }}>
          Select an active or funded campaign to review proofs and mark milestones as disbursed.
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
             <div className="spinner" style={{ margin: '0 auto', width: 36, height: 36, borderWidth: 3 }} />
          </div>
        ) : isError ? (
           <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-error)' }}>Failed to load campaigns.</div>
        ) : campaigns.length === 0 ? (
           <div className="empty-state" style={{ padding: '4rem 1rem' }}>
             <span className="empty-state__emoji">📭</span>
             <p className="empty-state__title">No active campaigns</p>
           </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Campaign</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Milestone Progress</th>
                <th style={{ padding: '1rem', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{c.title}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', padding: '0.2rem 0.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: 99 }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {c.currentMilestoneIndex} / {c.milestoneCount} Disbursed
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button className="btn btn--outline btn--sm" onClick={() => setSelectedCampaign(c)}>
                      Review Milestones →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
