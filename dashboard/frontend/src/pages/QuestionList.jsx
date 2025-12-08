import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function QuestionListPage() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    try {
      const response = await api.getQuestions();
      setQuestions(response.data.questions || []);
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this question? This action cannot be undone.")) return;

    try {
      await api.deleteQuestion(id);
      loadQuestions();
    } catch (err) {
      alert(err.message || "Failed to delete question");
    }
  }

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.question_text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && q.is_active) ||
      (filter === "inactive" && !q.is_active) ||
      filter === q.question_type;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: questions.length,
    active: questions.filter((q) => q.is_active).length,
    multipleChoice: questions.filter((q) => q.question_type === "multiple_choice").length,
    text: questions.filter((q) => q.question_type === "text").length,
    rating: questions.filter((q) => q.question_type === "rating").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Survey Questions</h1>
            <p className="text-gray-600 mt-2">Manage all your survey questions in one place</p>
          </div>
          <Link
            to="/questions/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <span className="text-xl">+</span> Create Question
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600">Total Questions</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600">Active</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="text-sm text-gray-600">📋 Multiple Choice</div>
          <div className="text-2xl font-bold text-purple-600">{stats.multipleChoice}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-sm text-gray-600">✍️ Text</div>
          <div className="text-2xl font-bold text-orange-600">{stats.text}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600">⭐ Rating</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.rating}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "multiple_choice", label: "Multiple Choice" },
              { value: "text", label: "Text" },
              { value: "rating", label: "Rating" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm || filter !== "all" ? "No questions found" : "No questions yet"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || filter !== "all"
              ? "Try adjusting your search or filters"
              : "Create your first question to get started"}
          </p>
          {!searchTerm && filter === "all" && (
            <Link
              to="/questions/new"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Your First Question
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredQuestions.map((q) => (
            <div
              key={q.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-gray-100 hover:border-blue-200"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">
                        {q.question_type === "multiple_choice" && "📋"}
                        {q.question_type === "text" && "✍️"}
                        {q.question_type === "rating" && "⭐"}
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {q.question_text}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {q.organization_name}
                        </p>
                      </div>
                    </div>

                    {/* Question Details */}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
                        {q.question_type === "multiple_choice" && "Multiple Choice"}
                        {q.question_type === "text" && "Text Response"}
                        {q.question_type === "rating" && "Rating Scale"}
                      </span>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full font-medium ${
                          q.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {q.is_active ? "✓ Active" : "○ Inactive"}
                      </span>
                      {q.question_type === "multiple_choice" && (
                        <span className="text-gray-600">
                          {q.options?.length || 0} options
                        </span>
                      )}
                    </div>

                    {/* Options Preview for Multiple Choice */}
                    {q.question_type === "multiple_choice" && q.options && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {q.options.slice(0, 3).map((opt, idx) => {
                          const option = typeof opt === 'string' ? { text: opt, imageUrl: '' } : opt;
                          return (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                            >
                              {option.imageUrl && (
                                <img src={option.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
                              )}
                              <span className="text-gray-700">{option.text}</span>
                            </div>
                          );
                        })}
                        {q.options.length > 3 && (
                          <span className="text-gray-500 text-sm">
                            +{q.options.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      to={`/questions/${q.id}/edit`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit question"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete question"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results count */}
      {filteredQuestions.length > 0 && (
        <div className="mt-6 text-center text-gray-600">
          Showing {filteredQuestions.length} of {questions.length} questions
        </div>
      )}
    </div>
  );
}
