// frontend/src/components/questions/QuestionList.jsx
import React, { useEffect, useState } from "react";
import { listQuestions, deleteQuestion } from "../../services/apiService";
import { Link } from "react-router-dom";

export default function QuestionList() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await listQuestions();
      setQuestions(data.questions || []);
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this question?")) return;
    try {
      await deleteQuestion(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Survey Questions</h2>
        <Link to="/dashboard/questions/new" className="btn-primary">
          + New Question
        </Link>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Question</th>
            <th className="p-2">Options</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>

        <tbody>
          {questions.map((q) => (
            <tr key={q.id} className="border-t">
              <td className="p-2">{q.text}</td>
              <td className="p-2">{q.options.join(", ")}</td>
              <td className="p-2">
                <Link
                  className="text-blue-600 mr-3"
                  to={`/dashboard/questions/${q.id}/edit`}
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="text-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}

          {questions.length === 0 && (
            <tr>
              <td colSpan="3" className="p-4 text-center text-gray-500">
                No questions yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
