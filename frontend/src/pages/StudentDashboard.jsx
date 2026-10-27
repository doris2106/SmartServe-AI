import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  PlusCircle, Search, Filter, Clock, CheckCircle2, AlertTriangle,
  FileText, ExternalLink, RefreshCw, X, Building, MapPin, Tag
} from 'lucide-react';

export default function StudentDashboard({ setTab }) {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.getMyComplaints();
      if (res.success) {
        setComplaints(res.complaints);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const openTicketDetails = async (id) => {
    setSelectedTicket(id);
    setLoadingDetails(true);
    try {
      const res = await api.getComplaintById(id);
      if (res.success) {
        setTicketDetails(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Stats calculation
  const total = complaints.length;
  const inProgress = complaints.filter(c => ['Assigned', 'In Progress'].includes(c.status)).length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;
  const submitted = complaints.filter(c => c.status === 'Submitted').length;

  const filtered = complaints.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
                          c.ticket_id.toLowerCase().includes(search.toLowerCase()) ||
                          c.building.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
            Welcome back, {user?.name}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Track and manage your campus service requests & facility issues
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchComplaints}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setTab('new-complaint')}>
            <PlusCircle size={18} /> Lodge Complaint
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Submitted</div>
            <div className="stat-val">{total}</div>
          </div>
          <FileText size={28} color="#2563eb" />
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Awaiting Assignment</div>
            <div className="stat-val" style={{ color: '#0284c7' }}>{submitted}</div>
          </div>
          <Clock size={28} color="#0284c7" />
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Active / In Progress</div>
            <div className="stat-val" style={{ color: '#d97706' }}>{inProgress}</div>
          </div>
          <AlertTriangle size={28} color="#d97706" />
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Successfully Resolved</div>
            <div className="stat-val" style={{ color: '#16a34a' }}>{resolved}</div>
          </div>
          <CheckCircle2 size={28} color="#16a34a" />
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px' }}
              placeholder="Search by ticket ID, title, or building..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={16} color="#64748b" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Status:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '8px 12px' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Title & Details</th>
              <th>Category</th>
              <th>Building & Location</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Loading your complaints from AWS RDS...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>No complaints found</div>
                  <p style={{ marginTop: '4px', fontSize: '0.9rem' }}>You have not submitted any service requests matching this filter.</p>
                  <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setTab('new-complaint')}>
                    <PlusCircle size={16} /> Submit New Complaint
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map(c => {
                const statusClass = `badge-${c.status.toLowerCase().replace(' ', '-')}`;
                const priorityClass = `priority-${c.priority.toLowerCase()}`;
                return (
                  <tr key={c.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#2563eb', fontFamily: 'monospace' }}>
                        {c.ticket_id}
                      </span>
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.description}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: '#334155' }}>{c.category_name}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{c.building}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.location_details}</div>
                    </td>
                    <td>
                      <span className={`badge ${priorityClass}`}>{c.priority}</span>
                    </td>
                    <td>
                      <span className={`badge ${statusClass}`}>{c.status}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => openTicketDetails(c.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
                    {ticketDetails?.complaint?.ticket_id}
                  </span>
                  <span className={`badge badge-${ticketDetails?.complaint?.status?.toLowerCase().replace(' ', '-')}`}>
                    {ticketDetails?.complaint?.status}
                  </span>
                  <span className={`badge priority-${ticketDetails?.complaint?.priority?.toLowerCase()}`}>
                    {ticketDetails?.complaint?.priority}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                  {ticketDetails?.complaint?.title}
                </h3>
              </div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setSelectedTicket(null)}
              >
                <X size={22} />
              </button>
            </div>

            {loadingDetails ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading details...</div>
            ) : ticketDetails ? (
              <div>
                {/* Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Building:</span> <strong>{ticketDetails.complaint.building}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Location:</span> <strong>{ticketDetails.complaint.location_details}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Category:</span> <strong>{ticketDetails.complaint.category_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Assigned To:</span> <strong>{ticketDetails.complaint.assigned_staff_name || 'Pending assignment'}</strong>
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>Issue Description:</div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', color: '#334155', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    {ticketDetails.complaint.description}
                  </div>
                </div>

                {/* S3 Attachment */}
                {ticketDetails.complaint.attachment_url && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                      Supporting Attachment (Stored in Amazon S3):
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={20} color="#2563eb" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{ticketDetails.complaint.attachment_filename || 'Attachment file'}</span>
                      </div>
                      <a
                        href={ticketDetails.complaint.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        <ExternalLink size={14} /> Open Presigned S3 Link
                      </a>
                    </div>
                  </div>
                )}

                {/* Resolution Remarks */}
                {ticketDetails.complaint.resolution_notes && (
                  <div style={{ marginBottom: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 700, color: '#166534', marginBottom: '4px' }}>Resolution Remarks:</div>
                    <div style={{ color: '#15803d', fontSize: '0.9rem' }}>{ticketDetails.complaint.resolution_notes}</div>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '10px' }}>Activity & Audit Timeline:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {ticketDetails.timeline?.map((step, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', marginTop: '6px' }} />
                        <div>
                          <div>
                            <strong>{step.updated_by_name}</strong>{' '}
                            <span style={{ color: '#64748b' }}>({step.updated_by_role})</span>
                            {step.new_status && (
                              <span style={{ marginLeft: '6px' }}>
                                updated status to <span style={{ fontWeight: 600 }}>{step.new_status}</span>
                              </span>
                            )}
                          </div>
                          {step.remarks && <div style={{ color: '#475569', marginTop: '2px' }}>{step.remarks}</div>}
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            {new Date(step.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

