/**
 * src/pages/dashboard/StartupProfile.jsx
 *
 * Unified create/edit startup profile page.
 *
 * Behaviour:
 *   - On mount: calls GET /api/v1/startups/me
 *     • 404 / null → "create" mode (empty form, POST on submit)
 *     • data returned → "edit" mode   (form pre-filled, PATCH on submit)
 *   - profileCompleteness + completenessLabel returned by backend virtual
 *   - teamMembers are managed as a local array with add/remove controls
 *   - documents  are managed as a local array with add/remove controls
 *   - Tags are a comma-separated string internally, split before sending
 *
 * Fields mirror StartupProfile schema exactly, grouped for UX clarity:
 *   Section 1 — Core identity (startupName, tagline, description, industry, tags)
 *   Section 2 — Business details (website, location, foundedYear, teamSize, fundingStage)
 *   Section 3 — Social links (twitter, linkedIn, github)
 *   Section 4 — Team members  (array of { name, role, bio, linkedIn })
 *   Section 5 — Documents     (array of { docType, url, label })
 */

import { useState, useEffect } from 'react';
import { useNavigate }        from 'react-router-dom';
import toast                  from 'react-hot-toast';

import {
  getMyStartupProfile,
  createStartupProfile,
  updateStartupProfile,
} from '../../api/startups.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { value: 'fintech',    label: 'Fintech'      },
  { value: 'healthtech', label: 'Healthtech'   },
  { value: 'edtech',     label: 'Edtech'       },
  { value: 'ecommerce',  label: 'E-commerce'   },
  { value: 'agritech',   label: 'Agritech'     },
  { value: 'saas',       label: 'SaaS'         },
  { value: 'logistics',  label: 'Logistics'    },
  { value: 'cleantech',  label: 'Cleantech'    },
  { value: 'proptech',   label: 'Proptech'     },
  { value: 'other',      label: 'Other'        },
];

const FUNDING_STAGES = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed',     label: 'Seed'     },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'other',    label: 'Other'    },
];

const DOC_TYPES = [
  { value: 'pitch_deck',    label: 'Pitch Deck'    },
  { value: 'financials',    label: 'Financials'    },
  { value: 'legal',         label: 'Legal'         },
  { value: 'product_demo',  label: 'Product Demo'  },
  { value: 'other',         label: 'Other'         },
];

const EMPTY_MEMBER  = { name: '', role: '', bio: '', linkedIn: '' };
const EMPTY_DOCUMENT = { docType: 'pitch_deck', url: '', label: '' };

// ─── Completeness Bar ─────────────────────────────────────────────────────────

function CompletenessBar({ score, label }) {
  const color =
    score >= 90 ? 'var(--color-success)' :
    score >= 70 ? 'var(--color-secondary)' :
    score >= 50 ? 'var(--color-warning)' :
    'var(--color-error)';

  return (
    <div style={{
      background:   'rgba(99,102,241,0.06)',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--r-lg)',
      padding:      '1rem 1.25rem',
      marginBottom: '2rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Profile Completeness</span>
        <span style={{ fontSize: '0.85rem', color, fontWeight: 700 }}>
          {score}% — {label}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height:           '100%',
          width:            `${score}%`,
          background:       `linear-gradient(90deg, var(--color-primary), ${color})`,
          borderRadius:     99,
          transition:       'width 0.6s ease',
        }} />
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        Add a team member and at least one document to reach 100%.
      </p>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
      <h3 style={{ marginBottom: '0.25rem' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: 'none' }}>{subtitle}</p>}
    </div>
  );
}

// ─── Dynamic team member row ──────────────────────────────────────────────────

function MemberRow({ member, index, onChange, onRemove }) {
  const change = (field, val) => onChange(index, { ...member, [field]: val });
  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--r-md)',
      padding:      '1rem',
      display:      'grid',
      gridTemplateColumns: '1fr 1fr',
      gap:          '0.75rem',
      position:     'relative',
    }}>
      <div className="form-group">
        <label className="form-label form-label--req">Name</label>
        <input className="form-input" placeholder="Jane Smith" value={member.name}
          onChange={e => change('name', e.target.value)} maxLength={80} />
      </div>
      <div className="form-group">
        <label className="form-label form-label--req">Role / Title</label>
        <input className="form-input" placeholder="CTO" value={member.role}
          onChange={e => change('role', e.target.value)} maxLength={80} />
      </div>
      <div className="form-group">
        <label className="form-label">Short bio</label>
        <input className="form-input" placeholder="5+ years in backend engineering…" value={member.bio || ''}
          onChange={e => change('bio', e.target.value)} maxLength={500} />
      </div>
      <div className="form-group">
        <label className="form-label">LinkedIn URL</label>
        <input className="form-input" placeholder="https://linkedin.com/in/…" value={member.linkedIn || ''}
          onChange={e => change('linkedIn', e.target.value)} />
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        style={{
          position: 'absolute', top: '0.75rem', right: '0.75rem',
          background: 'var(--color-error-dim)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: '0.75rem',
          color: 'var(--color-error)', cursor: 'pointer',
        }}
      >
        ✕ Remove
      </button>
    </div>
  );
}

