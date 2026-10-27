const { query } = require('../config/db');

async function getAnalytics(req, res) {
  try {
    // 1. Overall counts
    const totalRows = await query('SELECT COUNT(*) as total FROM complaints');
    const statusCounts = await query('SELECT status, COUNT(*) as count FROM complaints GROUP BY status');
    const priorityCounts = await query('SELECT priority, COUNT(*) as count FROM complaints GROUP BY priority');
    
    // 2. Category distribution
    const categoryCounts = await query(
      `SELECT cat.name as category, COUNT(c.id) as count
       FROM categories cat
       LEFT JOIN complaints c ON cat.id = c.category_id
       GROUP BY cat.id, cat.name
       ORDER BY count DESC`
    );

    // 3. Building-wise distribution (identify recurring hotspots)
    const buildingCounts = await query(
      `SELECT building, COUNT(*) as count,
              SUM(CASE WHEN priority IN ('High', 'Critical') THEN 1 ELSE 0 END) as high_priority_count
       FROM complaints
       GROUP BY building
       ORDER BY count DESC`
    );

    // 4. Department performance (assigned vs resolved)
    const deptPerformance = await query(
      `SELECT dept.name as department,
              COUNT(c.id) as total_tickets,
              SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved_tickets,
              SUM(CASE WHEN c.status IN ('Submitted', 'Assigned', 'In Progress') THEN 1 ELSE 0 END) as pending_tickets
       FROM departments dept
       LEFT JOIN complaints c ON dept.id = c.department_id
       GROUP BY dept.id, dept.name`
    );

    // 5. Recent timeline / 7-day trend
    const recentTrend = await query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM complaints
       WHERE created_at >= NOW() - INTERVAL 14 DAY
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    return res.json({
      success: true,
      data: {
        totalComplaints: totalRows[0]?.total || 0,
        statusDistribution: statusCounts,
        priorityDistribution: priorityCounts,
        categoryDistribution: categoryCounts,
        buildingDistribution: buildingCounts,
        departmentPerformance: deptPerformance,
        recentTrend
      }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load analytics.', error: err.message });
  }
}

module.exports = { getAnalytics };

