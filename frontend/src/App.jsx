import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboard from './pages/StudentDashboard';
import NewComplaintPage from './pages/NewComplaintPage';
import AdminDashboard from './pages/AdminDashboard';
import AnalyticsPage from './pages/AnalyticsPage';

function AppContent() {
  const { user, loading, isAdmin, isStaff } = useAuth();
  const [tab, setTab] = useState('dashboard');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Loading SmartServe AI...
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar currentTab={tab} setTab={setTab} />
      <main className="main-content">
        {!user ? (
          tab === 'register' ? (
            <RegisterPage setTab={setTab} />
          ) : (
            <LoginPage setTab={setTab} />
          )
        ) : (
          <>
            {tab === 'dashboard' && (
              isAdmin || isStaff ? (
                <AdminDashboard setTab={setTab} />
              ) : (
                <StudentDashboard setTab={setTab} />
              )
            )}
            {tab === 'new-complaint' && <NewComplaintPage setTab={setTab} />}
            {tab === 'analytics' && <AnalyticsPage setTab={setTab} />}
          </>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #e2e8f0', background: '#fff', padding: '16px 20px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <strong>SmartServe AI</strong> — Intelligent Campus Service & Resource Management System
          </div>
          <div>
            Powered by <strong>Amazon EC2, RDS MySQL, S3, SSM, SQS, SNS & CloudWatch</strong> (eu-north-1)
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

