import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Sparkles, Upload, AlertTriangle, CheckCircle2, ArrowRight,
  Shield, Info, RefreshCw, X
} from 'lucide-react';

export default function NewComplaintPage({ setTab }) {
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [building, setBuilding] = useState('Main Academic Block');
  const [locationDetails, setLocationDetails] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  useEffect(() => {
    api.getMetadata().then(res => {
      if (res.success) setCategories(res.categories);
    }).catch(console.error);
  }, []);

  // Debounced real-time AI assistant
  useEffect(() => {
    if (title.length < 5 && description.length < 10) {
      setAiAnalysis(null);
      return;
    }

    const timer = setTimeout(async () => {
      setAnalyzing(true);
      try {
        const res = await api.analyzeDraft({ title, description, building });
        if (res.success && res.analysis) {
          setAiAnalysis(res.analysis);
        }
      } catch (err) {
        console.error('AI draft analysis error:', err);
      } finally {
        setAnalyzing(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [title, description, building]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit.');
        return;
      }
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(selected));
      } else {
        setFilePreview(null);
      }
    }
  };

  const applyAiSuggestions = () => {
    if (!aiAnalysis) return;
    if (aiAnalysis.suggestedPriority) {
      setPriority(aiAnalysis.suggestedPriority);
    }
    const matched = categories.find(c => c.name === aiAnalysis.suggestedCategory);
    if (matched) {
      setCategoryId(matched.id.toString());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title || !description || !building || !locationDetails) {
      return setError('Please fill in all mandatory fields.');
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('building', building);
      formData.append('location_details', locationDetails);
      formData.append('priority', priority);
      if (categoryId) formData.append('category_id', categoryId);
      if (file) formData.append('attachment', file);

      const res = await api.createComplaint(formData);
      if (res.success) {
        setSuccessResult(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <div style={{ maxWidth: '580px', margin: '40px auto' }}>
        <div className="card" style={{ padding: '36px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', background: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>Complaint Registered!</h2>
          <p style={{ color: '#64748b', marginTop: '6px' }}>
            Your issue has been logged, enqueued to AWS SQS, and dispatched to maintenance.
          </p>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', margin: '24px 0', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>Generated Ticket ID:</span>
              <strong style={{ color: '#2563eb', fontFamily: 'monospace', fontSize: '1.1rem' }}>{successResult.ticket_id}</strong>
            </div>
            {successResult.ai_insights && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>AI Urgency Score:</span>
                  <span className="badge priority-high">{successResult.ai_insights.urgencyScore} / 10.0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>AI Auto-Classification:</span>
                  <span style={{ fontWeight: 600 }}>{successResult.ai_insights.suggestedCategory}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>AWS Pipeline Status:</span>
              <span className="badge badge-resolved">Enqueued to SQS & S3</span>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setTab('dashboard')}>
            View on My Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
          Lodge Campus Service Request
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          SmartServe AI automatically assesses urgency, checks for duplicate reports, and routes to the right team.
        </p>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Real-time AI Assistant Banner */}
      {aiAnalysis && (
        <div className="ai-assistant-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#2563eb" />
              <strong style={{ color: '#1e3a8a', fontSize: '0.95rem' }}>SmartServe AI Assistant</strong>
              {analyzing && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(analyzing...)</span>}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.78rem', background: '#fff' }}
              onClick={applyAiSuggestions}
            >
              Apply AI Suggestions
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: '#475569' }}>Suggested Category:</span>{' '}
              <strong>{aiAnalysis.suggestedCategory}</strong>{' '}
              <span style={{ fontSize: '0.75rem', color: '#0369a1' }}>({Math.round(aiAnalysis.confidence * 100)}% confidence)</span>
            </div>
            <div>
              <span style={{ color: '#475569' }}>Calculated Urgency:</span>{' '}
              <span className={`badge priority-${aiAnalysis.suggestedPriority?.toLowerCase()}`}>
                {aiAnalysis.suggestedPriority} (Score: {aiAnalysis.urgencyScore}/10)
              </span>
            </div>
          </div>

          {/* Duplicate Detection Warning */}
          {aiAnalysis.duplicateDetection?.isSimilar && (
            <div style={{ marginTop: '12px', background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '10px 12px', borderRadius: '6px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>
                <strong>Potential Duplicate Detected:</strong> A similar complaint is already active (Ticket: <strong>{aiAnalysis.duplicateDetection.ticketId}</strong> with {Math.round(aiAnalysis.duplicateDetection.similarityScore * 100)}% similarity).
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Form */}
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Issue Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Projector lamp blinking and turning off in Seminar Hall A-402"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Campus Building *</label>
              <select
                className="form-select"
                value={building}
                onChange={e => setBuilding(e.target.value)}
                required
              >
                <option value="Main Academic Block">Main Academic Block</option>
                <option value="Engineering Building">Engineering Building</option>
                <option value="Computer Science & IT Block">Computer Science & IT Block</option>
                <option value="Library Block">Library Block</option>
                <option value="Student Hostel Block A">Student Hostel Block A</option>
                <option value="Student Hostel Block B">Student Hostel Block B</option>
                <option value="Sports Complex & Canteen">Sports Complex & Canteen</option>
                <option value="Administrative Building">Administrative Building</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Exact Room / Location Details *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 4th Floor, Seminar Hall A-402, Left Wing"
                value={locationDetails}
                onChange={e => setLocationDetails(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Category (AI will auto-suggest if left blank)</label>
              <select
                className="form-select"
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="">-- Let AI Auto-Classify --</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority Level</label>
              <select
                className="form-select"
                value={priority}
                onChange={e => setPriority(e.target.value)}
              >
                <option value="Low">Low - Minor cosmetic / non-blocking</option>
                <option value="Medium">Medium - Regular classroom / lab issue</option>
                <option value="High">High - Major disruption to lectures or labs</option>
                <option value="Critical">Critical - Safety risk, power spark, or flooding</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Description *</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Describe the issue, when it started, and any symptoms (e.g. sparking switchboard, water dripping on electrical wires, no internet access across all devices)..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          {/* S3 Attachment Upload */}
          <div className="form-group">
            <label className="form-label">Supporting Photograph or PDF Document (Stored in Amazon S3)</label>
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '20px', textAlign: 'center', background: '#f8fafc', position: 'relative' }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              />
              <Upload size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                {file ? file.name : 'Click or drag photo / document to upload'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                PNG, JPG, WEBP, or PDF up to 5MB (Uploaded securely via S3 presigned URLs)
              </div>
            </div>

            {filePreview && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={filePreview} alt="Preview" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                <span style={{ fontSize: '0.85rem', color: '#475569' }}>Attachment preview ready for Amazon S3 upload</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setTab('dashboard')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting to AWS...' : 'Submit Complaint'}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