// ─── Dynamic document row ─────────────────────────────────────────────────────

function DocumentRow({ doc, index, onChange, onRemove }) {
  const change = (field, val) => onChange(index, { ...doc, [field]: val });
  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--r-md)',
      padding:      '1rem',
      display:      'grid',
      gridTemplateColumns: '180px 1fr 1fr',
      gap:          '0.75rem',
      alignItems:   'end',
      position:     'relative',
    }}>
      <div className="form-group">
        <label className="form-label form-label--req">Type</label>
        <select className="form-input form-select" value={doc.docType}
          onChange={e => change('docType', e.target.value)}>
          {DOC_TYPES.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label form-label--req">URL / Link</label>
        <input className="form-input" placeholder="https://drive.google.com/…" value={doc.url}
          onChange={e => change('url', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Label (optional)</label>
        <input className="form-input" placeholder="Q1 2025 Pitch Deck" value={doc.label || ''}
          onChange={e => change('label', e.target.value)} maxLength={100} />
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        style={{
          position: 'absolute', top: '0.75rem', right: '0.75rem',
          background: 'var(--color-error-dim)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: '0.75rem',
          color: 'var(--color-error)', cursor: 'pointer',
        }}
      >
        ✕ Remove
      </button>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function StartupProfilePage() {
  const navigate = useNavigate();

  // Fetch state
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  // Profile metadata: null = not yet created
  const [profileId,    setProfileId]    = useState(null);
  const [completeness, setCompleteness] = useState({ score: 0, label: 'Incomplete' });

  // ── Core form state ────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    startupName:  '',
    tagline:      '',
    description:  '',
    industry:     '',
    tags:         '',          // comma-separated string, converted to array on submit
    fundingStage: 'pre_seed',
    website:      '',
    city:         '',
    country:      '',
    foundedYear:  '',
    teamSize:     '',
    twitter:      '',
    linkedIn:     '',
    github:       '',
  });

  // ── Dynamic arrays ─────────────────────────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState([]);
  const [documents,   setDocuments]   = useState([]);

  // ── Fetch existing profile on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const profile = await getMyStartupProfile();
        if (cancelled) return;

        if (profile) {
          setProfileId(profile._id);
          setCompleteness({
            score: profile.profileCompleteness  ?? 0,
            label: profile.completenessLabel    ?? 'Incomplete',
          });
          // Hydrate form
          setForm({
            startupName:  profile.startupName  || '',
            tagline:      profile.tagline       || '',
            description:  profile.description   || '',
            industry:     profile.industry      || '',
            tags:         (profile.tags || []).join(', '),
            fundingStage: profile.fundingStage  || 'pre_seed',
            website:      profile.website       || '',
            city:         profile.location?.city    || '',
            country:      profile.location?.country || '',
            foundedYear:  profile.foundedYear   ? String(profile.foundedYear) : '',
            teamSize:     profile.teamSize      ? String(profile.teamSize)     : '',
            twitter:      profile.socialLinks?.twitter  || '',
            linkedIn:     profile.socialLinks?.linkedIn || '',
            github:       profile.socialLinks?.github   || '',
          });
          setTeamMembers(profile.teamMembers?.map(m => ({
            name:     m.name      || '',
            role:     m.role      || '',
            bio:      m.bio       || '',
            linkedIn: m.linkedIn  || '',
          })) || []);
          setDocuments(profile.documents?.map(d => ({
            docType: d.docType || 'other',
            url:     d.url     || '',
            label:   d.label   || '',
          })) || []);
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Field handlers ─────────────────────────────────────────────────────────
  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const updateMember   = (i, val) => setTeamMembers(prev => prev.map((m, idx) => idx === i ? val : m));
  const removeMember   = (i)      => setTeamMembers(prev => prev.filter((_, idx) => idx !== i));
  const addMember      = ()       => setTeamMembers(prev => [...prev, { ...EMPTY_MEMBER }]);

  const updateDocument = (i, val) => setDocuments(prev => prev.map((d, idx) => idx === i ? val : d));
  const removeDocument = (i)      => setDocuments(prev => prev.filter((_, idx) => idx !== i));
  const addDocument    = ()       => setDocuments(prev => [...prev, { ...EMPTY_DOCUMENT }]);

  // ── Validate ───────────────────────────────────────────────────────────────
  const validate = () => {
    if (!form.startupName.trim()) return 'Startup name is required.';
    if (!form.description.trim()) return 'Description is required.';
    if (form.description.trim().length < 50) return 'Description must be at least 50 characters.';
    if (!form.industry)           return 'Please select an industry.';

    for (const [i, m] of teamMembers.entries()) {
      if (!m.name.trim()) return `Team member ${i + 1}: name is required.`;
      if (!m.role.trim()) return `Team member ${i + 1}: role is required.`;
    }
    for (const [i, d] of documents.entries()) {
      if (!d.url.trim()) return `Document ${i + 1}: URL is required.`;
    }
    return null;
  };

  // ── Build payload matching backend UPDATABLE_FIELDS ───────────────────────
  const buildPayload = () => ({
    startupName:  form.startupName.trim(),
    tagline:      form.tagline.trim()      || undefined,
    description:  form.description.trim(),
    industry:     form.industry,
    tags:         form.tags
                    .split(',')
                    .map(t => t.trim())
                    .filter(Boolean)
                    .slice(0, 10),
    fundingStage: form.fundingStage,
    website:      form.website.trim()      || undefined,
    location: {
      city:    form.city.trim()    || undefined,
      country: form.country.trim() || undefined,
    },
    foundedYear:  form.foundedYear ? parseInt(form.foundedYear, 10) : undefined,
    teamSize:     form.teamSize    ? parseInt(form.teamSize,    10) : undefined,
    socialLinks: {
      twitter:  form.twitter.trim()  || null,
      linkedIn: form.linkedIn.trim() || null,
      github:   form.github.trim()   || null,
    },
    teamMembers: teamMembers.map(m => ({
      name:     m.name.trim(),
      role:     m.role.trim(),
      bio:      m.bio?.trim()      || undefined,
      linkedIn: m.linkedIn?.trim() || undefined,
    })),
    documents: documents.map(d => ({
      docType: d.docType,
      url:     d.url.trim(),
      label:   d.label?.trim() || undefined,
    })),
  });

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      let saved;

      if (profileId) {
        // Edit mode → PATCH
        saved = await updateStartupProfile(profileId, payload);
        toast.success('Profile updated successfully! ✅');
      } else {
        // Create mode → POST
        saved = await createStartupProfile(payload);
        setProfileId(saved._id);
        toast.success('Startup profile created! 🎉');
      }

      setCompleteness({
        score: saved.profileCompleteness  ?? 0,
        label: saved.completenessLabel    ?? 'Incomplete',
      });

      // Brief delay so toast is visible, then go back to dashboard
      setTimeout(() => navigate('/dashboard'), 1200);

    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save profile.';
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-fade-in" style={{ padding: '2rem 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[240, 180, 300, 180].map((h, i) => (
            <div key={i} className="skeleton" style={{ height: h, borderRadius: 'var(--r-lg)' }} />
          ))}
        </div>
      </div>
    );
  }

  const isEditing = !!profileId;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 780 }}>

      {/* Page header */}
      <div className="dashboard__header">
        <h2>{isEditing ? '✏️ Edit Startup Profile' : '🏢 Create Startup Profile'}</h2>
        <p className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
          {isEditing
            ? 'Update your startup profile. Changes are reflected immediately.'
            : 'Complete your profile before creating fundraising campaigns.'}
        </p>
      </div>

      {/* Completeness bar — only visible in edit mode */}
      {isEditing && (
        <CompletenessBar score={completeness.score} label={completeness.label} />
      )}

      {/* Global error */}
      {error && (
        <div role="alert" style={{
          padding:      '0.85rem 1rem',
          background:   'var(--color-error-dim)',
          border:       '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--r-md)',
          color:        'var(--color-error)',
          fontSize:     '0.85rem',
          marginBottom: '1.5rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>

        {/* ── Section 1: Core identity ─────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <SectionHeader title="🆔 Core Identity" subtitle="Required — this is how investors will find and understand your startup." />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div className="form-group">
              <label className="form-label form-label--req" htmlFor="sp-name">Startup name</label>
              <input id="sp-name" name="startupName" className="form-input"
                placeholder="Enigma Logistics" value={form.startupName}
                onChange={handleChange} maxLength={100} required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="sp-tagline">Tagline</label>
              <input id="sp-tagline" name="tagline" className="form-input"
                placeholder="On-chain logistics for the last mile." value={form.tagline}
                onChange={handleChange} maxLength={160} />
              <span className="form-hint">{form.tagline.length}/160</span>
            </div>

            <div className="form-group">
              <label className="form-label form-label--req" htmlFor="sp-desc">Description</label>
              <textarea id="sp-desc" name="description" className="form-input form-textarea"
                placeholder="Describe your startup: what problem you solve, your solution, traction, and vision. Min 50 characters."
                value={form.description} onChange={handleChange}
                maxLength={3000} rows={5} />
              <span className="form-hint">{form.description.length}/3000 (min 50)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label form-label--req" htmlFor="sp-industry">Industry</label>
                <select id="sp-industry" name="industry" className="form-input form-select"
                  value={form.industry} onChange={handleChange} required>
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(i => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="sp-funding">Funding stage</label>
                <select id="sp-funding" name="fundingStage" className="form-input form-select"
                  value={form.fundingStage} onChange={handleChange}>
                  {FUNDING_STAGES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="sp-tags">Tags</label>
              <input id="sp-tags" name="tags" className="form-input"
                placeholder="blockchain, supply-chain, b2b  (comma-separated, max 10)"
                value={form.tags} onChange={handleChange} />
              <span className="form-hint">Comma-separated · max 10 tags</span>
            </div>

          </div>
        </div>

        {/* ── Section 2: Business details ──────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <SectionHeader title="📋 Business Details" subtitle="Help investors understand your stage and location." />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div className="form-group">
              <label className="form-label" htmlFor="sp-website">Website</label>
              <input id="sp-website" name="website" className="form-input" type="url"
                placeholder="https://yourstartup.com" value={form.website}
                onChange={handleChange} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="sp-city">City</label>
                <input id="sp-city" name="city" className="form-input"
                  placeholder="Bengaluru" value={form.city} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sp-country">Country</label>
                <input id="sp-country" name="country" className="form-input"
                  placeholder="India" value={form.country} onChange={handleChange} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="sp-year">Founded year</label>
                <input id="sp-year" name="foundedYear" className="form-input" type="number"
                  placeholder={new Date().getFullYear()} value={form.foundedYear}
                  onChange={handleChange} min={1900} max={new Date().getFullYear()} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sp-teamsize">Team size</label>
                <input id="sp-teamsize" name="teamSize" className="form-input" type="number"
                  placeholder="5" value={form.teamSize}
                  onChange={handleChange} min={1} max={10000} />
              </div>
            </div>

          </div>
        </div>

        {/* ── Section 3: Social links ──────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <SectionHeader title="🔗 Social Links" subtitle="Optional — adds credibility for investors." />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="sp-twitter">Twitter / X</label>
              <input id="sp-twitter" name="twitter" className="form-input"
                placeholder="https://x.com/yourstartup" value={form.twitter}
                onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sp-linkedin">LinkedIn page</label>
              <input id="sp-linkedin" name="linkedIn" className="form-input"
                placeholder="https://linkedin.com/company/yourstartup" value={form.linkedIn}
                onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sp-github">GitHub</label>
              <input id="sp-github" name="github" className="form-input"
                placeholder="https://github.com/yourstartup" value={form.github}
                onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* ── Section 4: Team members ──────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <SectionHeader
            title="👥 Team Members"
            subtitle="Add at least one team member to unlock 20% completeness. Max 20 members."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {teamMembers.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                No team members added yet. Add at least one.
              </p>
            )}
            {teamMembers.map((m, i) => (
              <MemberRow key={i} member={m} index={i}
                onChange={updateMember} onRemove={removeMember} />
            ))}
          </div>

          {teamMembers.length < 20 && (
            <button type="button" onClick={addMember} className="btn btn--secondary btn--sm">
              ＋ Add Team Member
            </button>
          )}
        </div>

        {/* ── Section 5: Documents ─────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <SectionHeader
            title="📁 Documents"
            subtitle="Add links to your pitch deck, financials, or demos. Unlocks 20% completeness. Max 10 documents."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {documents.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                No documents added yet. Add your pitch deck or product demo.
              </p>
            )}
            {documents.map((d, i) => (
              <DocumentRow key={i} doc={d} index={i}
                onChange={updateDocument} onRemove={removeDocument} />
            ))}
          </div>

          {documents.length < 10 && (
            <button type="button" onClick={addDocument} className="btn btn--secondary btn--sm">
              ＋ Add Document
            </button>
          )}
        </div>

        {/* ── Submit row ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingBottom: '2rem' }}>
          <button
            type="submit"
            id="profile-submit"
            className="btn btn--primary"
            style={{ padding: '13px 32px' }}
            disabled={saving}
          >
            {saving ? (
              <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                {isEditing ? 'Updating…' : 'Creating…'}
              </>
            ) : (
              isEditing ? '✅ Save Changes' : '🚀 Create Profile'
            )}
          </button>

          <button type="button" className="btn btn--ghost"
            onClick={() => navigate('/dashboard')}>
            Cancel
          </button>

          {isEditing && (
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Profile ID: {profileId?.slice(-8)}
            </span>
          )}
        </div>

      </form>
    </div>
  );
}
