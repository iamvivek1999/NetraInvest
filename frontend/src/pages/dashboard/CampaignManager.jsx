/**
 * src/pages/dashboard/CampaignManager.jsx
 *
 * Full campaign management view for a startup's own campaign.
 *
 * ── Sections ────────────────────────────────────────────────────────────────
 *  1. Status bar           — status badge, blockchain state, key dates
 *  2. Funding summary      — raised / goal / investor count progress
 *  3. Edit panel (draft)   — title, summary, deadline, tags  (locked when active)
 *  4. Activate panel       — wallet check → activate button → blockchain result
 *  5. Milestone list       — index, title, percentage, status for each
 *
 * ── Backend endpoints ───────────────────────────────────────────────────────
 *  GET    /api/v1/campaigns/:id             — load campaign
 *  GET    /api/v1/campaigns/:id/milestones  — load milestone list
 *  PATCH  /api/v1/campaigns/:id             — update editable draft fields
 *  PATCH  /api/v1/auth/wallet               — link wallet address
 *  POST   /api/v1/campaigns/:id/activate    — register transparency record
 *
 * ── Draft-editable fields ───────────────────────────────────────────────────
 *  title, summary, deadline, tags
 *  (fundingGoal / currency / milestoneCount locked after milestones are created)
 *
 * ── State handling ──────────────────────────────────────────────────────────
 *  draft   → yellow accent, edit panel open, activate CTA with pre-flight checks
 *  active  → green accent, edit panel collapsed (read-only), blockchain info shown
 *  paused  → amber accent, read-only, resume / cancel actions placeholder
 *  funded  → purple accent, read-only, milestone disbursal section visible
 *  cancelled / completed → grey, fully read-only
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link }      from 'react-router-dom';
import toast                                  from 'react-hot-toast';

import useAuthStore         from '../../store/authStore';
import { getCampaign, updateCampaign, activateCampaign } from '../../api/campaigns.api';
import { getMilestones, submitProof }    from '../../api/milestones.api';
import { linkWalletAddress } from '../../api/auth.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META = {
  draft:     { color: 'var(--color-warning)',   bg: 'rgba(245,158,11,0.1)',  label: 'Draft',     icon: '📝' },
  active:    { color: 'var(--color-success)',   bg: 'rgba(16,185,129,0.1)',  label: 'Active',    icon: '🟢' },
  paused:    { color: 'var(--color-warning)',   bg: 'rgba(245,158,11,0.1)',  label: 'Paused',    icon: '⏸️'  },
  funded:    { color: 'var(--color-secondary)', bg: 'rgba(139,92,246,0.1)', label: 'Funded',    icon: '🎉' },
  completed: { color: 'var(--color-primary)',   bg: 'rgba(99,102,241,0.1)', label: 'Completed', icon: '✅' },
  cancelled: { color: 'var(--color-error)',     bg: 'rgba(239,68,68,0.1)',  label: 'Cancelled', icon: '❌' },
};

const MILESTONE_STATUS_META = {
  pending:   { color: 'var(--color-text-muted)', label: 'Pending'    },
  submitted: { color: 'var(--color-warning)',    label: 'Submitted'  },
  approved:  { color: 'var(--color-success)',    label: 'Approved'   },
  rejected:  { color: 'var(--color-error)',      label: 'Rejected'   },
  disbursed: { color: 'var(--color-secondary)',  label: 'Disbursed 💸' },
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status, large = false }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span style={{
      fontSize:      large ? '0.82rem' : '0.7rem',
      fontWeight:    700,
      padding:       large ? '0.3rem 0.75rem' : '0.2rem 0.55rem',
      borderRadius:  99,
      background:    m.bg,
      color:         m.color,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      whiteSpace:    'nowrap',
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.83rem', marginBottom: '0.35rem', alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--color-text-muted)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>{value ?? '—'}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{subtitle}</p>}
    </div>
  );
}

// ─── Milestone row ────────────────────────────────────────────────────────────

function SubmitProofModal({ milestone, campaign, onClose, onSuccess }) {
  const [description, setDescription] = useState('');
  const [proofLinks, setProofLinks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    setSubmitting(true);
    try {
      const links = proofLinks.split(',').map(l => l.trim()).filter(Boolean);
      await submitProof(campaign._id, milestone._id, { description, proofLinks: links });
      toast.success('Proof submitted successfully!');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 500, background: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Submit Proof: {milestone.title}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ padding: '0.2rem 0.5rem' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Update Description</label>
            <textarea 
              className="form-input" 
              rows="4" 
              placeholder="Describe what was accomplished..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Proof Links (optional)</label>
            <input 
              className="form-input" 
              type="text" 
              placeholder="e.g., https://github.com/..., https://notion.so/..."
              value={proofLinks}
              onChange={e => setProofLinks(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit to Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MilestoneRow({ ms, idx, campaignStatus, onOpenSubmit }) {
  const meta = MILESTONE_STATUS_META[ms.status] || MILESTONE_STATUS_META.pending;
  const canSubmit = campaignStatus === 'active' && (ms.status === 'pending' || ms.status === 'rejected');

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '0.75rem',
      padding:      '0.7rem 0.9rem',
      borderRadius: 'var(--r-md)',
      background:   ms.status === 'disbursed' ? 'rgba(139,92,246,0.05)' : 'rgba(99,102,241,0.02)',
      border:       '1px solid var(--color-border)',
      marginBottom: '0.5rem',
      flexWrap:     'wrap',
    }}>
      {/* Index bubble */}
      <div style={{
        width: 28, height: 28,
        borderRadius: '50%',
        background: ms.status === 'disbursed'
          ? 'linear-gradient(135deg,var(--color-secondary),var(--color-primary))'
          : 'linear-gradient(135deg,var(--color-primary),var(--color-accent))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0,
      }}>
        {idx + 1}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ms.title}
        </div>
        <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
          {ms.percentage}% · ≈ {ms.estimatedAmount?.toFixed ? ms.estimatedAmount.toFixed(2) : ms.estimatedAmount} INR
          {ms.targetDate && ` · Target: ${new Date(ms.targetDate).toLocaleDateString()}`}
        </div>
      </div>

      {/* Status */}
      <span style={{
        fontSize: '0.72rem', fontWeight: 600,
        color: meta.color, flexShrink: 0,
        padding: '0.15rem 0.45rem',
        background: 'rgba(0,0,0,0.15)',
        borderRadius: 99,
      }}>
        {meta.label}
      </span>

      {/* Action */}
      {canSubmit && (
        <button 
          className="btn btn--outline btn--sm"
          onClick={() => onOpenSubmit(ms)}
          style={{
            fontSize: '0.72rem', color: 'var(--color-primary)',
            padding: '0.2rem 0.6rem',
            borderColor: 'var(--color-primary)',
            borderRadius: 99,
            whiteSpace: 'nowrap',
          }}>
          Submit Proof
        </button>
      )}
    </div>
  );
}

