// frontend/src/components/questions/QuestionForm.jsx
import React, { useState } from "react";

export default function QuestionForm({ initialData, onSubmit }) {
  const [text, setText] = useState(initialData?.text || "");
  const [options, setOptions] = useState(initialData?.options || [""]);

  function updateOption(index, value) {
    const copy = [...options];
    copy[index] = value;
    setOptions(copy);
  }

  function addOption() {
    setOptions([...options, ""]);
  }

  function removeOption(index) {
    setOptions(options.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return alert("Question text required");
    if (options.filter((o) => o.trim()).length < 2)
      return alert("Minimum 2 options required");

    onSubmit({ text, options });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block mb-1">Question Text</label>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your question here..."
        />
      </div>

      <div>
        <label className="block mb-1">Options</label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center mb-2">
            <input
              className="input flex-1"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
            />
            {options.length > 1 && (
              <button
                type="button"
                className="ml-2 text-red-600"
                onClick={() => removeOption(i)}
              >
                X
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addOption}
          className="btn-secondary mt-2"
        >
          + Add Option
        </button>
      </div>

      <button className="btn-primary">Save</button>
    </form>
  );
}
