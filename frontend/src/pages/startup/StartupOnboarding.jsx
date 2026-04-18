/**
 * src/pages/startup/StartupOnboarding.jsx
 *
 * 7-step multi-section startup onboarding / profile submission form.
 *
 * Steps:
 *   1. Basic Company Info
 *   2. Founders & Team
 *   3. Business Model & Pitch
 *   4. Registration Details
 *   5. Financials
 *   6. KYC & Documents
 *   7. Review & Submit
 *
 * Features:
 *   • Save as Draft (any step)
 *   • Submit for Verification (step 7, after validation)
 *   • Edit lock — when status is pending/in_review/approved, form is read-only
 *   • Status banner at top
 *   • Hydrates from GET /api/v1/startups/me on mount
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  getMyStartupProfile,
  saveStartupDraft,
  submitStartupProfile,
} from '../../api/startups.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Company Info', icon: '🏢' },
  { id: 2, label: 'Team', icon: '👥' },
  { id: 3, label: 'Pitch & Model', icon: '🚀' },
  { id: 4, label: 'Registration', icon: '📋' },
  { id: 5, label: 'Financials', icon: '💰' },
  { id: 6, label: 'Documents', icon: '📁' },
  { id: 7, label: 'Review', icon: '✅' },
];

const INDUSTRIES = [
  { value: 'fintech', label: 'Fintech' },
  { value: 'healthtech', label: 'Healthtech' },
  { value: 'edtech', label: 'Edtech' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'agritech', label: 'Agritech' },
  { value: 'saas', label: 'SaaS' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'cleantech', label: 'Cleantech' },
  { value: 'proptech', label: 'Proptech' },
  { value: 'other', label: 'Other' },
];

const FUNDING_STAGES = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'other', label: 'Other' },
];

const LEGAL_ENTITY_TYPES = [
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'llp', label: 'LLP' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'other', label: 'Other' },
];

const REGISTRATION_TYPES = [
  { value: 'mca', label: 'MCA (Ministry of Corporate Affairs)' },
  { value: 'startup_india', label: 'Startup India' },
  { value: 'llp', label: 'LLP Registration' },
  { value: 'other', label: 'Other' },
];

const KYC_CATEGORIES = [
  { value: 'aadhar', label: 'Aadhar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'director_id', label: 'Director ID Proof' },
  { value: 'other', label: 'Other' },
];

const BUSINESS_DOC_CATEGORIES = [
  { value: 'coa', label: 'Certificate of Incorporation' },
  { value: 'moa_aoa', label: 'MOA / AOA' },
  { value: 'financials', label: 'Audited Financials' },
  { value: 'gst', label: 'GST Registration' },
  { value: 'pitch_deck', label: 'Pitch Deck' },
  { value: 'product_demo', label: 'Product Demo' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG = {
  draft: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', label: 'Draft', icon: '📝' },
  submitted: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Submitted', icon: '📤' },
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Pending Review', icon: '⏳' },
  in_review: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Under Review', icon: '🔍' },
  approved: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Approved', icon: '✅' },
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Rejected', icon: '❌' },
  more_info_required: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'More Info Needed', icon: '⚠️' },
};

const EDITABLE_STATUSES = ['draft', 'rejected', 'more_info_required'];

const EMPTY_FOUNDER = { name: '', role: '', bio: '', linkedin: '' };
const EMPTY_KYC_DOC = { fileName: '', fileUrl: '', documentCategory: 'pan', verificationLabel: '' };
const EMPTY_BIZ_DOC = { fileName: '', fileUrl: '', documentCategory: 'pitch_deck', verificationLabel: '' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (v) => {
  if (!v) return '';
  return Number(v).toLocaleString('en-IN');
};

// ─── Reusable small components ────────────────────────────────────────────────

function Field({ label, required, hint, children }) {
  return (
    <div className="form-group">
      <label className={`form-label${required ? ' form-label--req' : ''}`}>{label}</label>
      {children}
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  );
}

function Input({ ...props }) {
  return <input className="form-input" {...props} />;
}

function Textarea({ rows = 4, ...props }) {
  return <textarea className="form-input form-textarea" rows={rows} {...props} />;
}

function Select({ options, placeholder, ...props }) {
  return (
    <select className="form-input form-select" {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Grid({ cols = 2, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '1rem' }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
      <h3 style={{ marginBottom: '0.25rem', fontSize: '1.05rem' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{subtitle}</p>}
    </div>
  );
}

// ─── Step Sidebar ─────────────────────────────────────────────────────────────

function StepSidebar({ current, onNavigate, completedSteps }) {
  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--r-lg)',
      padding: '1rem',
      alignSelf: 'flex-start',
      position: 'sticky', top: '1rem',
    }}>
      <p style={{
        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '1rem'
      }}>
        Onboarding Steps
      </p>
      {STEPS.map(s => {
        const isActive = s.id === current;
        const isCompleted = completedSteps.has(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onNavigate(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem',
              borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer',
              marginBottom: '0.25rem',
              background: isActive ? 'var(--color-primary)' : 'transparent',
              color: isActive ? '#fff' : isCompleted ? 'var(--color-success)' : 'var(--color-text-muted)',
              fontWeight: isActive ? 600 : 400,
              fontSize: '0.85rem',
              transition: 'all 0.15s',
            }}
          >
            <span>{isCompleted && !isActive ? '✓' : s.icon}</span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Status Banner ────────────────────────────────────────────────────────────

function StatusBanner({ status, rejectionReason, submittedAt }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.color}33`,
      borderRadius: 'var(--r-md)', padding: '0.85rem 1.1rem',
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      marginBottom: '1.5rem',
    }}>
      <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{cfg.icon}</span>
      <div>
        <p style={{ fontWeight: 700, color: cfg.color, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
          Status: {cfg.label}
          {submittedAt && status !== 'draft' && (
            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
              · Submitted {new Date(submittedAt).toLocaleDateString('en-IN')}
            </span>
          )}
        </p>
        {status === 'rejected' && rejectionReason && (
          <p style={{ fontSize: '0.82rem', color: 'var(--color-error)' }}>
            Reason: {rejectionReason}
          </p>
        )}
        {status === 'more_info_required' && rejectionReason && (
          <p style={{ fontSize: '0.82rem', color: '#f59e0b' }}>
            Admin note: {rejectionReason}
          </p>
        )}
        {(status === 'pending' || status === 'in_review') && (
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Your profile is under admin review. You will be notified on status change.
          </p>
        )}
        {status === 'approved' && (
          <p style={{ fontSize: '0.82rem', color: 'var(--color-success)' }}>
            Your startup is verified! You can now create fundraising campaigns.
          </p>
        )}
        {!EDITABLE_STATUSES.includes(status) && (
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
            🔒 Profile is locked for editing while under review.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocRow({ doc, index, categories, onChange, onRemove, locked }) {
  const ch = (f, v) => onChange(index, { ...doc, [f]: v });
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--r-md)', padding: '1rem',
      display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: '0.75rem',
      alignItems: 'end', position: 'relative',
    }}>
      <Field label="Category">
        <Select options={categories} value={doc.documentCategory}
          onChange={e => ch('documentCategory', e.target.value)} disabled={locked} />
      </Field>
      <Field label="File Name / Label">
        <Input placeholder="e.g. PAN Card" value={doc.fileName}
          onChange={e => ch('fileName', e.target.value)} disabled={locked} />
      </Field>
      <Field label="URL / Drive Link">
        <Input placeholder="https://drive.google.com/…" value={doc.fileUrl}
          onChange={e => ch('fileUrl', e.target.value)} disabled={locked} />
      </Field>
      {!locked && (
        <button type="button" onClick={() => onRemove(index)} style={{
          position: 'absolute', top: '0.75rem', right: '0.75rem',
          background: 'var(--color-error-dim)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: '0.75rem',
          color: 'var(--color-error)', cursor: 'pointer',
        }}>✕</button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StartupOnboarding() {
  const navigate = useNavigate();

  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Profile metadata
  const [profileId, setProfileId] = useState(null);
  const [status, setStatus] = useState('draft');
  const [submittedAt, setSubmittedAt] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);

  const locked = !EDITABLE_STATUSES.includes(status);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    // Step 1
    startupName: '',
    legalCompanyName: '',
    companyLogo: '',
    tagline: '',
    description: '',
    industry: '',
    fundingStage: 'pre_seed',
    website: '',
    city: '',
    country: 'India',
    foundedYear: '',
    teamSize: '',
    twitter: '',
    linkedIn: '',
    github: '',
    tags: '',
    // Step 3
    pitchSummary: '',
    problemStatement: '',
    solutionDescription: '',
    targetMarket: '',
    tractionSummary: '',
    businessModel: '',
    // Step 4
    legalEntityType: 'private_limited',
    mcaRegistrationNumber: '',
    panNumber: '',
    incorporationDate: '',
    registrationType: '',
    // Step 5
    annualRevenue: '',
    monthlyRevenue: '',
    profitOrLoss: '',
    burnRate: '',
    runwayMonths: '',
  });

  const [founders, setFounders] = useState([{ ...EMPTY_FOUNDER }]);
  const [kycDocs, setKycDocs] = useState([]);
  const [bizDocs, setBizDocs] = useState([]);

  // ── Hydrate on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const profile = await getMyStartupProfile();
        if (cancelled || !profile) return;

        setProfileId(profile._id);
        setStatus(profile.verificationStatus || 'draft');
        setSubmittedAt(profile.submittedAt);
        setRejectionReason(profile.rejectionReason);

        setForm(prev => ({
          ...prev,
          startupName: profile.startupName || '',
          legalCompanyName: profile.legalCompanyName || '',
          companyLogo: profile.companyLogo || '',
          tagline: profile.tagline || '',
          description: profile.description || '',
          industry: profile.industry || '',
          fundingStage: profile.fundingStage || 'pre_seed',
          website: profile.website || '',
          city: profile.location?.city || '',
          country: profile.location?.country || 'India',
          foundedYear: profile.foundedYear ? String(profile.foundedYear) : '',
          teamSize: profile.teamSize ? String(profile.teamSize) : '',
          twitter: profile.socialLinks?.twitter || '',
          linkedIn: profile.socialLinks?.linkedIn || '',
          github: profile.socialLinks?.github || '',
          tags: (profile.tags || []).join(', '),
          pitchSummary: profile.pitchSummary || '',
          problemStatement: profile.problemStatement || '',
          solutionDescription: profile.solutionDescription || '',
          targetMarket: profile.targetMarket || '',
          tractionSummary: profile.tractionSummary || '',
          legalEntityType: profile.legalEntityType || 'private_limited',
          mcaRegistrationNumber: profile.mcaRegistrationNumber || '',
          panNumber: profile.panNumber || '',
          incorporationDate: profile.incorporationDate
            ? new Date(profile.incorporationDate).toISOString().slice(0, 10) : '',
          registrationType: profile.registrationType || '',
          annualRevenue: profile.financialData?.annualRevenue != null ? String(profile.financialData.annualRevenue) : '',
          monthlyRevenue: profile.financialData?.monthlyRevenue != null ? String(profile.financialData.monthlyRevenue) : '',
          profitOrLoss: profile.financialData?.profitOrLoss || '',
          burnRate: profile.financialData?.burnRate != null ? String(profile.financialData.burnRate) : '',
          runwayMonths: profile.financialData?.runwayMonths != null ? String(profile.financialData.runwayMonths) : '',
        }));

        if (profile.teamMembers?.length) {
          setFounders(profile.teamMembers.map(m => ({
            name: m.name || '', role: m.role || '',
            bio: m.bio || '', linkedin: m.linkedIn || '',
          })));
        }
        if (profile.kycDocuments?.length) {
          setKycDocs(profile.kycDocuments.map(d => ({
            fileName: d.fileName || '', fileUrl: d.fileUrl || '',
            documentCategory: d.documentCategory || 'pan',
            verificationLabel: d.verificationLabel || '',
          })));
        }
        if (profile.businessVerificationDocuments?.length) {
          setBizDocs(profile.businessVerificationDocuments.map(d => ({
            fileName: d.fileName || '', fileUrl: d.fileUrl || '',
            documentCategory: d.documentCategory || 'pitch_deck',
            verificationLabel: d.verificationLabel || '',
          })));
        }
      } catch (err) {
        if (!cancelled) setGlobalError(err?.response?.data?.message || 'Failed to load profile.');
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Field helpers ───────────────────────────────────────────────────────────
  const ch = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // ── Build backend payload ───────────────────────────────────────────────────
  const buildPayload = useCallback(() => {
    return {
      startupName: form.startupName.trim() || undefined,
      legalCompanyName: form.legalCompanyName.trim() || undefined,
      companyLogo: form.companyLogo.trim() || undefined,
      tagline: form.tagline.trim() || undefined,
      description: form.description.trim() || undefined,
      industry: form.industry || undefined,
      fundingStage: form.fundingStage,
      website: form.website.trim() || undefined,
      location: {
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
      },
      foundedYear: form.foundedYear ? parseInt(form.foundedYear, 10) : undefined,
      teamSize: form.teamSize ? parseInt(form.teamSize, 10) : undefined,
      socialLinks: {
        twitter: form.twitter.trim() || null,
        linkedIn: form.linkedIn.trim() || null,
        github: form.github.trim() || null,
      },
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10),

      // Pitch
      pitchSummary: form.pitchSummary.trim() || undefined,
      problemStatement: form.problemStatement.trim() || undefined,
      solutionDescription: form.solutionDescription.trim() || undefined,
      targetMarket: form.targetMarket.trim() || undefined,
      tractionSummary: form.tractionSummary.trim() || undefined,

      // Registration
      legalEntityType: form.legalEntityType || undefined,
      mcaRegistrationNumber: form.mcaRegistrationNumber.trim() || undefined,
      panNumber: form.panNumber.trim().toUpperCase() || undefined,
      incorporationDate: form.incorporationDate || undefined,
      registrationType: form.registrationType || undefined,

      // Financials
      financialData: {
        annualRevenue: form.annualRevenue ? parseFloat(form.annualRevenue) : null,
        monthlyRevenue: form.monthlyRevenue ? parseFloat(form.monthlyRevenue) : null,
        profitOrLoss: form.profitOrLoss || null,
        burnRate: form.burnRate ? parseFloat(form.burnRate) : null,
        runwayMonths: form.runwayMonths ? parseFloat(form.runwayMonths) : null,
      },

      // Team / docs
      teamMembers: founders.map(f => ({
        name: f.name.trim(), role: f.role.trim(),
        bio: f.bio?.trim() || undefined, linkedIn: f.linkedin?.trim() || undefined,
      })),
      kycDocuments: kycDocs.map(d => ({
        fileName: d.fileName, fileUrl: d.fileUrl,
        documentCategory: d.documentCategory,
      })),
      businessVerificationDocuments: bizDocs.map(d => ({
        fileName: d.fileName, fileUrl: d.fileUrl,
        documentCategory: d.documentCategory,
      })),
    };
  }, [form, founders, kycDocs, bizDocs]);

  // ── Save draft ──────────────────────────────────────────────────────────────
  const saveDraft = async (quiet = false) => {
    setSaving(true);
    setGlobalError('');
    try {
      const saved = await saveStartupDraft(profileId, buildPayload());
      setProfileId(saved._id);
      setStatus(saved.verificationStatus);
      if (!quiet) toast.success('Draft saved ✓');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save draft.';
      setGlobalError(msg);
      if (!quiet) toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Submit for verification ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Save latest data first
    await saveDraft(true);
    if (globalError) return;

    setSubmitting(true);
    try {
      const updated = await submitStartupProfile();
      setStatus(updated.verificationStatus);
      setSubmittedAt(updated.submittedAt);
      setRejectionReason(null);
      toast.success('🎉 Profile submitted for verification!');
      setTimeout(() => navigate('/startup/pending-verification'), 1500);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Submission failed.';
      setGlobalError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step navigation ─────────────────────────────────────────────────────────
  const goStep = (n) => {
    setCompletedSteps(prev => new Set([...prev, step]));
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = () => goStep(Math.min(step + 1, STEPS.length));
  const prev = () => setStep(s => Math.max(s - 1, 1));

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loadingInit) {
    return (
      <div className="animate-fade-in" style={{ padding: '2rem 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[240, 180, 300].map((h, i) => (
            <div key={i} className="skeleton" style={{ height: h, borderRadius: 'var(--r-lg)' }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const cardStyle = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--r-lg)',
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  };

  const navBarStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)',
  };

  // ── Render steps ────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {

      // ── Step 1: Company Info ───────────────────────────────────────────────
      case 1: return (
        <div style={cardStyle}>
          <SectionHeader title="🏢 Basic Company Info" subtitle="Your startup's identity on the platform. Required for search and discovery." />
          <Grid cols={2}>
            <Field label="Startup / Brand Name" required>
              <Input name="startupName" value={form.startupName} onChange={ch}
                placeholder="Enigma Finance" maxLength={100} disabled={locked} />
            </Field>
            <Field label="Legal Company Name" hint="As registered with MCA / ROC">
              <Input name="legalCompanyName" value={form.legalCompanyName} onChange={ch}
                placeholder="Enigma Finance Pvt Ltd" maxLength={200} disabled={locked} />
            </Field>
          </Grid>
          <Field label="Tagline" hint={`${form.tagline.length}/160`}>
            <Input name="tagline" value={form.tagline} onChange={ch}
              placeholder="One line that captures your startup's mission." maxLength={160} disabled={locked} />
          </Field>
          <Field label="Description" required hint={`${form.description.length}/3000 (min 50 chars)`}>
            <Textarea name="description" value={form.description} onChange={ch}
              placeholder="Describe your startup — what problem you solve, your solution, current traction, and vision."
              maxLength={3000} rows={5} disabled={locked} />
          </Field>
          <Grid cols={2}>
            <Field label="Industry" required>
              <Select name="industry" options={INDUSTRIES} value={form.industry} onChange={ch}
                placeholder="Select industry…" disabled={locked} />
            </Field>
            <Field label="Funding Stage">
              <Select name="fundingStage" options={FUNDING_STAGES} value={form.fundingStage} onChange={ch}
                disabled={locked} />
            </Field>
          </Grid>
          <Grid cols={3}>
            <Field label="Website">
              <Input name="website" value={form.website} onChange={ch} type="url"
                placeholder="https://yourstartup.com" disabled={locked} />
            </Field>
            <Field label="Founded Year">
              <Input name="foundedYear" value={form.foundedYear} onChange={ch} type="number"
                placeholder="2022" min={1900} max={new Date().getFullYear()} disabled={locked} />
            </Field>
            <Field label="Team Size">
              <Input name="teamSize" value={form.teamSize} onChange={ch} type="number"
                placeholder="12" min={1} disabled={locked} />
            </Field>
          </Grid>
          <Grid cols={2}>
            <Field label="City">
              <Input name="city" value={form.city} onChange={ch} placeholder="Bengaluru" disabled={locked} />
            </Field>
            <Field label="Country">
              <Input name="country" value={form.country} onChange={ch} placeholder="India" disabled={locked} />
            </Field>
          </Grid>
          <Field label="Tags" hint="Comma-separated · max 10">
            <Input name="tags" value={form.tags} onChange={ch}
              placeholder="fintech, B2B, payments, SaaS" disabled={locked} />
          </Field>
          <SectionHeader title="🔗 Social Links" subtitle="Optional — adds credibility." />
          <Grid cols={3}>
            <Field label="Twitter / X">
              <Input name="twitter" value={form.twitter} onChange={ch}
                placeholder="https://x.com/yourstartup" disabled={locked} />
            </Field>
            <Field label="LinkedIn Page">
              <Input name="linkedIn" value={form.linkedIn} onChange={ch}
                placeholder="https://linkedin.com/company/…" disabled={locked} />
            </Field>
            <Field label="GitHub">
              <Input name="github" value={form.github} onChange={ch}
                placeholder="https://github.com/yourstartup" disabled={locked} />
            </Field>
          </Grid>
          <Field label="Company Logo URL" hint="Paste a publicly accessible image URL">
            <Input name="companyLogo" value={form.companyLogo} onChange={ch}
              placeholder="https://cdn.yourdomain.com/logo.png" disabled={locked} />
          </Field>
        </div>
      );

      // ── Step 2: Founders & Team ────────────────────────────────────────────
      case 2: return (
        <div style={cardStyle}>
          <SectionHeader title="👥 Founders & Team" subtitle="Add all co-founders and key team members. At least one required for submission." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {founders.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                No founders added. Add at least one founder.
              </p>
            )}
            {founders.map((f, i) => (
              <div key={i} style={{
                background: 'rgba(99,102,241,0.04)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--r-md)', padding: '1.1rem', position: 'relative',
              }}>
                <p style={{
                  fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem'
                }}>
                  Founder #{i + 1}
                </p>
                <Grid cols={2}>
                  <Field label="Full Name" required>
                    <Input value={f.name} onChange={e => setFounders(prev =>
                      prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                      placeholder="Priya Sharma" disabled={locked} />
                  </Field>
                  <Field label="Role / Title" required>
                    <Input value={f.role} onChange={e => setFounders(prev =>
                      prev.map((x, idx) => idx === i ? { ...x, role: e.target.value } : x))}
                      placeholder="CEO / Co-Founder" disabled={locked} />
                  </Field>
                  <Field label="Short Bio">
                    <Input value={f.bio} onChange={e => setFounders(prev =>
                      prev.map((x, idx) => idx === i ? { ...x, bio: e.target.value } : x))}
                      placeholder="10 years in fintech…" disabled={locked} />
                  </Field>
                  <Field label="LinkedIn URL">
                    <Input value={f.linkedin} onChange={e => setFounders(prev =>
                      prev.map((x, idx) => idx === i ? { ...x, linkedin: e.target.value } : x))}
                      placeholder="https://linkedin.com/in/…" disabled={locked} />
                  </Field>
                </Grid>
                {!locked && founders.length > 1 && (
                  <button type="button" onClick={() => setFounders(prev => prev.filter((_, idx) => idx !== i))}
                    style={{
                      position: 'absolute', top: '0.75rem', right: '0.75rem',
                      background: 'var(--color-error-dim)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: '0.75rem',
                      color: 'var(--color-error)', cursor: 'pointer',
                    }}>✕ Remove</button>
                )}
              </div>
            ))}
          </div>
          {!locked && founders.length < 10 && (
            <button type="button" onClick={() => setFounders(prev => [...prev, { ...EMPTY_FOUNDER }])}
              className="btn btn--secondary btn--sm">
              ＋ Add Founder / Team Member
            </button>
          )}
        </div>
      );

      // ── Step 3: Business Model & Pitch ────────────────────────────────────
      case 3: return (
        <div style={cardStyle}>
          <SectionHeader title="🚀 Business Model & Pitch" subtitle="Help investors understand what you're building and why it matters." />
          <Field label="Pitch Summary" hint={`${form.pitchSummary.length}/2000 — 1–2 paragraphs that summarize your opportunity`}>
            <Textarea name="pitchSummary" value={form.pitchSummary} onChange={ch}
              placeholder="We are building X for Y. Our approach is Z and we've achieved A, B, C."
              maxLength={2000} rows={5} disabled={locked} />
          </Field>
          <Field label="Problem Statement" hint={`${form.problemStatement.length}/2000`}>
            <Textarea name="problemStatement" value={form.problemStatement} onChange={ch}
              placeholder="The current problem is… It affects X million people/businesses because…"
              maxLength={2000} rows={4} disabled={locked} />
          </Field>
          <Field label="Solution Description" hint={`${form.solutionDescription.length}/2000`}>
            <Textarea name="solutionDescription" value={form.solutionDescription} onChange={ch}
              placeholder="Our solution works by… Key differentiators vs. existing alternatives are…"
              maxLength={2000} rows={4} disabled={locked} />
          </Field>
          <Grid cols={2}>
            <Field label="Target Market" hint={`${form.targetMarket.length}/1000`}>
              <Textarea name="targetMarket" value={form.targetMarket} onChange={ch}
                placeholder="Primary: SMEs in India · TAM: ₹5,000 Cr · SAM: ₹800 Cr"
                maxLength={1000} rows={3} disabled={locked} />
            </Field>
            <Field label="Traction Summary" hint={`${form.tractionSummary.length}/1500`}>
              <Textarea name="tractionSummary" value={form.tractionSummary} onChange={ch}
                placeholder="500 signed up, ₹12L MRR, 3 enterprise LOIs, 40% MoM growth…"
                maxLength={1500} rows={3} disabled={locked} />
            </Field>
          </Grid>
        </div>
      );

      // ── Step 4: Registration Details ──────────────────────────────────────
      case 4: return (
        <div style={cardStyle}>
          <SectionHeader title="📋 Registration & Legal" subtitle="Required for KYB verification. Keep your official documents handy." />
          <Grid cols={2}>
            <Field label="Legal Entity Type" required>
              <Select name="legalEntityType" options={LEGAL_ENTITY_TYPES} value={form.legalEntityType}
                onChange={ch} disabled={locked} />
            </Field>
            <Field label="Registration Type">
              <Select name="registrationType" options={REGISTRATION_TYPES} value={form.registrationType}
                onChange={ch} placeholder="Select type…" disabled={locked} />
            </Field>
            <Field label="MCA / Registration Number">
              <Input name="mcaRegistrationNumber" value={form.mcaRegistrationNumber} onChange={ch}
                placeholder="U74999MH2022PTC123456" disabled={locked} />
            </Field>
            <Field label="PAN Number">
              <Input name="panNumber" value={form.panNumber} onChange={ch}
                placeholder="AABCE1234F" maxLength={10} disabled={locked} style={{ textTransform: 'uppercase' }} />
            </Field>
          </Grid>
          <Field label="Date of Incorporation">
            <Input name="incorporationDate" value={form.incorporationDate} onChange={ch}
              type="date" disabled={locked} />
          </Field>
        </div>
      );

      // ── Step 5: Financials ────────────────────────────────────────────────
      case 5: return (
        <div style={cardStyle}>
          <SectionHeader title="💰 Financial Overview" subtitle="Current financial snapshot. All figures in INR. This is visible only to verified investors." />
          <Grid cols={2}>
            <Field label="Annual Revenue (INR)" hint="Last 12 months">
              <Input name="annualRevenue" value={form.annualRevenue} onChange={ch} type="number"
                placeholder="5000000" min={0} disabled={locked} />
            </Field>
            <Field label="Monthly Revenue (INR)" hint="Current MRR">
              <Input name="monthlyRevenue" value={form.monthlyRevenue} onChange={ch} type="number"
                placeholder="416000" min={0} disabled={locked} />
            </Field>
            <Field label="P&L Status">
              <Select name="profitOrLoss" value={form.profitOrLoss} onChange={ch} placeholder="Select…"
                options={[
                  { value: 'profit', label: 'Profitable' },
                  { value: 'loss', label: 'Loss-making' },
                  { value: 'breakeven', label: 'Breakeven' },
                ]}
                disabled={locked} />
            </Field>
            <Field label="Monthly Burn Rate (INR)" hint="Monthly cash spend">
              <Input name="burnRate" value={form.burnRate} onChange={ch} type="number"
                placeholder="200000" min={0} disabled={locked} />
            </Field>
          </Grid>
          <Field label="Runway (months)" hint="How many months can you operate at current burn?">
            <Input name="runwayMonths" value={form.runwayMonths} onChange={ch} type="number"
              placeholder="18" min={0} disabled={locked} style={{ maxWidth: 200 }} />
          </Field>
        </div>
      );

      // ── Step 6: Documents ─────────────────────────────────────────────────
      case 6: return (
        <div style={cardStyle}>
          <SectionHeader title="📁 KYC Documents" subtitle="Identity and director proof documents for verification." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {kycDocs.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                No KYC documents added.
              </p>
            )}
            {kycDocs.map((d, i) => (
              <DocRow key={i} doc={d} index={i} categories={KYC_CATEGORIES}
                onChange={(idx, val) => setKycDocs(prev => prev.map((x, j) => j === idx ? val : x))}
                onRemove={(idx) => setKycDocs(prev => prev.filter((_, j) => j !== idx))}
                locked={locked} />
            ))}
          </div>
          {!locked && kycDocs.length < 15 && (
            <button type="button" onClick={() => setKycDocs(prev => [...prev, { ...EMPTY_KYC_DOC }])}
              className="btn btn--secondary btn--sm">
              ＋ Add KYC Document
            </button>
          )}

          <SectionHeader title="📝 Business Verification Documents"
            subtitle="Incorporate certificate, financials, pitch deck, etc." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bizDocs.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                No business documents added.
              </p>
            )}
            {bizDocs.map((d, i) => (
              <DocRow key={i} doc={d} index={i} categories={BUSINESS_DOC_CATEGORIES}
                onChange={(idx, val) => setBizDocs(prev => prev.map((x, j) => j === idx ? val : x))}
                onRemove={(idx) => setBizDocs(prev => prev.filter((_, j) => j !== idx))}
                locked={locked} />
            ))}
          </div>
          {!locked && bizDocs.length < 15 && (
            <button type="button" onClick={() => setBizDocs(prev => [...prev, { ...EMPTY_BIZ_DOC }])}
              className="btn btn--secondary btn--sm">
              ＋ Add Business Document
            </button>
          )}
        </div>
      );

      // ── Step 7: Review & Submit ───────────────────────────────────────────
      case 7: return (
        <div style={cardStyle}>
          <SectionHeader title="✅ Review & Submit" subtitle="Double-check your information before submitting for admin verification." />

          {/* Summary grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {[
              { label: 'Company', value: form.startupName || '—' },
              { label: 'Industry', value: INDUSTRIES.find(i => i.value === form.industry)?.label || '—' },
              { label: 'Stage', value: FUNDING_STAGES.find(s => s.value === form.fundingStage)?.label || '—' },
              { label: 'Team Members', value: founders.length },
              { label: 'KYC Docs', value: kycDocs.length },
              { label: 'Business Docs', value: bizDocs.length },
              { label: 'Financials Filled', value: form.annualRevenue ? 'Yes' : 'No' },
              { label: 'Pitch Summary', value: form.pitchSummary ? `${form.pitchSummary.length} chars` : 'Missing' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--r-md)', padding: '0.85rem 1rem',
              }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.25rem'
                }}>
                  {label}
                </p>
                <p style={{ fontWeight: 700, fontSize: '1rem' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Checklist */}
          <div style={{
            background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 'var(--r-md)', padding: '1.1rem'
          }}>
            <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.75rem' }}>Submission Checklist</p>
            {[
              { label: 'Startup name entered', ok: !!form.startupName.trim() },
              { label: 'Description (min 50 chars)', ok: form.description.trim().length >= 50 },
              { label: 'Industry selected', ok: !!form.industry },
              { label: 'At least one founder added', ok: founders.length > 0 && !!founders[0]?.name },
              { label: 'Pitch summary written', ok: !!form.pitchSummary.trim() },
              { label: 'At least one KYC document', ok: kycDocs.length > 0 },
            ].map(({ label, ok }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.35rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.85rem'
              }}>
                <span style={{ fontSize: '1.1rem', color: ok ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {ok ? '✓' : '✕'}
                </span>
                <span style={{ color: ok ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {!locked && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                id="startup-submit-btn"
                type="button"
                onClick={handleSubmit}
                disabled={submitting || saving}
                className="btn btn--primary"
                style={{ padding: '13px 32px', fontSize: '1rem' }}
              >
                {submitting ? (
                  <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Submitting…</>
                ) : '🚀 Submit for Verification'}
              </button>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Review takes 24–48 hours. You'll receive a notification on status change.
              </p>
            </div>
          )}
        </div>
      );

      default: return null;
    }
  };

  // ── Layout ──────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">

      {/* Page header */}
      <div className="dashboard__header" style={{ marginBottom: '1.5rem' }}>
        <h2>🏗️ Startup Profile & Onboarding</h2>
        <p className="text-muted text-sm" style={{ marginTop: '0.3rem' }}>
          Complete all sections and submit for verification to unlock fundraising campaigns.
        </p>
      </div>

      {/* Status banner (always visible if profile exists) */}
      {profileId && (
        <StatusBanner
          status={status}
          rejectionReason={rejectionReason}
          submittedAt={submittedAt}
        />
      )}

      {/* Global error */}
      {globalError && (
        <div role="alert" style={{
          padding: '0.85rem 1rem', background: 'var(--color-error-dim)',
          border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--r-md)',
          color: 'var(--color-error)', fontSize: '0.85rem', marginBottom: '1.25rem',
        }}>
          ⚠️ {globalError}
        </div>
      )}

      {/* Main layout: sidebar + content */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

        <StepSidebar current={step} onNavigate={goStep} completedSteps={completedSteps} />

        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Step header */}
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--color-text-muted)'
              }}>
                Step {step} of {STEPS.length}
              </p>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {STEPS[step - 1].icon} {STEPS[step - 1].label}
              </h3>
            </div>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {STEPS.map(s => (
                <div key={s.id} style={{
                  width: s.id === step ? 24 : 8, height: 8,
                  borderRadius: 99, transition: 'all 0.2s',
                  background: s.id === step ? 'var(--color-primary)'
                    : completedSteps.has(s.id) ? 'var(--color-success)'
                      : 'var(--color-border)',
                }} />
              ))}
            </div>
          </div>

          {/* Active step form */}
          {renderStep()}

          {/* Nav bar */}
          <div style={navBarStyle}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {step > 1 && (
                <button type="button" onClick={prev} className="btn btn--ghost">
                  ← Back
                </button>
              )}
              {step < STEPS.length && (
                <button type="button" onClick={next} className="btn btn--secondary">
                  Next →
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {!locked && (
                <button
                  type="button"
                  onClick={() => saveDraft(false)}
                  disabled={saving}
                  className="btn btn--ghost"
                  style={{ fontSize: '0.85rem' }}
                >
                  {saving ? (
                    <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Saving…</>
                  ) : '💾 Save Draft'}
                </button>
              )}
              <button type="button" onClick={() => navigate('/dashboard')} className="btn btn--ghost"
                style={{ fontSize: '0.85rem' }}>
                ← Dashboard
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
