import React from "react";
import { useParams } from "react-router-dom";

export default function AnalyticsPage() {
  const { questionId } = useParams();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-600">
          Analytics for question: {questionId}
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Analytics feature coming soon...
        </p>
      </div>
    </div>
  );
}
