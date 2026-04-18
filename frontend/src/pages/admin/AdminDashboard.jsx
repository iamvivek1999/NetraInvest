import React, { useState, useEffect } from 'react';
import { 
  getVerifications, 
  updateVerificationStatus, 
  getDashboardStats, 
  getUsers, 
  toggleUserStatus,
  toggleInvestorPremiumStatus
} from '../../api/admin.api';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'compliance', 'moderation'
  const [complianceSubTab, setComplianceSubTab] = useState('startup'); // 'startup' or 'investor'
  
  // Dashboard Overivew State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Compliance State
  const [complianceData, setComplianceData] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Moderation State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userFilters, setUserFilters] = useState({ search: '', role: '', page: 1 });
  const [totalUserPages, setTotalUserPages] = useState(1);

  const [error, setError] = useState('');

  // ─── Fetching Logic ────────────────────────────────────────────────────────

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await getDashboardStats();
      setStats(res.data);
    } catch (err) {
      setError('Failed to fetch platform statistics.');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchCompliance = async () => {
    try {
      setComplianceLoading(true);
      setComplianceData([]);
      if (complianceSubTab === 'startup') {
        const res = await getVerifications('startup');
        setComplianceData(res.data || []);
      } else {
        const res = await getVerifications('investor');
        setComplianceData(res.data || []);
      }
    } catch (err) {
      setError('Failed to fetch verification queue.');
    } finally {
      setComplianceLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await getUsers(userFilters);
      setUsers(res.data || []);
      setTotalUserPages(res.totalPages || 1);
    } catch (err) {
      setError('Failed to fetch user list.');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') fetchStats();
    if (activeTab === 'compliance') fetchCompliance();
    if (activeTab === 'moderation') fetchUsers();
  }, [activeTab, complianceSubTab, userFilters]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleReviewClick = (entity) => {
    setSelectedEntity(entity);
    setRejectionReason('');
    setIsComplianceModalOpen(true);
  };

  const handleStatusUpdate = async (status) => {
    if ((status === 'rejected' || status === 'more_info_required') && !rejectionReason.trim()) {
      alert(`Please provide a reason for status: ${status}`);
      return;
    }

    try {
      setUpdatingStatus(true);
      await updateVerificationStatus(complianceSubTab, selectedEntity._id, status, rejectionReason);
      setIsComplianceModalOpen(false);
      setSelectedEntity(null);
      fetchCompliance(); 
      fetchStats(); // Update backlog counts if overview is open
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      await toggleUserStatus(userId, !currentStatus);
      fetchUsers(); // Refresh list
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle user status');
    }
  };

  const handleTogglePremium = async (userId, currentPremiumStatus) => {
    try {
      if (!window.confirm(`Are you sure you want to ${currentPremiumStatus ? 'remove' : 'grant'} premium status for this investor?`)) return;
      await toggleInvestorPremiumStatus(userId, !currentPremiumStatus);
      fetchUsers(); // Refresh list
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating premium status');
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const statusColor = (status) => {
    switch (status) {
      case 'approved': 
      case 'active': return '#10b981';
      case 'pending': 
      case 'submitted': return '#fbbf24';
      case 'in_review': 
      case 'under_review': return '#3b82f6';
      case 'rejected': return '#ef4444';
      case 'more_info_required': return '#f97316';
      default: return '#6b7280';
    }
  };

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);
  };

  // ─── Render Components ────────────────────────────────────────────────────

  const OverviewTab = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
      {statsLoading ? (
        <p style={{ color: 'white' }}>Loading statistics...</p>
      ) : stats ? (
        <>
          <StatCard title="Total Platform Value" value={formatCurrency(stats.investments.totalAmount)} subtitle={`${stats.investments.totalCount} investments`} color="#10b981" />
          <StatCard title="Total Users" value={stats.users.total} subtitle={`${stats.users.startups} Startups, ${stats.users.investors} Investors`} color="#3b82f6" />
          <StatCard title="Active Campaigns" value={stats.campaigns.active || 0} subtitle={`${stats.campaigns.draft || 0} in draft`} color="#f59e0b" />
          <StatCard title="Compliance Backlog" value={stats.backlog.startups + stats.backlog.investors} subtitle={`${stats.backlog.startups} Startups, ${stats.backlog.investors} Investors pending`} color="#ef4444" />
        </>
      ) : <p>No stats data.</p>}
    </div>
  );

  const StatCard = ({ title, value, subtitle, color }) => (
    <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h3>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: color || '#fff', marginBottom: '0.25rem' }}>{value}</div>
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)' }}>{subtitle}</p>
    </div>
  );

  const ComplianceTab = () => (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setComplianceSubTab('startup')}
          style={{ ...subTabStyle, background: complianceSubTab === 'startup' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', border: complianceSubTab === 'startup' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', color: complianceSubTab === 'startup' ? '#ef4444' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}
        >Startups</button>
        <button 
          onClick={() => setComplianceSubTab('investor')}
          style={{ ...subTabStyle, background: complianceSubTab === 'investor' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', border: complianceSubTab === 'investor' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', color: complianceSubTab === 'investor' ? '#ef4444' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}
        >Investors</button>
      </div>

      <div style={{ background: '#0a0d14', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={thStyle}>Entity</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {complianceLoading ? (
              <tr><td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading...</td></tr>
            ) : complianceData.length === 0 ? (
              <tr><td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Queue empty.</td></tr>
            ) : (
              complianceData.map(item => (
                <tr key={item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={tdStyle}>
                      <>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{complianceSubTab === 'startup' ? item.companyName : `${item.firstName} ${item.lastName}`}</div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{item.userId?.email || 'No Email'}</div>
                      </>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      background: `${statusColor(item.verificationStatus)}15`,
                      color: statusColor(item.verificationStatus),
                      padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase'
                    }}>{item.verificationStatus}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button onClick={() => handleReviewClick(item)} style={actionBtnStyle}>Review Docs</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const ModerationTab = () => (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <input 
          type="text" 
          placeholder="Search by email..."
          value={userFilters.search}
          onChange={(e) => setUserFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
          style={inputStyle}
        />
        <select 
          value={userFilters.role} 
          onChange={(e) => setUserFilters(prev => ({ ...prev, role: e.target.value, page: 1 }))}
          style={{ ...inputStyle, width: 'auto' }}
        >
          <option value="">All Roles</option>
          <option value="startup">Startups</option>
          <option value="investor">Investors</option>
        </select>
      </div>

      <div style={{ background: '#0a0d14', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={thStyle}>User</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Operations</th>
            </tr>
          </thead>
          <tbody>
            {usersLoading ? (
               <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading users...</td></tr>
            ) : users.length === 0 ? (
               <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No users found.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={tdStyle}>
                    <div style={{ color: '#fff', fontWeight: 500 }}>{u.email}</div>
                    <div style={{ fontSize: '0.7rem', color: u.isEmailVerified ? '#10b981' : '#f59e0b' }}>
                      {u.isEmailVerified ? 'Verified' : 'Unverified Email'}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>{u.role}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{new Date(u.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: u.isActive ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>
                      {u.isActive ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    {u.role === 'investor' && (
                       <button 
                         onClick={() => handleTogglePremium(u._id, u.premiumStatus)}
                         style={{
                           ...actionBtnStyle,
                           background: u.premiumStatus ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                           color: u.premiumStatus ? '#f59e0b' : 'rgba(255,255,255,0.6)',
                           border: u.premiumStatus ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(255,255,255,0.2)'
                         }}
                       >
                         {u.premiumStatus ? 'Revoke Premium' : 'Grant Premium'}
                       </button>
                    )}
                    <button 
                      onClick={() => handleToggleActive(u._id, u.isActive)}
                      style={{
                        ...actionBtnStyle,
                        background: u.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: u.isActive ? '#ef4444' : '#10b981',
                        border: u.isActive ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {totalUserPages > 1 && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
           <button 
            disabled={userFilters.page === 1} 
            onClick={() => setUserFilters(p => ({ ...p, page: p.page - 1 }))}
            style={pageBtnStyle}
           >Previous</button>
           <span style={{ color: 'rgba(255,255,255,0.5)', alignSelf: 'center' }}>Page {userFilters.page} of {totalUserPages}</span>
           <button 
            disabled={userFilters.page === totalUserPages} 
            onClick={() => setUserFilters(p => ({ ...p, page: p.page + 1 }))}
            style={pageBtnStyle}
           >Next</button>
        </div>
      )}
    </div>
  );

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem 3rem 1rem' }}>
      
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#fff', letterSpacing: '-0.02em' }}>Command Center</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '1.1rem' }}>Executive oversight and platform governance.</p>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
          Platform Stable • {new Date().toLocaleDateString()}
        </div>
      </header>

      {/* Main Tabs */}
      <nav style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <TabButton label="Overview" icon="📊" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
        <TabButton label="Compliance" icon="🛡️" active={activeTab === 'compliance'} onClick={() => setActiveTab('compliance')} />
        <TabButton label="Moderation" icon="⚖️" active={activeTab === 'moderation'} onClick={() => setActiveTab('moderation')} />
      </nav>

      {error && (
        <div style={errorBannerStyle}>{error}</div>
      )}

      {/* Content Area */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'compliance' && <ComplianceTab />}
      {activeTab === 'moderation' && <ModerationTab />}

      {/* Reused Compliance Modal */}
      {isComplianceModalOpen && selectedEntity && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Verification Review</h2>
              <button onClick={() => setIsComplianceModalOpen(false)} style={closeBtnStyle}>✕</button>
            </div>
            <div style={{ padding: '2rem' }}>
               <h3 style={{ margin: '0 0 1rem 0', color: '#fff' }}>
                 {complianceSubTab === 'campaign' 
                    ? selectedEntity.title 
                    : complianceSubTab === 'startup' 
                        ? selectedEntity.companyName 
                        : `${selectedEntity.firstName} ${selectedEntity.lastName}`}
               </h3>
               
               {complianceSubTab === 'campaign' ? (
                 <div style={{ marginBottom: '1.5rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                    <p><strong>Goal:</strong> {formatCurrency(selectedEntity.targetAmount)} | <strong>Min:</strong> {formatCurrency(selectedEntity.minimumInvestment)}</p>
                    <p style={{ marginTop: '0.5rem', lineHeight: '1.5' }}><strong>Description:</strong> {selectedEntity.shortSummary}</p>
                    {selectedEntity.campaignDocuments && selectedEntity.campaignDocuments.length > 0 && (
                      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                         <p style={{ margin: 0, fontWeight: 600 }}>Documents:</p>
                         {selectedEntity.campaignDocuments.map((doc, idx) => (
                           <div key={idx} style={docItemStyle}>
                             <div>
                               <span style={{ display: 'block', color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{doc.documentType.toUpperCase()}</span>
                               <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{doc.fileName || 'document.pdf'}</span>
                             </div>
                             <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={viewDocLinkStyle}>View ↗</a>
                           </div>
                         ))}
                      </div>
                    )}
                 </div>
               ) : (
                 <div style={{ marginBottom: '1.5rem' }}>
                   <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '1rem' }}>Please verify the following documents carefully before approval.</p>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {selectedEntity.documents?.map((doc, idx) => (
                        <div key={idx} style={docItemStyle}>
                          <div>
                            <span style={{ display: 'block', color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{doc.documentType.toUpperCase()}</span>
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{doc.fileName || 'document.pdf'}</span>
                          </div>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={viewDocLinkStyle}>View ↗</a>
                        </div>
                      ))}
                   </div>
                 </div>
               )}

               <textarea 
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reviewer notes or reason for rejection/clarification..."
                  style={textareaStyle}
                />
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => handleStatusUpdate('approved')} disabled={updatingStatus} style={{ ...statusBtnStyle, background: '#10b981' }}>Approve</button>
                  <button onClick={() => handleStatusUpdate('more_info_required')} disabled={updatingStatus} style={{ ...statusBtnStyle, background: '#f59e0b' }}>Need Info</button>
                  <button onClick={() => handleStatusUpdate('rejected')} disabled={updatingStatus} style={{ ...statusBtnStyle, background: '#ef4444' }}>Reject</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styled Components (Objects) ───────────────────────────────────────────

const TabButton = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: 'transparent', border: 'none', padding: '1rem 0.5rem',
      color: active ? '#fff' : 'rgba(255,255,255,0.4)',
      borderBottom: active ? '2px solid #ef4444' : '2px solid transparent',
      cursor: 'pointer', fontSize: '1rem', fontWeight: 600, transition: 'all 0.2s',
      display: 'flex', alignItems: 'center', gap: '0.6rem'
    }}
  >
    <span>{icon}</span> {label}
  </button>
);

const thStyle = { padding: '1.25rem 1.5rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '1.25rem 1.5rem' };
const subTabStyle = { padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' };
const actionBtnStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 };
const inputStyle = { background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.6rem 1rem', color: '#fff', fontSize: '0.9rem', outline: 'none', width: '300px' };
const pageBtnStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' };
const errorBannerStyle = { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.9rem' };

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '2rem' };
const modalContentStyle = { background: '#0a0d14', width: '100%', maxWidth: '560px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' };
const modalHeaderStyle = { padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const closeBtnStyle = { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.25rem' };
const docItemStyle = { padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const viewDocLinkStyle = { color: '#3b82f6', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 };
const textareaStyle = { width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem', color: '#fff', minHeight: '100px', fontSize: '0.9rem', marginBottom: '1.5rem', outline: 'none' };
const statusBtnStyle = { flex: 1, padding: '1rem', border: 'none', borderRadius: '12px', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', transition: 'transform 0.2s' };
