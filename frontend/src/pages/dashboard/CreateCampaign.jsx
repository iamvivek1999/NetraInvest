/**
 * src/pages/dashboard/CreateCampaign.jsx
 *
 * Two-step campaign creation wizard for startup users.
 *
 * ── Step 1: Campaign Details ─────────────────────────────────────────────────
 *   • title, summary
 *   • fundingGoal, currency, minInvestment, maxInvestment
 *   • deadline
 *   • milestoneCount (1–5)  +  percentage allocation UI
 *   • tags (optional)
 *
 * ── Step 2: Milestone Definitions ───────────────────────────────────────────
 *   • For each milestone: title, description, targetDate (optional)
 *   • Percentage for each is computed from step 1 (read-only display)
 *   • Estimated amount = fundingGoal × percentage / 100
 *
 * Submit flow:
 *   1. POST /api/v1/campaigns           → creates campaign, returns campaignId
 *   2. POST /api/v1/campaigns/:id/milestones  → batch creates milestones
 *   3. Navigate to /dashboard           → dashboard refetches and shows the campaign
 *
 * Both API calls in a try/catch — if step 2 fails the campaign was already
 * created (draft). User sees the error and is redirected to dashboard
 * where they can see the draft and retry once milestone creation is supported.
 *
 * Validation mirrors backend campaign.validators.js exactly.
 */

import { useState, useCallback }    from 'react';
import { useNavigate }              from 'react-router-dom';
import toast                        from 'react-hot-toast';
import { createCampaign }           from '../../api/campaigns.api';
import { createMilestones }         from '../../api/milestones.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_MILESTONES = 5;
const CURRENCIES     = ['INR', 'ETH'];

