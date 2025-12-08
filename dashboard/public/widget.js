// ============================================
// FILE: public/widget.js
// Standalone survey embed widget (no React dependency)
// ============================================
(function() {
  'use strict';

  const API_BASE = document.currentScript.getAttribute('data-api-url') || 'http://localhost:5000/api';
  const SURVEY_KEY = document.currentScript.getAttribute('data-survey-key');
  
  if (!SURVEY_KEY) {
    console.error('[MicroSurvey] Missing data-survey-key attribute');
    return;
  }

  // Widget state
  let surveyData = null;
  let currentQuestionIndex = 0;
  let answers = {};
  let containerId = `microsurvey-${SURVEY_KEY}`;

  // Callbacks
  const callbacks = {
    onOpen: window.microSurveyOnOpen || function() {},
    onSubmit: window.microSurveyOnSubmit || function() {},
    onComplete: window.microSurveyOnComplete || function() {},
  };

  // Fetch survey data
  async function loadSurvey() {
    try {
      const response = await fetch(`${API_BASE}/embed/${SURVEY_KEY}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to load survey');
      }
      
      surveyData = data.data;
      render();
      callbacks.onOpen(surveyData);
    } catch (error) {
      console.error('[MicroSurvey] Load error:', error);
      renderError('Failed to load survey. Please try again later.');
    }
  }

  // Submit survey response
  async function submitSurvey() {
    try {
      const response = await fetch(`${API_BASE}/embed/${SURVEY_KEY}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.keys(answers).map(questionId => ({
            questionId,
            answer: answers[questionId],
          })),
          metadata: {
            sessionId: getSessionId(),
            completedAt: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to submit response');
      }

      callbacks.onSubmit(answers);
      renderThankYou();
      callbacks.onComplete(answers);
    } catch (error) {
      console.error('[MicroSurvey] Submit error:', error);
      renderError('Failed to submit response. Please try again.');
    }
  }

  // Get or create session ID
  function getSessionId() {
    let sessionId = sessionStorage.getItem('microsurvey_session');
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('microsurvey_session', sessionId);
    }
    return sessionId;
  }

  // Render functions
  function render() {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[MicroSurvey] Container #${containerId} not found`);
      return;
    }

    if (!surveyData || !surveyData.questions || surveyData.questions.length === 0) {
      container.innerHTML = '<div class="ms-error">No questions available</div>';
      return;
    }

    const question = surveyData.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === surveyData.questions.length - 1;
    const progress = ((currentQuestionIndex + 1) / surveyData.questions.length) * 100;

    container.innerHTML = `
      <div class="ms-widget">
        <div class="ms-header">
          <h3 class="ms-title">${escapeHtml(surveyData.title)}</h3>
          ${surveyData.config?.showProgressBar !== false ? `
            <div class="ms-progress">
              <div class="ms-progress-bar" style="width: ${progress}%"></div>
            </div>
          ` : ''}
        </div>
        
        <div class="ms-body">
          <div class="ms-question">
            <h4 class="ms-question-text">
              ${escapeHtml(question.text)}
              ${question.required ? '<span class="ms-required">*</span>' : ''}
            </h4>
            
            <div class="ms-answer">
              ${renderQuestion(question)}
            </div>
          </div>
        </div>
        
        <div class="ms-footer">
          ${currentQuestionIndex > 0 && surveyData.config?.allowBack !== false ? `
            <button class="ms-btn ms-btn-secondary" onclick="window.microSurveyPrev()">
              ← Previous
            </button>
          ` : ''}
          
          <button class="ms-btn ms-btn-primary" onclick="window.microSurveyNext()">
            ${isLastQuestion ? 'Submit' : 'Next →'}
          </button>
        </div>
      </div>
    `;

    injectStyles();
  }

  function renderQuestion(question) {
    switch (question.type) {
      case 'multiple_choice':
        return question.options.map((opt, idx) => {
          const option = typeof opt === 'string' ? { text: opt, imageUrl: '' } : opt;
          const checked = answers[question.id] === option.text ? 'checked' : '';
          return `
            <label class="ms-option ${option.imageUrl ? 'ms-option-with-image' : ''}">
              <input type="radio" name="q_${question.id}" value="${escapeHtml(option.text)}" ${checked} 
                onchange="window.microSurveyAnswer('${question.id}', this.value)">
              ${option.imageUrl ? `<img src="${escapeHtml(option.imageUrl)}" alt="" class="ms-option-image">` : ''}
              <span>${escapeHtml(option.text)}</span>
            </label>
          `;
        }).join('');

      case 'rating':
        const min = question.options?.[0]?.min || 1;
        const max = question.options?.[0]?.max || 5;
        const label = question.options?.[0]?.label || 'stars';
        const icons = {
          stars: '⭐',
          hearts: '❤️',
          thumbs: '👍',
        };
        const icon = icons[label] || '⭐';
        
        return Array.from({ length: max - min + 1 }, (_, i) => {
          const value = min + i;
          const selected = answers[question.id] === value ? 'ms-rating-selected' : '';
          return `
            <button class="ms-rating-btn ${selected}" onclick="window.microSurveyAnswer('${question.id}', ${value})">
              ${label === 'numbers' ? value : icon}
            </button>
          `;
        }).join('');

      case 'text':
        return `
          <textarea class="ms-textarea" rows="4" 
            placeholder="Type your answer here..."
            onchange="window.microSurveyAnswer('${question.id}', this.value)">${answers[question.id] || ''}</textarea>
        `;

      case 'yes_no':
        return `
          <div class="ms-yesno">
            <button class="ms-yesno-btn ${answers[question.id] === 'yes' ? 'ms-selected' : ''}" 
              onclick="window.microSurveyAnswer('${question.id}', 'yes')">
              Yes
            </button>
            <button class="ms-yesno-btn ${answers[question.id] === 'no' ? 'ms-selected' : ''}" 
              onclick="window.microSurveyAnswer('${question.id}', 'no')">
              No
            </button>
          </div>
        `;

      default:
        return '<p class="ms-error">Unknown question type</p>';
    }
  }

  function renderThankYou() {
    const container = document.getElementById(containerId);
    container.innerHTML = `
      <div class="ms-widget ms-thank-you">
        <div class="ms-thank-you-icon">✓</div>
        <h3>Thank you!</h3>
        <p>Your response has been recorded.</p>
      </div>
    `;
  }

  function renderError(message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
      <div class="ms-widget">
        <div class="ms-error">⚠️ ${escapeHtml(message)}</div>
      </div>
    `;
  }

  function injectStyles() {
    if (document.getElementById('microsurvey-styles')) return;

    const style = document.createElement('style');
    style.id = 'microsurvey-styles';
    style.textContent = `
      .ms-widget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 24px; }
      .ms-header { margin-bottom: 24px; }
      .ms-title { margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
      .ms-progress { height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; }
      .ms-progress-bar { height: 100%; background: #3b82f6; transition: width 0.3s; }
      .ms-question-text { font-size: 18px; font-weight: 500; margin: 0 0 16px 0; color: #374151; }
      .ms-required { color: #ef4444; }
      .ms-option { display: flex; align-items: center; padding: 12px; margin: 8px 0; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
      .ms-option:hover { border-color: #3b82f6; background: #eff6ff; }
      .ms-option input { margin-right: 12px; }
      .ms-option-image { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; margin-right: 12px; }
      .ms-textarea { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-family: inherit; font-size: 14px; resize: vertical; }
      .ms-rating-btn { padding: 12px 16px; margin: 4px; border: 2px solid #e5e7eb; background: #fff; border-radius: 8px; cursor: pointer; font-size: 20px; transition: all 0.2s; }
      .ms-rating-btn:hover { border-color: #3b82f6; transform: scale(1.1); }
      .ms-rating-selected { border-color: #3b82f6; background: #eff6ff; }
      .ms-yesno { display: flex; gap: 12px; }
      .ms-yesno-btn { flex: 1; padding: 16px; border: 2px solid #e5e7eb; background: #fff; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
      .ms-yesno-btn:hover { border-color: #3b82f6; }
      .ms-selected { border-color: #3b82f6; background: #eff6ff; color: #3b82f6; }
      .ms-footer { display: flex; justify-content: space-between; margin-top: 24px; gap: 12px; }
      .ms-btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
      .ms-btn-primary { background: #3b82f6; color: #fff; }
      .ms-btn-primary:hover { background: #2563eb; }
      .ms-btn-secondary { background: #f3f4f6; color: #374151; }
      .ms-btn-secondary:hover { background: #e5e7eb; }
      .ms-thank-you { text-align: center; padding: 40px 24px; }
      .ms-thank-you-icon { font-size: 64px; color: #10b981; margin-bottom: 16px; }
      .ms-error { color: #ef4444; padding: 16px; background: #fef2f2; border-radius: 8px; text-align: center; }
    `;
    document.head.appendChild(style);
  }

  // Utility functions
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Global functions
  window.microSurveyAnswer = function(questionId, value) {
    answers[questionId] = value;
  };

  window.microSurveyNext = function() {
    const question = surveyData.questions[currentQuestionIndex];
    
    if (question.required && !answers[question.id]) {
      alert('Please answer this question before continuing.');
      return;
    }

    if (currentQuestionIndex === surveyData.questions.length - 1) {
      submitSurvey();
    } else {
      currentQuestionIndex++;
      render();
    }
  };

  window.microSurveyPrev = function() {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      render();
    }
  };

  // Initialize
  loadSurvey();
})();
