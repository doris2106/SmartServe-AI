const BASE_URL = '/api';

function getHeaders(isFormData = false) {
  const token = localStorage.getItem('smartserve_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const isFormData = options.body instanceof FormData;
  const config = {
    ...options,
    headers: {
      ...getHeaders(isFormData),
      ...options.headers
    }
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: credentials => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: userData => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  getProfile: () => request('/auth/profile'),

  // Metadata
  getMetadata: () => request('/complaints/metadata'),

  // Complaints
  analyzeDraft: draft => request('/complaints/analyze-draft', { method: 'POST', body: JSON.stringify(draft) }),
  createComplaint: formData => request('/complaints', { method: 'POST', body: formData }),
  getMyComplaints: () => request('/complaints/my'),
  getComplaintById: id => request(`/complaints/${id}`),

  // Admin
  getAllComplaints: params => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/complaints?${query}`);
  },
  assignComplaint: (id, payload) => request(`/admin/complaints/${id}/assign`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateStatus: (id, payload) => request(`/admin/complaints/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getStaffList: () => request('/admin/staff'),
  getExportUrl: () => `${BASE_URL}/admin/export`,
  downloadExport: async () => {
    const token = localStorage.getItem('smartserve_token');
    const response = await fetch(`${BASE_URL}/admin/export`, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Export failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartserve-complaints-report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Analytics
  getAnalytics: () => request('/analytics')
};