// Minimum deadline date (YYYY-MM-DD) = today + 2 days (well within backend's 24h rule)
const minDeadline = () => {
  const d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

// ─── Helper: distribute percentages evenly across N milestones ────────────────
// Returns an integer-friendly array that sums exactly to 100.
const distributeEvenly = (n) => {
  if (n <= 0) return [];
  const base    = Math.floor(100 / n);
  const arr     = Array(n).fill(base);
  arr[n - 1]   += 100 - base * n; // remainder goes to last
  return arr;
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ['Campaign Details', 'Milestone Definitions'];
  // step 3 is a retry state — show step 2 as "error" state, not a new step
  const displayStep = step === 3 ? 2 : step;
  return (
    <div style={{ display: 'flex', gap: '0', marginBottom: '2rem' }}>
      {steps.map((label, i) => {
        const idx      = i + 1;
        const active   = idx === displayStep;
        const done     = idx < displayStep;
        const retrying = step === 3 && idx === 2;
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              display:        'flex',
              alignItems:     'center',
              gap:            '0.5rem',
              flex:           1,
              padding:        '0.6rem 0.75rem',
              borderRadius:   'var(--r-md)',
              background:     retrying ? 'rgba(239,68,68,0.08)' : active ? 'rgba(99,102,241,0.12)' : done ? 'rgba(16,185,129,0.08)' : 'transparent',
              border:         `1px solid ${retrying ? 'var(--color-error)' : active ? 'var(--color-primary)' : done ? 'var(--color-success)' : 'var(--color-border)'}`,
              transition:     'all 0.3s ease',
            }}>
              <div style={{
                width:        24,
                height:       24,
                borderRadius: '50%',
                background:   retrying ? 'var(--color-error)' : active ? 'var(--color-primary)' : done ? 'var(--color-success)' : 'var(--color-border)',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                fontSize:     '0.7rem',
                fontWeight:   700,
                color:        '#fff',
                flexShrink:   0,
              }}>
                {retrying ? '!' : done ? '✓' : idx}
              </div>
              <span style={{
                fontSize:   '0.82rem',
                fontWeight: active || retrying ? 600 : 400,
                color:      retrying ? 'var(--color-error)' : active ? 'var(--color-primary)' : done ? 'var(--color-success)' : 'var(--color-text-muted)',
              }}>
                {retrying ? 'Retry Milestones' : label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 24, height: 1, background: 'var(--color-border)', flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Percentage slider row ────────────────────────────────────────────────────
function PctRow({ index, pct, onPctChange, total, fundingGoal, currency, disabled }) {
  const estimated = fundingGoal && pct ? ((fundingGoal * pct) / 100).toFixed(2) : '—';
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '0.75rem',
      padding:      '0.6rem 0.75rem',
      background:   'rgba(99,102,241,0.04)',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--r-md)',
      marginBottom: '0.5rem',
    }}>
      <div style={{
        width:        28,
        height:       28,
        borderRadius: '50%',
        background:   'var(--color-primary)',
        display:      'flex',
        alignItems:   'center',
        justifyContent:'center',
        fontSize:     '0.7rem',
        fontWeight:   700,
        color:        '#fff',
        flexShrink:   0,
      }}>
        {index + 1}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <input
            type="range"
            min={1}
            max={99}
            step={1}
            value={pct}
            disabled={disabled}
            onChange={(e) => onPctChange(index, Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--color-primary)' }}
          />
          <input
            type="number"
            min={1}
            max={99}
            step={1}
            value={pct}
            disabled={disabled}
            onChange={(e) => onPctChange(index, Number(e.target.value))}
            style={{
              width:        56,
              textAlign:    'center',
              padding:      '0.25rem 0.4rem',
              background:   'var(--color-input)',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--r-sm)',
              color:        'var(--color-text)',
              fontSize:     '0.82rem',
            }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', minWidth: 12 }}>%</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          ≈ {estimated} {currency}
        </div>
      </div>
    </div>
  );
}

// ─── Milestone definition form (step 2) ───────────────────────────────────────
function MilestoneDef({ index, pct, fundingGoal, currency, data, onChange }) {
  const estimated = fundingGoal && pct ? ((fundingGoal * pct) / 100).toFixed(2) : '—';
  return (
    <div style={{
      background:   'rgba(99,102,241,0.04)',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--r-lg)',
      padding:      '1.25rem',
      marginBottom: '1rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{
          width:        32,
          height:       32,
          borderRadius: '50%',
          background:   'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     '0.82rem',
          fontWeight:   700,
          color:        '#fff',
          flexShrink:   0,
        }}>
          {index + 1}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Milestone {index + 1}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {pct}% · ≈ {estimated} {currency}
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="form-group">
        <label className="form-label">Title <span style={{ color: 'var(--color-error)' }}>*</span></label>
        <input
          className="form-input"
          type="text"
          maxLength={100}
          placeholder={`e.g. Milestone ${index + 1}: MVP launch`}
          value={data.title}
          onChange={(e) => onChange(index, 'title', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description <span style={{ color: 'var(--color-error)' }}>*</span></label>
        <textarea
          className="form-input"
          rows={3}
          maxLength={1000}
          placeholder="Describe what will be delivered or achieved (min 20 characters)..."
          value={data.description}
          onChange={(e) => onChange(index, 'description', e.target.value)}
          style={{ resize: 'vertical', minHeight: 80 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
          <span style={{
            fontSize: '0.72rem',
            color: data.description.trim().length < 20 && data.description.length > 0
              ? 'var(--color-error)'
              : 'var(--color-text-muted)',
          }}>
            {data.description.trim().length < 20
              ? `Min 20 chars (${20 - data.description.trim().length} more needed)`
              : 'Min 20 chars ✓'}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {data.description.length}/1000
          </span>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Target Date <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
        <input
          className="form-input"
          type="date"
          value={data.targetDate}
          onChange={(e) => onChange(index, 'targetDate', e.target.value)}
          style={{ maxWidth: 220 }}
        />
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Estimated completion date for this milestone</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateCampaign() {
  const navigate = useNavigate();

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  const [details, setDetails] = useState({
    title:          '',
    summary:        '',
    fundingGoal:    '',
    currency:       'INR',
    minInvestment:  '1',
    maxInvestment:  '',
    deadline:       '',
    milestoneCount: 3,
    tags:           '',
  });

  // Percentage allocations: auto-distributed whenever milestoneCount changes
  const [percentages, setPercentages] = useState(() => distributeEvenly(3));

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [milestones, setMilestones] = useState(() =>
    Array.from({ length: 3 }, () => ({ title: '', description: '', targetDate: '' }))
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [errors,       setErrors]       = useState({});
  const [submitting,   setSubmitting]   = useState(false);
  // If campaign creation succeeds but milestone creation fails, we
  // keep the wizard open on a "retry" step so the user is never stranded.
  const [partialCampaignId, setPartialCampaignId] = useState(null);
  const [milestoneError,    setMilestoneError]    = useState('');

  // ── Helpers ───────────────────────────────────────────────────────────────

  const set = (field, value) => setDetails((p) => ({ ...p, [field]: value }));

  const handleMilestoneCountChange = (n) => {
    const count = Math.min(MAX_MILESTONES, Math.max(1, parseInt(n, 10) || 1));
    setDetails((p) => ({ ...p, milestoneCount: count }));
    setPercentages(distributeEvenly(count));
    setMilestones(Array.from({ length: count }, (_, i) => milestones[i] || { title: '', description: '', targetDate: '' }));
  };

  const handlePctChange = useCallback((index, raw) => {
    setPercentages((prev) => {
      const next     = [...prev];
      const clamped  = Math.min(99, Math.max(1, raw));
      next[index]    = clamped;
      return next;
    });
  }, []);

  const pctSum = percentages.reduce((a, b) => a + b, 0);

  const handleMilestoneField = (index, field, value) => {
    setMilestones((prev) => {
      const next    = [...prev];
      next[index]   = { ...next[index], [field]: value };
      return next;
    });
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validateStep1 = () => {
    const errs = {};

    if (!details.title.trim())
      errs.title = 'Campaign title is required.';
    else if (details.title.trim().length > 120)
      errs.title = 'Title cannot exceed 120 characters.';

    if (!details.summary.trim())
      errs.summary = 'Summary is required.';
    else if (details.summary.trim().length < 30)
      errs.summary = 'Summary must be at least 30 characters.';
    else if (details.summary.trim().length > 500)
      errs.summary = 'Summary cannot exceed 500 characters.';

    const goal = parseFloat(details.fundingGoal);
    if (!details.fundingGoal || isNaN(goal) || goal <= 0)
      errs.fundingGoal = 'Funding goal must be a positive number.';

    const minInv = parseFloat(details.minInvestment);
    if (details.minInvestment && (isNaN(minInv) || minInv <= 0))
      errs.minInvestment = 'Minimum investment must be greater than 0.';

    if (details.maxInvestment) {
      const maxInv = parseFloat(details.maxInvestment);
      if (isNaN(maxInv) || maxInv <= 0)
        errs.maxInvestment = 'Maximum investment must be greater than 0.';
      else if (!isNaN(minInv) && maxInv <= minInv)
        errs.maxInvestment = 'Maximum investment must be greater than minimum.';
      else if (!isNaN(goal) && maxInv > goal)
        errs.maxInvestment = 'Maximum investment cannot exceed the funding goal.';
    }

    if (!details.deadline)
      errs.deadline = 'Deadline is required.';
    else {
      const dl  = new Date(details.deadline);
      const min = new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (dl <= min)
        errs.deadline = 'Deadline must be at least 24 hours from now.';
    }

    const count = parseInt(details.milestoneCount, 10);
    if (isNaN(count) || count < 1 || count > 5)
      errs.milestoneCount = 'Milestone count must be between 1 and 5.';

    if (Math.abs(pctSum - 100) >= 0.5)
      errs.percentages = `Percentages must sum to 100 (current: ${pctSum}).`;
    if (percentages.some((p) => p <= 0))
      errs.percentages = 'Each milestone percentage must be greater than 0.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    milestones.forEach((m, i) => {
      if (!m.title.trim())
        errs[`m_title_${i}`] = `Milestone ${i + 1}: title is required.`;
      if (!m.description.trim())
        errs[`m_desc_${i}`] = `Milestone ${i + 1}: description is required.`;
      else if (m.description.trim().length < 20)
        errs[`m_desc_${i}`] = `Milestone ${i + 1}: description must be at least 20 characters.`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Step navigation ───────────────────────────────────────────────────────

  const goToStep2 = () => {
    if (!validateStep1()) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToStep1 = () => {
    setErrors({});
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Retry milestone creation after partial failure (step 3)
  const handleMilestoneRetry = async () => {
    if (!validateStep2()) return;
    if (!partialCampaignId) return;

    setSubmitting(true);
    setMilestoneError('');

    const milestonesPayload = milestones.map((m) => ({
      title:       m.title.trim(),
      description: m.description.trim(),
      ...(m.targetDate ? { targetDate: new Date(m.targetDate).toISOString() } : {}),
    }));

    try {
      await createMilestones(partialCampaignId, milestonesPayload);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Still failing — check your milestone descriptions.';
      setMilestoneError(msg);
      setSubmitting(false);
      return;
    }

    toast.success('\ud83d\ude80 Campaign setup complete!');
    setSubmitting(false);
    navigate('/dashboard');
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setSubmitting(true);

    // Build campaign payload
    const tagsArr = details.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    const campaignPayload = {
      title:               details.title.trim(),
      summary:             details.summary.trim(),
      fundingGoal:         parseFloat(details.fundingGoal),
      currency:            details.currency,
      minInvestment:       parseFloat(details.minInvestment) || 1,
      deadline:            new Date(details.deadline).toISOString(),
      milestoneCount:      parseInt(details.milestoneCount, 10),
      milestonePercentages: percentages.map(Number),
      tags:                tagsArr,
    };

    if (details.maxInvestment) {
      campaignPayload.maxInvestment = parseFloat(details.maxInvestment);
    }

    let campaign;
    try {
      campaign = await createCampaign(campaignPayload);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to create campaign.';
      toast.error(msg);
      setSubmitting(false);
      return;
    }

    // Build milestones payload
    const milestonesPayload = milestones.map((m) => ({
      title:       m.title.trim(),
      description: m.description.trim(),
      ...(m.targetDate ? { targetDate: new Date(m.targetDate).toISOString() } : {}),
    }));

    try {
      await createMilestones(campaign._id, milestonesPayload);
    } catch (err) {
      // Campaign created but milestone batch failed.
      // Stay on the wizard with a clear retry UX — do NOT redirect to an incomplete draft.
      const msg = err?.response?.data?.message || 'Milestones could not be saved.';
      setPartialCampaignId(campaign._id);
      setMilestoneError(msg);
      setSubmitting(false);
      // Move to a dedicated "retry" step (step 3)
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    toast.success('🚀 Campaign created successfully!');
    setSubmitting(false);
    navigate('/dashboard');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const goal     = parseFloat(details.fundingGoal) || 0;
  const currency = details.currency;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Page header */}
      <div className="dashboard__header" style={{ marginBottom: '1.5rem' }}>
        <h2>🚀 Create Campaign</h2>
        <p className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
          Configure your fundraising campaign and milestone disbursal schedule.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator step={step} />

      {/* ──────────────────────── STEP 1 ──────────────────────────────────── */}
      {step === 1 && (
        <div>

          {/* ── Campaign info ── */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>📋 Campaign Info</h3>

            <div className="form-group">
              <label className="form-label">
                Campaign Title <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                id="campaign-title"
                className="form-input"
                type="text"
                maxLength={120}
                placeholder="e.g. NexaChain Seed Round — Q3 2025"
                value={details.title}
                onChange={(e) => set('title', e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {errors.title && <span className="form-error">{errors.title}</span>}
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {details.title.length}/120
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Summary <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <textarea
                id="campaign-summary"
                className="form-input"
                rows={4}
                maxLength={500}
                placeholder="A compelling 30–500 character summary of your campaign and what investors are funding."
                value={details.summary}
                onChange={(e) => set('summary', e.target.value)}
                style={{ resize: 'vertical', minHeight: 100 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {errors.summary
                  ? <span className="form-error">{errors.summary}</span>
                  : <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Min 30 chars</span>}
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {details.summary.length}/500
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Tags <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional, comma-separated)</span>
              </label>
              <input
                id="campaign-tags"
                className="form-input"
                type="text"
                placeholder="e.g. defi, polygon, supply-chain"
                value={details.tags}
                onChange={(e) => set('tags', e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Up to 10 tags</span>
            </div>
          </div>

          {/* ── Funding config ── */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>💰 Funding Configuration</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">
                  Funding Goal <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="campaign-goal"
                  className="form-input"
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="e.g. 50000"
                  value={details.fundingGoal}
                  onChange={(e) => set('fundingGoal', e.target.value)}
                />
                {errors.fundingGoal && <span className="form-error">{errors.fundingGoal}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Currency</label>
                <select
                  id="campaign-currency"
                  className="form-input"
                  value={details.currency}
                  onChange={(e) => set('currency', e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Min Investment</label>
                <input
                  id="campaign-min-inv"
                  className="form-input"
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="1"
                  value={details.minInvestment}
                  onChange={(e) => set('minInvestment', e.target.value)}
                />
                {errors.minInvestment && <span className="form-error">{errors.minInvestment}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Max Investment <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="campaign-max-inv"
                  className="form-input"
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="No cap"
                  value={details.maxInvestment}
                  onChange={(e) => set('maxInvestment', e.target.value)}
                />
                {errors.maxInvestment && <span className="form-error">{errors.maxInvestment}</span>}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Campaign Deadline <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                id="campaign-deadline"
                className="form-input"
                type="date"
                min={minDeadline()}
                value={details.deadline}
                onChange={(e) => set('deadline', e.target.value)}
                style={{ maxWidth: 240 }}
              />
              {errors.deadline
                ? <span className="form-error">{errors.deadline}</span>
                : <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Must be at least 24 hours from now</span>}
            </div>
          </div>

          {/* ── Milestone planning ── */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.35rem' }}>🏁 Milestone Plan</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              Choose how many milestones you need (1–5) and allocate what percentage of funds each milestone disburses. Percentages must sum to exactly 100.
            </p>

            {/* Count selector */}
            <div className="form-group">
              <label className="form-label">
                Number of Milestones <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleMilestoneCountChange(n)}
                    style={{
                      width:        40,
                      height:       40,
                      borderRadius: 'var(--r-md)',
                      border:       `2px solid ${details.milestoneCount === n ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background:   details.milestoneCount === n ? 'rgba(99,102,241,0.12)' : 'transparent',
                      color:        details.milestoneCount === n ? 'var(--color-primary)' : 'var(--color-text)',
                      fontWeight:   details.milestoneCount === n ? 700 : 400,
                      cursor:       'pointer',
                      transition:   'all 0.2s ease',
                      fontSize:     '0.9rem',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {errors.milestoneCount && <span className="form-error">{errors.milestoneCount}</span>}
            </div>

            {/* Percentage allocations */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Fund Disbursal Allocation</label>
                <span style={{
                  fontSize:     '0.78rem',
                  fontWeight:   700,
                  color:        Math.abs(pctSum - 100) < 0.5 ? 'var(--color-success)' : 'var(--color-error)',
                  background:   Math.abs(pctSum - 100) < 0.5 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  padding:      '0.2rem 0.6rem',
                  borderRadius: 'var(--r-sm)',
                  border:       `1px solid ${Math.abs(pctSum - 100) < 0.5 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                  Total: {pctSum}% {Math.abs(pctSum - 100) < 0.5 ? '✓' : `(need ${100 - pctSum > 0 ? '+' : ''}${100 - pctSum})`}
                </span>
              </div>
              {percentages.map((pct, i) => (
                <PctRow
                  key={i}
                  index={i}
                  pct={pct}
                  onPctChange={handlePctChange}
                  total={pctSum}
                  fundingGoal={goal}
                  currency={currency}
                  disabled={false}
                />
              ))}
              {errors.percentages && (
                <span className="form-error" style={{ marginTop: '0.25rem' }}>{errors.percentages}</span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={goToStep2}
            >
              Continue to Milestones →
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────── STEP 2 ──────────────────────────────────── */}
      {step === 2 && (
        <div>

          {/* Summary banner */}
          <div style={{
            background:   'rgba(99,102,241,0.06)',
            border:       '1px solid rgba(99,102,241,0.2)',
            borderRadius: 'var(--r-lg)',
            padding:      '1rem 1.25rem',
            marginBottom: '1.5rem',
            display:      'flex',
            gap:          '1.25rem',
            flexWrap:     'wrap',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>CAMPAIGN</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{details.title}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>GOAL</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{goal} {currency}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>MILESTONES</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{details.milestoneCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>DEADLINE</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {details.deadline ? new Date(details.deadline).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>

          {/* Milestone definitions */}
          <div style={{ marginBottom: '0.5rem' }}>
            <h3 style={{ marginBottom: '0.35rem' }}>🏁 Define Your Milestones</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              Set a title and description for each milestone so investors understand what they're funding.
            </p>
          </div>

          {milestones.map((m, i) => (
            <MilestoneDef
              key={i}
              index={i}
              pct={percentages[i]}
              fundingGoal={goal}
              currency={currency}
              data={m}
              onChange={handleMilestoneField}
            />
          ))}

          {/* Per-milestone errors */}
          {Object.entries(errors).filter(([k]) => k.startsWith('m_')).map(([k, v]) => (
            <p key={k} className="form-error" style={{ marginBottom: '0.5rem' }}>{v}</p>
          ))}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={backToStep1}
              disabled={submitting}
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ minWidth: 180 }}
            >
              {submitting
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: '0.5rem' }} />Creating…</>
                : '🚀 Create Campaign'}
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────── STEP 3: Milestone Retry ───────────────────── */}
      {step === 3 && (
        <div>
          {/* Error banner */}
          <div style={{
            background:   'rgba(239,68,68,0.07)',
            border:       '1px solid rgba(239,68,68,0.25)',
            borderRadius: 'var(--r-lg)',
            padding:      '1rem 1.25rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Campaign saved — milestones failed</div>
                <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                  Your campaign was created as a draft, but the milestone batch could not be saved.
                  Fix the issues below and click <strong>Retry</strong> — no new campaign will be created.
                </p>
                {milestoneError && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-error)', fontWeight: 500 }}>
                    Error: {milestoneError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Milestone definitions — same forms as step 2 */}
          <div style={{ marginBottom: '0.5rem' }}>
            <h3 style={{ marginBottom: '0.35rem' }}>🏁 Fix &amp; Retry Milestones</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              Review each milestone below. Descriptions must be at least 20 characters.
            </p>
          </div>

          {milestones.map((m, i) => (
            <MilestoneDef
              key={i}
              index={i}
              pct={percentages[i]}
              fundingGoal={parseFloat(details.fundingGoal) || 0}
              currency={details.currency}
              data={m}
              onChange={handleMilestoneField}
            />
          ))}

          {/* Per-milestone errors */}
          {Object.entries(errors).filter(([k]) => k.startsWith('m_')).map(([k, v]) => (
            <p key={k} className="form-error" style={{ marginBottom: '0.5rem' }}>{v}</p>
          ))}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigate('/dashboard')}
              disabled={submitting}
            >
              Go to Dashboard (save later)
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleMilestoneRetry}
              disabled={submitting}
              style={{ minWidth: 180 }}
            >
              {submitting
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: '0.5rem' }} />Retrying…</>
                : '🔄 Retry Milestones'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
