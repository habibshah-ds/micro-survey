import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function QuestionBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [formData, setFormData] = useState({
    organizationId: "",
    questionText: "",
    questionType: "multiple_choice",
    options: [
      { text: "", imageUrl: "" },
      { text: "", imageUrl: "" }
    ],
    ratingMin: 1,
    ratingMax: 5,
    ratingLabel: "stars",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    loadOrganizations();
    if (id) loadQuestion();
  }, [id]);

  async function loadOrganizations() {
    try {
      const response = await api.getOrganizations(1, 100);
      setOrganizations(response.data.organizations || []);
    } catch (err) {
      console.error("Failed to load organizations:", err);
    }
  }

  async function loadQuestion() {
    try {
      const response = await api.getQuestion(id);
      const question = response.data.question;
      
      let options = question.options || [{ text: "", imageUrl: "" }, { text: "", imageUrl: "" }];
      
      // Convert old string format to new object format
      if (options.length > 0 && typeof options[0] === 'string') {
        options = options.map(opt => ({ text: opt, imageUrl: "" }));
      }

      setFormData({
        organizationId: question.organization_id,
        questionText: question.question_text,
        questionType: question.question_type,
        options: options,
        ratingMin: question.rating_min || 1,
        ratingMax: question.rating_max || 5,
        ratingLabel: question.rating_label || "stars",
        isActive: question.is_active,
      });
    } catch (err) {
      setError("Failed to load question");
    }
  }

  function updateOption(index, field, value) {
    const newOptions = [...formData.options];
    newOptions[index][field] = value;
    setFormData({ ...formData, options: newOptions });
  }

  function addOption() {
    setFormData({
      ...formData,
      options: [...formData.options, { text: "", imageUrl: "" }],
    });
  }

  function removeOption(index) {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      setFormData({ ...formData, options: newOptions });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const submitData = { ...formData };
      
      // For API compatibility, convert options format if needed
      if (formData.questionType === 'text') {
        submitData.options = [];
      } else if (formData.questionType === 'rating') {
        submitData.options = [{
          min: formData.ratingMin,
          max: formData.ratingMax,
          label: formData.ratingLabel
        }];
      }

      if (id) {
        await api.updateQuestion(id, submitData);
      } else {
        await api.createQuestion(submitData);
      }
      navigate("/questions");
    } catch (err) {
      setError(err.message || "Failed to save question");
    } finally {
      setLoading(false);
    }
  }

  const questionTypeIcons = {
    multiple_choice: "📋",
    text: "✍️",
    rating: "⭐",
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => navigate("/questions")}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
        >
          ← Back to Questions
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {id ? "Edit Question" : "Create New Question"}
        </h1>
        <p className="text-gray-600 mt-2">
          {id ? "Update your survey question" : "Build an engaging survey question for your audience"}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${currentStep >= 1 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              1
            </div>
            <span className="ml-2 font-medium hidden sm:inline">Basic Info</span>
          </div>
          <div className="w-12 h-1 bg-gray-300"></div>
          <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${currentStep >= 2 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 font-medium hidden sm:inline">Question Details</span>
          </div>
          <div className="w-12 h-1 bg-gray-300"></div>
          <div className={`flex items-center ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${currentStep >= 3 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              3
            </div>
            <span className="ml-2 font-medium hidden sm:inline">Review</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
          <div className="flex items-center">
            <span className="text-red-700 font-medium">{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Organization *
              </label>
              <select
                value={formData.organizationId}
                onChange={(e) =>
                  setFormData({ ...formData, organizationId: e.target.value })
                }
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none transition-colors"
                required
              >
                <option value="">Select an organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Choose which organization this question belongs to
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Question Type *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries({
                  multiple_choice: "Multiple Choice",
                  text: "Text Response",
                  rating: "Rating Scale",
                }).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, questionType: value })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.questionType === value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-3xl mb-2">{questionTypeIcons[value]}</div>
                    <div className="font-semibold">{label}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {value === "multiple_choice" && "Users select from options"}
                      {value === "text" && "Users type their answer"}
                      {value === "rating" && "Users rate on a scale"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                disabled={!formData.organizationId}
              >
                Next: Question Details →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Question Details */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Question *
              </label>
              <textarea
                value={formData.questionText}
                onChange={(e) =>
                  setFormData({ ...formData, questionText: e.target.value })
                }
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none transition-colors"
                rows={3}
                placeholder="e.g., What is your favorite feature?"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Make it clear and easy to understand
              </p>
            </div>

            {/* Multiple Choice Options */}
            {formData.questionType === "multiple_choice" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Answer Options *
                </label>
                <div className="space-y-3">
                  {formData.options.map((option, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold flex-shrink-0 mt-1">
                          {String.fromCharCode(65 + index)}
                        </div>
                        <div className="flex-1 space-y-3">
                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) => updateOption(index, "text", e.target.value)}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
                            placeholder={`Option ${index + 1}`}
                            required
                          />
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Image URL (optional)
                            </label>
                            <input
                              type="url"
                              value={option.imageUrl}
                              onChange={(e) => updateOption(index, "imageUrl", e.target.value)}
                              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none text-sm"
                              placeholder="https://example.com/image.jpg"
                            />
                          </div>
                          {option.imageUrl && (
                            <div className="mt-2">
                              <img
                                src={option.imageUrl}
                                alt={`Option ${index + 1}`}
                                className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </div>
                        {formData.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="text-red-600 hover:text-red-800 p-2"
                            title="Remove option"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addOption}
                  className="mt-3 text-blue-600 hover:text-blue-800 font-medium flex items-center"
                >
                  + Add Another Option
                </button>
              </div>
            )}

            {/* Rating Scale Options */}
            {formData.questionType === "rating" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Minimum Rating *
                    </label>
                    <input
                      type="number"
                      value={formData.ratingMin}
                      onChange={(e) =>
                        setFormData({ ...formData, ratingMin: parseInt(e.target.value) })
                      }
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
                      min="0"
                      max="10"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Maximum Rating *
                    </label>
                    <input
                      type="number"
                      value={formData.ratingMax}
                      onChange={(e) =>
                        setFormData({ ...formData, ratingMax: parseInt(e.target.value) })
                      }
                      className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
                      min="1"
                      max="10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Rating Style
                  </label>
                  <select
                    value={formData.ratingLabel}
                    onChange={(e) =>
                      setFormData({ ...formData, ratingLabel: e.target.value })
                    }
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="stars">⭐ Stars</option>
                    <option value="hearts">❤️ Hearts</option>
                    <option value="thumbs">👍 Thumbs</option>
                    <option value="numbers">🔢 Numbers</option>
                  </select>
                </div>

                {/* Rating Preview */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Preview:</p>
                  <div className="flex gap-2">
                    {Array.from({ length: formData.ratingMax - formData.ratingMin + 1 }, (_, i) => (
                      <div key={i} className="text-2xl">
                        {formData.ratingLabel === 'stars' && '⭐'}
                        {formData.ratingLabel === 'hearts' && '❤️'}
                        {formData.ratingLabel === 'thumbs' && '👍'}
                        {formData.ratingLabel === 'numbers' && (
                          <span className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold">
                            {formData.ratingMin + i}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Text Response Info */}
            {formData.questionType === "text" && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  📝 Users will be able to type their own answer to this question.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                disabled={!formData.questionText}
              >
                Next: Review →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Settings */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
              <h3 className="font-semibold text-lg mb-4">Question Preview</h3>
              <div className="bg-white rounded-lg p-4 border-2 border-gray-300">
                <p className="font-medium text-gray-900 mb-3">{formData.questionText}</p>
                
                {formData.questionType === "multiple_choice" && (
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg">
                        <input type="radio" name="preview" disabled />
                        {option.imageUrl && (
                          <img src={option.imageUrl} alt="" className="w-16 h-16 object-cover rounded" />
                        )}
                        <span>{option.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {formData.questionType === "rating" && (
                  <div className="flex gap-2">
                    {Array.from({ length: formData.ratingMax - formData.ratingMin + 1 }, (_, i) => (
                      <div key={i} className="text-3xl cursor-pointer hover:scale-110 transition-transform">
                        {formData.ratingLabel === 'stars' && '⭐'}
                        {formData.ratingLabel === 'hearts' && '❤️'}
                        {formData.ratingLabel === 'thumbs' && '👍'}
                        {formData.ratingLabel === 'numbers' && (
                          <span className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold">
                            {formData.ratingMin + i}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {formData.questionType === "text" && (
                  <textarea
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-2"
                    rows={3}
                    placeholder="User will type their answer here..."
                    disabled
                  />
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-3">
                  <span className="font-semibold text-gray-900">Active</span>
                  <span className="block text-sm text-gray-500">
                    This question will be shown to users
                  </span>
                </span>
              </label>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    ✓ {id ? "Update Question" : "Create Question"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
