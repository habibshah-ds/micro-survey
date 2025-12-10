// ============================================
// frontend/src/services/api.js (Merged & Updated)
// ============================================
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

class ApiService {
  constructor() {
    this.baseUrl = API_BASE;
    this.token = localStorage.getItem("accessToken");
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  }

  async request(method, endpoint, data = null) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const config = {
      method,
      headers,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || "Request failed");
      }

      return json;
    } catch (error) {
      throw error;
    }
  }

  // ===================== Auth =====================
  async register(email, password, fullName) {
    const response = await this.request("POST", "/auth/register", {
      email,
      password,
      fullName,
    });
    this.setToken(response.data.accessToken);
    return response;
  }

  async login(email, password) {
    const response = await this.request("POST", "/auth/login", {
      email,
      password,
    });
    this.setToken(response.data.accessToken);
    return response;
  }

  async logout(refreshToken) {
    await this.request("POST", "/auth/logout", { refreshToken });
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request("GET", "/auth/me");
  }

  // ===================== Organizations =====================
  async createOrganization(name, slug) {
    return this.request("POST", "/organizations", { name, slug });
  }

  async getOrganizations(page = 1, limit = 10) {
    return this.request("GET", `/organizations?page=${page}&limit=${limit}`);
  }

  async getOrganization(id) {
    return this.request("GET", `/organizations/${id}`);
  }

  async updateOrganization(id, data) {
    return this.request("PUT", `/organizations/${id}`, data);
  }

  async deleteOrganization(id) {
    return this.request("DELETE", `/organizations/${id}`);
  }

  // ===================== Questions =====================
  async createQuestion(data) {
    return this.request("POST", "/questions", data);
  }

  async getQuestions(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request("GET", `/questions?${params}`);
  }

  async getQuestion(id) {
    return this.request("GET", `/questions/${id}`);
  }

  async updateQuestion(id, data) {
    return this.request("PUT", `/questions/${id}`, data);
  }

  async deleteQuestion(id) {
    return this.request("DELETE", `/questions/${id}`);
  }

  // ===================== Analytics =====================
  async getQuestionAnalytics(questionId, filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(
      "GET",
      `/analytics/questions/${questionId}?${params}`
    );
  }

  async getOrganizationAnalytics(organizationId) {
    return this.request(
      "GET",
      `/analytics/organizations/${organizationId}`
    );
  }

  // ===================== Tenants =====================
  async createTenant(data) {
    return this.request("POST", "/tenants", data);
  }

  async getTenants(page = 1, limit = 10) {
    return this.request("GET", `/tenants?page=${page}&limit=${limit}`);
  }

  // ===================== API Keys =====================
  async createApiKey(tenantId, name) {
    return this.request("POST", `/tenants/${tenantId}/keys`, { name });
  }

  async listApiKeys(tenantId) {
    return this.request("GET", `/tenants/${tenantId}/keys`);
  }

  async revokeApiKey(tenantId, keyId) {
    return this.request("DELETE", `/tenants/${tenantId}/keys/${keyId}`);
  }

  // ===================== Surveys =====================
  async createSurvey(data) {
    return this.request("POST", "/surveys", data);
  }

  async getSurveys(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request("GET", `/surveys?${params}`);
  }

  async publishSurvey(surveyId) {
    return this.request("POST", `/surveys/${surveyId}/publish`);
  }

  async getSurveyResults(surveyId, filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(
      "GET",
      `/surveys/${surveyId}/results?${params}`
    );
  }

  async getEmbedCode(surveyId) {
    return this.request("GET", `/surveys/${surveyId}/embed`);
  }
}

export default new ApiService();