// ─── Activate Panel ───────────────────────────────────────────────────────────

function ActivatePanel({ campaign, user, onActivated }) {
  const [activating,      setActivating]      = useState(false);
  const [result,          setResult]          = useState(null); // { txHash, contractAddress, campaignKey, devMode }
  const [activationError, setActivationError] = useState(null);

  const hasMilestones = campaign.milestoneCount > 0; // proxy — actual count checked by backend



  const handleActivate = async () => {
    setActivating(true);
    setResult(null);
    setActivationError(null);
    try {
      const { campaign: updated, blockchain } = await activateCampaign(campaign._id);
      setResult(blockchain);
      const msg = blockchain.devMode
        ? '✅ Campaign activated! (Dev mode — no real blockchain call)'
        : '🚀 Campaign activated and transparency record fully registered on-chain!';
      toast.success(msg);
      onActivated(updated);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Activation failed.';
      setActivationError(msg);
      toast.error(msg, { duration: 6000 });
    } finally {
      setActivating(false);
    }
  };

  // ── Pre-flight checklist ────────────────────────────────────────────────────
  const checks = [
    { ok: campaign.status === 'draft',     label: 'Campaign is in draft status'      },
    { ok: hasMilestones,                   label: 'Milestones defined'               },
    { ok: new Date(campaign.deadline) > new Date(), label: 'Deadline is in the future' },
  ];
  const allChecksPassed = checks.every((c) => c.ok);

  if (result) {
    const isDevMode = result.devMode === true;
    return (
      <div style={{
        background:   isDevMode ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)',
        border:       `1px solid ${isDevMode ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.25)'}`,
        borderRadius: 'var(--r-lg)',
        padding:      '1.25rem',
      }}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: isDevMode ? 'var(--color-warning)' : 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isDevMode ? '🧪 Campaign ACTIVATED (Dev Mode)' : '✅ Campaign transparency log is LIVE'}
          {isDevMode && (
            <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.18)', color: 'var(--color-warning)', padding: '2px 7px', borderRadius: 99, fontFamily: 'monospace' }}>
              DEV_SKIP_BLOCKCHAIN=true
            </span>
          )}
        </div>
        {isDevMode && (
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            Campaign is active in the database. Transparency logging was skipped.<br />
            Set <code style={{fontSize:'0.75rem'}}>DEV_SKIP_BLOCKCHAIN=false</code> in your backend <code style={{fontSize:'0.75rem'}}>.env</code> and restart to use the real blockchain.
          </p>
        )}
        <InfoRow label="Tx Hash"          value={result.txHash}          mono />
        <InfoRow label="Contract Address" value={result.contractAddress} mono />
        <InfoRow label="Campaign Key"     value={result.campaignKey}     mono />
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        {checks.map((c, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.8rem', marginBottom: '0.3rem',
            color: c.ok ? 'var(--color-success)' : 'var(--color-text-muted)',
          }}>
            <span>{c.ok ? '✅' : '⬜'}</span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Activate button */}
      <button
        className="btn btn--primary"
        onClick={handleActivate}
        disabled={!allChecksPassed || activating}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {activating
          ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8 }} />Registering transparency log…</>
          : '⚡ Activate Campaign'}
      </button>

      {!allChecksPassed && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.6rem', textAlign: 'center' }}>
          Complete all checklist items above to enable activation.
        </p>
      )}

      {/* Inline activation error — shown in panel, not just toast */}
      {activationError && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.6rem 0.9rem',
          borderRadius: 'var(--r-md)',
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.25)',
          fontSize: '0.8rem',
          color: 'var(--color-error)',
        }}>
          <strong>Activation failed:</strong> {activationError}
        </div>
      )}

      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
        ℹ️ Activation logs the campaign to the immutable audit registry on Polygon Amoy.
        Requires the backend to have a funded admin wallet and a valid RPC URL.
        <br />
        <em>For local testing, set <code style={{fontSize:'0.7rem'}}>DEV_SKIP_BLOCKCHAIN=true</code> in your backend <code style={{fontSize:'0.7rem'}}>.env</code>.</em>
      </p>

    </>
  );
}

