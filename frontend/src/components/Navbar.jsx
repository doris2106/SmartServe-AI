import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User, LogOut, LayoutDashboard, PlusCircle, BarChart3, Wrench } from 'lucide-react';

export default function Navbar({ currentTab, setTab }) {
  const { user, logout, isAdmin, isStaff } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div className="brand" style={{ cursor: 'pointer' }} onClick={() => setTab('dashboard')}>
            <div className="brand-icon">
              <Shield size={20} />
            </div>
            <div>
              <span style={{ color: '#1e293b' }}>SmartServe</span>
              <span style={{ color: '#2563eb', marginLeft: '4px' }}>AI</span>
            </div>
          </div>

          {user && (
            <nav style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn ${currentTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                onClick={() => setTab('dashboard')}
              >
                <LayoutDashboard size={16} />
                {isAdmin ? 'Admin Portal' : isStaff ? 'Staff Portal' : 'My Complaints'}
              </button>

              {!isAdmin && (
                <button
                  className={`btn ${currentTab === 'new-complaint' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  onClick={() => setTab('new-complaint')}
                >
                  <PlusCircle size={16} />
                  New Complaint
                </button>
              )}

              {(isAdmin || isStaff) && (
                <button
                  className={`btn ${currentTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  onClick={() => setTab('analytics')}
                >
                  <BarChart3 size={16} />
                  Campus Analytics
                </button>
              )}
            </nav>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{user.name}</div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{user.student_staff_id}</span>
                  <span className={`badge ${isAdmin ? 'badge-resolved' : isStaff ? 'badge-assigned' : 'badge-submitted'}`} style={{ fontSize: '0.7rem' }}>
                    {user.role}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', color: '#ef4444' }}
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setTab('login')}>Sign In</button>
              <button className="btn btn-primary" onClick={() => setTab('register')}>Register</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

