import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

export default function DashboardPage() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    organizations: 0,
    questions: 0,
    responses: 0,
  });
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [orgs, questions] = await Promise.all([
        api.getOrganizations(1, 100),
        api.getQuestions(),
      ]);

      setStats({
        organizations: orgs.data.total || 0,
        questions: questions.data.total || 0,
        responses: 0,
      });

      setRecentQuestions((questions.data.questions || []).slice(0, 5));
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.fullName || user?.email?.split('@')[0] || 'User'}! 👋
        </h1>
        <p className="text-gray-600 mt-2">
          Here's what's happening with your surveys today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Organizations</p>
              <p className="text-4xl font-bold mt-2">{stats.organizations}</p>
              <p className="text-blue-100 text-sm mt-2">Total active</p>
            </div>
            <div className="text-6xl opacity-20">🏢</div>
          </div>
          <Link
            to="/organizations"
            className="mt-4 inline-block text-sm text-blue-100 hover:text-white underline"
          >
            Manage organizations →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Questions</p>
              <p className="text-4xl font-bold mt-2">{stats.questions}</p>
              <p className="text-green-100 text-sm mt-2">Survey questions</p>
            </div>
            <div className="text-6xl opacity-20">📝</div>
          </div>
          <Link
            to="/questions"
            className="mt-4 inline-block text-sm text-green-100 hover:text-white underline"
          >
            View all questions →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Responses</p>
              <p className="text-4xl font-bold mt-2">{stats.responses}</p>
              <p className="text-purple-100 text-sm mt-2">Total collected</p>
            </div>
            <div className="text-6xl opacity-20">📊</div>
          </div>
          <div className="mt-4 text-sm text-purple-100">
            Coming soon
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link
              to="/questions/new"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border-2 border-blue-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xl">
                  +
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Create Question</div>
                  <div className="text-sm text-gray-600">Build a new survey question</div>
                </div>
              </div>
            </Link>

            <Link
              to="/organizations"
              className="block p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border-2 border-green-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white text-xl">
                  🏢
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Manage Organizations</div>
                  <div className="text-sm text-gray-600">View and edit organizations</div>
                </div>
              </div>
            </Link>

            <Link
              to="/questions"
              className="block p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border-2 border-purple-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xl">
                  📋
                </div>
                <div>
                  <div className="font-semibold text-gray-900">View All Questions</div>
                  <div className="text-sm text-gray-600">Browse your question library</div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Questions */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📝</span>
            Recent Questions
          </h2>
          {recentQuestions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎯</div>
              <p className="text-gray-600 mb-4">No questions yet</p>
              <Link
                to="/questions/new"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Your First Question
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentQuestions.map((q) => (
                <div
                  key={q.id}
                  className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm line-clamp-1">
                        {q.question_text}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {q.question_type === "multiple_choice" && "📋 Multiple Choice"}
                          {q.question_type === "text" && "✍️ Text"}
                          {q.question_type === "rating" && "⭐ Rating"}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            q.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {q.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/questions/${q.id}/edit`}
                      className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
              <Link
                to="/questions"
                className="block text-center text-blue-600 hover:text-blue-800 text-sm font-medium pt-2"
              >
                View all questions →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Getting Started Guide */}
      {stats.questions === 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg p-8 border-2 border-blue-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-3xl">🚀</span>
            Getting Started
          </h2>
          <p className="text-gray-700 mb-6">
            Follow these steps to create your first survey question:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-3">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Create Organization</h3>
              <p className="text-sm text-gray-600">Set up your organization to group questions</p>
              <Link to="/organizations" className="text-blue-600 text-sm mt-2 inline-block">
                Go to Organizations →
              </Link>
            </div>
            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold mb-3">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Build Question</h3>
              <p className="text-sm text-gray-600">Create engaging questions with images</p>
              <Link to="/questions/new" className="text-green-600 text-sm mt-2 inline-block">
                Create Question →
              </Link>
            </div>
            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold mb-3">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">View Analytics</h3>
              <p className="text-sm text-gray-600">Track responses and insights</p>
              <span className="text-purple-600 text-sm mt-2 inline-block">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
