// ============================================
// FILE: frontend/src/pages/dashboard/analytics/AnalyticsOverview.jsx
// Main analytics overview page
// ============================================
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export default function AnalyticsOverview() {
  const [surveys, setSurveys] = useState([]);
  const [stats, setStats] = useState({
    totalSurveys: 0,
    totalResponses: 0,
    avgCompletionRate: 0,
    activeThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [surveysRes] = await Promise.all([
        api.getSurveys({ status: 'published' }),
      ]);

      const surveysData = surveysRes.data.surveys || [];
      setSurveys(surveysData);

      // Calculate aggregate stats
      const totalResponses = surveysData.reduce((sum, s) => sum + (s.response_count || 0), 0);
      const avgRate = surveysData.length > 0
        ? surveysData.reduce((sum, s) => sum + parseFloat(s.completion_rate || 0), 0) / surveysData.length
        : 0;

      setStats({
        totalSurveys: surveysData.length,
        totalResponses,
        avgCompletionRate: avgRate.toFixed(1),
        activeThisWeek: surveysData.filter(s => {
          const created = new Date(s.created_at);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return created > weekAgo;
        }).length,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Loading analytics..." />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Overview</h1>
        <p className="text-gray-600 mt-2">Track performance across all your surveys</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Surveys"
          value={stats.totalSurveys}
          icon="📋"
          color="blue"
        />
        <MetricCard
          title="Total Responses"
          value={stats.totalResponses}
          icon="💬"
          color="green"
        />
        <MetricCard
          title="Avg Completion Rate"
          value={`${stats.avgCompletionRate}%`}
          icon="✅"
          color="purple"
        />
        <MetricCard
          title="Active This Week"
          value={stats.activeThisWeek}
          icon="🔥"
          color="orange"
        />
      </div>

      {/* Top Surveys */}
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performing Surveys</h2>
        
        {surveys.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-600 mb-4">No published surveys yet</p>
            <Link
              to="/surveys/new"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Create Your First Survey
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {surveys.slice(0, 5).map((survey) => (
              <Link
                key={survey.id}
                to={`/analytics/surveys/${survey.id}`}
                className="block p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{survey.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span>👁️ {survey.response_count || 0} responses</span>
                      <span>•</span>
                      <span>✅ {survey.completion_rate || 0}% completion</span>
                    </div>
                  </div>
                  <div className="text-blue-600">→</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {surveys.slice(0, 5).map((survey) => (
            <div key={survey.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                {survey.title[0]}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{survey.title}</div>
                <div className="text-sm text-gray-500">
                  Published {new Date(survey.published_at).toLocaleDateString()}
                </div>
              </div>
              <Link
                to={`/analytics/surveys/${survey.id}`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View Analytics →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="text-3xl">{icon}</div>
        <div className={`w-3 h-3 rounded-full ${colorClasses[color]}`}></div>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
}
