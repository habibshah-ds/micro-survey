// frontend/src/components/questions/QuestionEditor.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listQuestions, createQuestion } from "../../services/apiService";
import QuestionForm from "./QuestionForm";

export default function QuestionEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);

  async function loadExisting() {
    if (!id) return;
    try {
      const data = await listQuestions();
      const q = data.questions.find((x) => x.id.toString() === id);
      if (q) setInitialData(q);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSave(formData) {
    try {
      await createQuestion(formData);
      navigate("/dashboard/questions/list");
    } catch (err) {
      alert(err.message);
    }
  }

  useEffect(() => {
    loadExisting();
  }, [id]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">
        {id ? "Edit Question" : "Create Question"}
      </h2>

      <QuestionForm initialData={initialData} onSubmit={handleSave} />
    </div>
  );
}
