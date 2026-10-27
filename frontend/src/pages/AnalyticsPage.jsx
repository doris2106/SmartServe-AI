import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.getAnalytics();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
        Loading campus operational analytics from AWS RDS...
      </div>
    );
  }

  // 1. Category Chart Data
  const categoryLabels = (data.categoryDistribution || []).map(c => c.category);
  const categoryValues = (data.categoryDistribution || []).map(c => c.count);
  const categoryColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'
  ];

  const categoryChartData = {
    labels: categoryLabels,
    datasets: [
      {
        data: categoryValues,
        backgroundColor: categoryColors,
        borderWidth: 1
      }
    ]
  };

  // 2. Building Hotspot Chart Data
  const buildingLabels = (data.buildingDistribution || []).map(b => b.building);
  const buildingTotal = (data.buildingDistribution || []).map(b => b.count);
  const buildingCritical = (data.buildingDistribution || []).map(b => b.high_priority_count);

  const buildingChartData = {
    labels: buildingLabels,
    datasets: [
      {
        label: 'Total Complaints',
        data: buildingTotal,
        backgroundColor: '#93c5fd'
      },
      {
        label: 'High/Critical Urgency',
        data: buildingCritical,
        backgroundColor: '#ef4444'
      }
    ]
  };

  // 3. Status Breakdown
  const statusLabels = (data.statusDistribution || []).map(s => s.status);
  const statusValues = (data.statusDistribution || []).map(s => s.count);
  const statusChartData = {
    labels: statusLabels,
    datasets: [
      {
        label: 'Tickets',
        data: statusValues,
        backgroundColor: ['#0284c7', '#d97706', '#7c3aed', '#16a34a', '#dc2626']
      }
    ]
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
            Campus Resource & Service Analytics
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Real-time aggregate facility metrics powered by Amazon RDS & CloudWatch
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchAnalytics}>
          <RefreshCw size={16} /> Refresh Metrics
        </button>
      </div>

      {/* Top Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Category Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>
            Issue Distribution by Category
          </h3>
          <div style={{ maxHeight: '300px', display: 'flex', justifyContent: 'center' }}>
            <Doughnut
              data={categoryChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                }
              }}
            />
          </div>
        </div>

        {/* Building Hotspots */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>
            Campus Building Hotspots (Safety Risk Analysis)
          </h3>
          <div style={{ maxHeight: '300px' }}>
            <Bar
              data={buildingChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { boxWidth: 12 } }
                },
                scales: {
                  x: { stacked: false, ticks: { font: { size: 10 } } },
                  y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Department Performance Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>
          Department Operational Performance
        </h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Maintenance Department</th>
                <th>Total Assigned Tickets</th>
                <th>Resolved Tickets</th>
                <th>Pending / In Progress</th>
                <th>Resolution Rate</th>
              </tr>
            </thead>
            <tbody>
              {(data.departmentPerformance || []).map((dept, idx) => {
                const total = parseInt(dept.total_tickets) || 0;
                const resolved = parseInt(dept.resolved_tickets) || 0;
                const pending = parseInt(dept.pending_tickets) || 0;
                const rate = total > 0 ? Math.round((resolved / total) * 100) : 100;
                return (
                  <tr key={idx}>
                    <td><strong>{dept.department}</strong></td>
                    <td>{total}</td>
                    <td><span style={{ color: '#16a34a', fontWeight: 600 }}>{resolved}</span></td>
                    <td><span style={{ color: '#d97706', fontWeight: 600 }}>{pending}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '100px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${rate}%`, height: '100%', background: rate >= 70 ? '#16a34a' : rate >= 40 ? '#f59e0b' : '#ef4444' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

