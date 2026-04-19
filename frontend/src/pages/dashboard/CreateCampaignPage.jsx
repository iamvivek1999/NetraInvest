/**
 * src/pages/dashboard/CampaignRequestPage.jsx
 *
 * A comprehensive wizard for founders to build their funding request.
 * Allows drafting, managing milestone plans, economics, and final submission.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createCampaign, updateCampaign, getCampaign, submitCampaign } from '../../api/campaigns.api';
import useAuthStore from '../../store/authStore';

const SECTORS = ['DeFi', 'Gaming', 'Infrastructure', 'Social', 'NFT', 'Other'];
const CATEGORIES = ['Equity', 'Token', 'Convertible Note'];
const FUNDING_STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B'];

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    summary: '',
    detailedDescription: '',
    category: 'Token',
    sector: 'DeFi',
    fundingStage: 'Pre-Seed',
    fundingGoal: '',          // INR display target (for UI stats only)
    fundingGoalPOL: '',       // on-chain POL decimal (feeds ethers.parseEther at activation)
    currency: 'POL',
    minInvestment: '',
    expectedTimelineMonths: '',
    projectedRevenue: '',
    projectedProfit: '',
    riskFactors: '',
    useOfFunds: [],     // { category, percentage, amount }
    milestonePlans: []  // { title, description, expectedStartDate, expectedEndDate, requiredBudget, expectedOutcome }
  });

  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const loadData = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const c = await getCampaign(campaignId);
      setForm({
        title: c.title || '',
        summary: c.summary || '',
        detailedDescription: c.detailedDescription || '',
        category: c.category || 'Token',
        sector: c.sector || 'DeFi',
        fundingStage: c.fundingStage || 'Pre-Seed',
        fundingGoal: c.fundingGoal || '',
        fundingGoalPOL: c.fundingGoalPOL || '',
        currency: c.currency || 'POL',
        minInvestment: c.minInvestment || '',
        expectedTimelineMonths: c.expectedTimelineMonths || '',
        projectedRevenue: c.projectedRevenue || '',
        projectedProfit: c.projectedProfit || '',
        riskFactors: c.riskFactors || '',
        useOfFunds: c.useOfFunds || [],
        milestonePlans: c.milestonePlans || []
      });
    } catch (err) {
      toast.error('Failed to load campaign');
      navigate('/dashboard/campaigns');
    } finally {
      setLoading(false);
    }
  }, [campaignId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Arrays managers
  const addFundsUsage = () => {
    setForm(prev => ({
      ...prev,
      useOfFunds: [...prev.useOfFunds, { category: '', percentage: 0, amount: 0 }]
    }));
  };

  const updateFundsUsage = (index, field, value) => {
    const updated = [...form.useOfFunds];
    updated[index][field] = value;
    setForm(prev => ({ ...prev, useOfFunds: updated }));
  };

  const removeFundsUsage = (index) => {
    setForm(prev => ({
      ...prev,
      useOfFunds: prev.useOfFunds.filter((_, i) => i !== index)
    }));
  };

  const addMilestone = () => {
    setForm(prev => ({
      ...prev,
      milestonePlans: [...prev.milestonePlans, { 
        title: '', description: '', expectedStartDate: '', expectedEndDate: '', requiredBudget: 0, expectedOutcome: '' 
      }]
    }));
  };

  const updateMilestone = (index, field, value) => {
    const updated = [...form.milestonePlans];
    updated[index][field] = value;
    setForm(prev => ({ ...prev, milestonePlans: updated }));
  };

  const removeMilestone = (index) => {
    setForm(prev => ({
      ...prev,
      milestonePlans: prev.milestonePlans.filter((_, i) => i !== index)
    }));
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      if (campaignId) {
        await updateCampaign(campaignId, form);
        toast.success('Draft saved successfully!');
      } else {
        // Need to create min required fields for backend to pass model validations
        const payload = {
          ...form,
          // Defaulting deadline to pass legacy validation (we can replace usage of deadline in future)
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          milestoneCount: form.milestonePlans.length > 0 ? form.milestonePlans.length : 1,
          milestonePercentages: form.milestonePlans.length > 0 ? form.milestonePlans.map(() => Math.floor(100 / form.milestonePlans.length)) : [100]
        };
        const c = await createCampaign(payload);
        toast.success('Campaign draft created!');
        navigate(`/dashboard/campaigns/${c._id}/edit`, { replace: true });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!campaignId) {
      toast.error('Please save your draft first before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      // Always save first
      await updateCampaign(campaignId, form);
      // Submit
      await submitCampaign(campaignId);
      toast.success('Campaign published and ready for activation!');
      navigate(`/dashboard/campaigns/${campaignId}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit campaign');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading campaign data...</div>;
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.5rem' }}>Create Campaign</h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Build your campaign. You can save as a draft and return later.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn--ghost" onClick={handleSaveDraft} disabled={saving || submitting}>
            {saving ? 'Saving...' : '💾 Save Draft'}
          </button>
          {campaignId && (
            <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting || saving}>
              {submitting ? 'Publishing...' : '🚀 Publish Campaign'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        {[1, 2, 3, 4].map(s => (
          <div key={s} 
               onClick={() => setStep(s)}
               style={{
            flex: 1, height: 6, borderRadius: 99, cursor: 'pointer',
            background: step >= s ? 'var(--color-primary)' : 'var(--color-border)',
            transition: 'background 0.3s'
          }} />
        ))}
      </div>

      <div className="card">
        {step === 1 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem' }}>Step 1: Basics</h3>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" name="title" value={form.title} onChange={handleChange} placeholder="Project title" />
            </div>
            <div className="form-group">
              <label className="form-label">Short Summary</label>
              <textarea className="form-input" name="summary" value={form.summary} onChange={handleChange} placeholder="One sentence pitch..." rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Detailed Description</label>
              <textarea className="form-input" name="detailedDescription" value={form.detailedDescription} onChange={handleChange} placeholder="Explain the problem, solution, and market..." rows={5} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Sector</label>
                <select className="form-input" name="sector" value={form.sector} onChange={handleChange}>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" name="category" value={form.category} onChange={handleChange}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Funding Stage</label>
                <select className="form-input" name="fundingStage" value={form.fundingStage} onChange={handleChange}>
                  {FUNDING_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expected Timeline (Months)</label>
                <input className="form-input" type="number" name="expectedTimelineMonths" value={form.expectedTimelineMonths} onChange={handleChange} placeholder="e.g. 12" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '0.5rem' }}>Step 2: Economics</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Set your on-chain funding goal in POL and an optional INR display target for investors.
            </p>

            {/* ── On-Chain Goal (primary, required for activation) ──────────── */}
            <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-primary)', borderRadius: 'var(--r-md)', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🔗 On-Chain Funding Goal (required for activation)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div className="form-group mb-0">
                  <label className="form-label">Funding Goal (POL decimal)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.0001"
                    name="fundingGoalPOL"
                    value={form.fundingGoalPOL}
                    onChange={handleChange}
                    placeholder="e.g. 2.5"
                  />
                  <small style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    This value is passed to ethers.parseEther() — never mix with INR.
                  </small>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label">Minimum Investment (POL)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.0001"
                    name="minInvestment"
                    value={form.minInvestment}
                    onChange={handleChange}
                    placeholder="e.g. 0.01"
                  />
                </div>
              </div>
            </div>

            {/* ── Display Target (INR, off-chain only) ─────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Display Goal — INR <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(UI only)</span></label>
                <input className="form-input" type="number" name="fundingGoal" value={form.fundingGoal} onChange={handleChange} placeholder="e.g. 500000" />
                <small style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Shown to investors as the fundraising target. Not used on-chain.</small>
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-input" name="currency" value={form.currency} onChange={handleChange}>
                  <option value="POL">POL (on-chain native)</option>
                  <option value="INR">INR (display/off-chain)</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Projected Annual Revenue</label>
                <input className="form-input" type="text" name="projectedRevenue" value={form.projectedRevenue} onChange={handleChange} placeholder="e.g. $1M ARR" />
              </div>
              <div className="form-group">
                <label className="form-label">Projected Net Profit</label>
                <input className="form-input" type="text" name="projectedProfit" value={form.projectedProfit} onChange={handleChange} placeholder="e.g. 20% margin" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Risk Factors</label>
              <textarea className="form-input" name="riskFactors" value={form.riskFactors} onChange={handleChange} placeholder="What are the main risks to executing this project?" rows={3} />
              <p className="text-muted text-xs mt-1">Investors see this on your public page. Honest disclosure improves your credibility index.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem' }}>Step 3: Use of Funds</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Break down how the requested capital will be utilized.</p>
            
            {form.useOfFunds.length === 0 && (
               <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <p>No fund breakdown added.</p>
               </div>
            )}

            {form.useOfFunds.map((uof, idx) => (
              <div key={idx} style={{ background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: 'var(--r-md)', marginBottom: '1rem', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <button className="btn btn--sm btn--ghost" style={{ color: 'var(--color-error)' }} onClick={() => removeFundsUsage(idx)}>Remove</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group mb-0">
                    <label className="form-label">Category</label>
                    <input className="form-input" value={uof.category} onChange={e => updateFundsUsage(idx, 'category', e.target.value)} placeholder="e.g. R&D, Marketing" />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">Percentage (%)</label>
                    <input className="form-input" type="number" value={uof.percentage} onChange={e => updateFundsUsage(idx, 'percentage', parseFloat(e.target.value))} />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">Amount</label>
                    <input className="form-input" type="number" value={uof.amount} onChange={e => updateFundsUsage(idx, 'amount', parseFloat(e.target.value))} />
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn--outline btn--sm" onClick={addFundsUsage}>+ Add Use of Funds Item</button>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem' }}>Step 4: Milestone Planning</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Define concrete deliverables tied to budget distributions.</p>
            
            {form.milestonePlans.length === 0 && (
               <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <p>No milestones added.</p>
               </div>
            )}

            {form.milestonePlans.map((mp, idx) => (
              <div key={idx} style={{ background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: 'var(--r-md)', marginBottom: '1rem', border: '1px solid var(--color-border)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 'bold' }}>Milestone {idx + 1}</div>
                  <button className="btn btn--sm btn--ghost" style={{ color: 'var(--color-error)' }} onClick={() => removeMilestone(idx)}>Remove</button>
                </div>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-input" value={mp.title} onChange={e => updateMilestone(idx, 'title', e.target.value)} placeholder="Beta Launch" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" value={mp.description} onChange={e => updateMilestone(idx, 'description', e.target.value)} rows={2} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group mb-0">
                    <label className="form-label">Budget Required</label>
                    <input className="form-input" type="number" value={mp.requiredBudget} onChange={e => updateMilestone(idx, 'requiredBudget', parseFloat(e.target.value))} />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">Start Date</label>
                    <input className="form-input" type="date" value={mp.expectedStartDate ? mp.expectedStartDate.slice(0, 10) : ''} onChange={e => updateMilestone(idx, 'expectedStartDate', e.target.value)} />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">End Date</label>
                    <input className="form-input" type="date" value={mp.expectedEndDate ? mp.expectedEndDate.slice(0, 10) : ''} onChange={e => updateMilestone(idx, 'expectedEndDate', e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  <label className="form-label">Expected Outcome</label>
                  <input className="form-input" value={mp.expectedOutcome} onChange={e => updateMilestone(idx, 'expectedOutcome', e.target.value)} placeholder="10k active users..." />
                </div>
              </div>
            ))}
            <button className="btn btn--outline btn--sm" onClick={addMilestone}>+ Add Milestone</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
        <button className="btn btn--ghost" disabled={step === 1} onClick={() => setStep(s => s - 1)}>← Previous</button>
        <button className="btn btn--primary" disabled={step === 4} onClick={() => setStep(s => s + 1)}>Next →</button>
      </div>
    </div>
  );
}