// ─── Edit Panel ───────────────────────────────────────────────────────────────

function EditPanel({ campaign, onSaved }) {
  const [form,   setForm]   = useState({
    title:    campaign.title    || '',
    summary:  campaign.summary  || '',
    deadline: campaign.deadline ? campaign.deadline.slice(0, 10) : '',
    tags:     (campaign.tags || []).join(', '),
  });
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState({});

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title.trim())                               e.title    = 'Title is required.';
    if (form.title.trim().length > 120)                   e.title    = 'Max 120 characters.';
    if (!form.summary.trim())                             e.summary  = 'Summary is required.';
    if (form.summary.trim().length < 30)                  e.summary  = 'Min 30 characters.';
    if (form.summary.trim().length > 500)                 e.summary  = 'Max 500 characters.';
    if (!form.deadline)                                   e.deadline = 'Deadline is required.';
    else if (new Date(form.deadline) <= new Date(Date.now() + 24 * 60 * 60 * 1000))
                                                          e.deadline = 'Must be > 24h from now.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const tagsArr = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      const updated = await updateCampaign(campaign._id, {
        title:    form.title.trim(),
        summary:  form.summary.trim(),
        deadline: new Date(form.deadline).toISOString(),
        tags:     tagsArr,
      });
      toast.success('✅ Campaign updated.');
      onSaved(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="form-group">
        <label className="form-label">Title <span style={{ color: 'var(--color-error)' }}>*</span></label>
        <input className="form-input" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} />
        {errors.title && <span className="form-error">{errors.title}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">
          Summary <span style={{ color: 'var(--color-error)' }}>*</span>
          <span style={{ fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {form.summary.length}/500
          </span>
        </label>
        <textarea
          className="form-input"
          rows={4}
          value={form.summary}
          onChange={(e) => set('summary', e.target.value)}
          maxLength={500}
          style={{ resize: 'vertical' }}
        />
        {errors.summary && <span className="form-error">{errors.summary}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">Deadline <span style={{ color: 'var(--color-error)' }}>*</span></label>
        <input
          className="form-input"
          type="date"
          value={form.deadline}
          onChange={(e) => set('deadline', e.target.value)}
          style={{ maxWidth: 200 }}
        />
        {errors.deadline
          ? <span className="form-error">{errors.deadline}</span>
          : <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Must be at least 24h from now</span>}
      </div>

      <div className="form-group" style={{ marginBottom: '1.25rem' }}>
        <label className="form-label">Tags <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional, comma-separated)</span></label>
        <input
          className="form-input"
          value={form.tags}
          onChange={(e) => set('tags', e.target.value)}
          placeholder="e.g. blockchain, polygon, defi"
        />
      </div>

      <button
        className="btn btn--primary btn--sm"
        onClick={handleSave}
        disabled={saving}
      >
        {saving
          ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6 }} />Saving…</>
          : '💾 Save Changes'}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CampaignManager() {
  const { campaignId } = useParams();
  const navigate       = useNavigate();
  const { user }       = useAuthStore();

  const [campaign,    setCampaign]    = useState(null);
  const [milestones,  setMilestones]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadErr,     setLoadErr]     = useState('');
  const [editOpen,    setEditOpen]    = useState(false);
  const [submitTargetMs, setSubmitTargetMs] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const [c, ms] = await Promise.all([
        getCampaign(campaignId),
        getMilestones(campaignId).catch(() => []),
      ]);
      setCampaign(c);
      setMilestones(ms);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) setLoadErr('Campaign not found.');
      else if (status === 403) setLoadErr('You do not have access to this campaign.');
      else setLoadErr('Failed to load campaign. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 1rem' }} />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading campaign…</p>
    </div>
  );

  // ── Error ───────────────────────────────────────────────────────────────────
  if (loadErr) return (
    <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
      <span style={{ fontSize: '2.5rem' }}>⚠️</span>
      <p style={{ marginTop: '1rem', color: 'var(--color-error)' }}>{loadErr}</p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem' }}>
        <button className="btn btn--ghost btn--sm" onClick={load}>Retry</button>
        <Link to="/dashboard" className="btn btn--secondary btn--sm">← Dashboard</Link>
      </div>
    </div>
  );

  if (!campaign) return null;

  const statusMeta    = STATUS_META[campaign.status] || STATUS_META.draft;
  const isDraft       = campaign.status === 'draft';
  const isActive      = campaign.status === 'active';
  const isEditable    = isDraft;
  const isTerminal    = ['completed', 'cancelled'].includes(campaign.status);

  const raised        = campaign.currentRaised   ?? 0;
  const goal          = campaign.fundingGoal      ?? 1;
  const pct           = Math.min(100, Math.round((raised / goal) * 100));
  const currency      = campaign.currency         || 'INR';

  return (
    <div className="animate-fade-in" style={{ maxWidth: 780, margin: '0 auto' }}>

      {/* ── Back nav ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to="/dashboard"
          style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 0.4rem' }}>{campaign.title}</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', maxWidth: 620 }}>
              {campaign.summary}
            </p>
          </div>
          <StatusBadge status={campaign.status} large />
        </div>

        {/* Tag strip */}
        {campaign.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            {campaign.tags.map((t) => (
              <span key={t} style={{
                fontSize: '0.7rem', padding: '0.15rem 0.5rem',
                borderRadius: 99, background: 'rgba(99,102,241,0.1)',
                color: 'var(--color-primary)',
              }}>#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Funding progress card ──────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontWeight: 700 }}>💰 Funding Progress</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: statusMeta.color }}>{pct}%</span>
        </div>

        {/* Bar */}
        <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden', marginBottom: '0.75rem' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
            borderRadius: 99, transition: 'width 0.6s ease',
          }} />
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.83rem' }}>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Raised</div>
            <div style={{ fontWeight: 700 }}>{raised.toLocaleString()} {currency}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Goal</div>
            <div style={{ fontWeight: 700 }}>{goal.toLocaleString()} {currency}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Investors</div>
            <div style={{ fontWeight: 700 }}>{campaign.investorCount ?? 0}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Min invest</div>
            <div style={{ fontWeight: 700 }}>{campaign.minInvestment ?? 1} {currency}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Deadline</div>
            <div style={{ fontWeight: 700 }}>{new Date(campaign.deadline).toLocaleDateString()}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.15rem' }}>Milestone</div>
            <div style={{ fontWeight: 700 }}>{campaign.currentMilestoneIndex ?? 0} / {campaign.milestoneCount}</div>
          </div>
        </div>
      </div>

      {/* ── Blockchain info (active+) ──────────────────────────────────────── */}
      {campaign.isContractDeployed && (
        <div className="card" style={{
          marginBottom: '1.25rem',
          background: 'rgba(16,185,129,0.04)',
          borderColor: 'rgba(16,185,129,0.2)',
        }}>
          <SectionHeader title="⛓️ Transparency Registry" subtitle="Campaign is registered in the transparency logger." />
          <InfoRow label="Contract Address" value={campaign.contractAddress} mono />
          <InfoRow label="Campaign Key"     value={campaign.campaignKey}     mono />
          {campaign.activationTxHash && (
            <InfoRow label="Activation Tx" value={campaign.activationTxHash} mono />
          )}
        </div>
      )}

      {/* ── Activate panel (draft only) ────────────────────────────────────── */}
      {isDraft && (
        <div className="card" style={{ marginBottom: '1.25rem', borderColor: 'rgba(245,158,11,0.3)' }}>
          <SectionHeader
            title="⚡ Activate Campaign"
            subtitle="Complete all checks below, then activate to make your campaign live."
          />
          <ActivatePanel
            campaign={campaign}
            user={user}
            onActivated={(updated) => {
              setCampaign(updated);
              setEditOpen(false);
            }}
          />
        </div>
      )}

      {/* ── Edit panel (draft only) ────────────────────────────────────────── */}
      {isEditable && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer', userSelect: 'none',
            }}
            onClick={() => setEditOpen((o) => !o)}
          >
            <SectionHeader
              title="✏️ Edit Campaign"
              subtitle={editOpen ? 'Click to collapse' : 'Title, summary, deadline and tags can be changed while draft.'}
            />
            <span style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)' }}>{editOpen ? '▲' : '▼'}</span>
          </div>
          {editOpen && (
            <EditPanel
              campaign={campaign}
              onSaved={(updated) => setCampaign(updated)}
            />
          )}
        </div>
      )}

      {/* ── Read-only campaign details (active / terminal) ──────────────────── */}
      {!isEditable && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <SectionHeader
            title="📋 Campaign Details"
            subtitle={isTerminal ? 'This campaign is closed and cannot be modified.' : 'Financial configuration is locked while the campaign is live.'}
          />
          <InfoRow label="Funding Goal"    value={`${goal.toLocaleString()} ${currency}`} />
          <InfoRow label="Min Investment"  value={`${campaign.minInvestment ?? 1} ${currency}`} />
          {campaign.maxInvestment && (
            <InfoRow label="Max Investment" value={`${campaign.maxInvestment} ${currency}`} />
          )}
          <InfoRow label="Deadline"        value={new Date(campaign.deadline).toLocaleDateString()} />
          <InfoRow label="Milestones"      value={`${campaign.milestoneCount} (${campaign.milestonePercentages?.join('% / ')}%)`} />
          {campaign.tags?.length > 0 && (
            <InfoRow label="Tags"          value={campaign.tags.join(', ')} />
          )}
        </div>
      )}

      {/* ── Paused / cancelled note ────────────────────────────────────────── */}
      {campaign.status === 'paused' && (
        <div style={{
          background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)',
          borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem', marginBottom: '1.25rem',
        }}>
          <strong>⏸️ Campaign is paused</strong>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0.4rem 0 0' }}>
            No new investments are being accepted. Resume / cancel actions will be available here.
          </p>
        </div>
      )}

      {/* ── Milestones section ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <SectionHeader
          title="🏁 Milestones"
          subtitle={
            milestones.length === 0
              ? 'No milestones found. Create milestones to enable activation.'
              : `${milestones.length} milestone${milestones.length !== 1 ? 's' : ''} · ${campaign.currentMilestoneIndex ?? 0} disbursed`
          }
        />

        {milestones.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem 0' }}>
            <span style={{ fontSize: '2rem' }}>📭</span>
            <p className="empty-state__title" style={{ marginTop: '0.5rem' }}>No milestones yet</p>
            <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
              {isDraft
                ? 'Go back to create this campaign\'s milestones before activating.'
                : 'Milestone data unavailable.'}
            </p>
            {isDraft && (
              <Link to="/dashboard/campaigns/new" className="btn btn--ghost btn--sm">
                + New Campaign (with milestones)
              </Link>
            )}
          </div>
        ) : (
          milestones.map((ms, i) => (
            <MilestoneRow
              key={ms._id}
              ms={ms}
              idx={i}
              campaignStatus={campaign.status}
              onOpenSubmit={(targetMs) => setSubmitTargetMs(targetMs)}
            />
          ))
        )}

      </div>

      {submitTargetMs && (
        <SubmitProofModal
          milestone={submitTargetMs}
          campaign={campaign}
          onClose={() => setSubmitTargetMs(null)}
          onSuccess={() => {
            setSubmitTargetMs(null);
            load(); // Reload seamlessly to get new status
          }}
        />
      )}

      {/* ── Danger zone (draft / active / paused only) ─────────────────────── */}
      {!isTerminal && (
        <div className="card" style={{
          marginBottom: '1.25rem',
          borderColor: 'rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.02)',
        }}>
          <SectionHeader title="⚠️ Danger Zone" subtitle="Cancellation is permanent and cannot be undone." />
          <button
            className="btn btn--ghost btn--sm"
            style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
            onClick={() => toast('Cancel campaign flow coming soon.', { icon: '⚠️' })}
          >
            Cancel Campaign
          </button>
        </div>
      )}

    </div>
  );
}
