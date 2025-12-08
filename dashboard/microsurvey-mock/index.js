// microsurvey-mock/index.js
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

const surveys = new Map();
const responses = new Map();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/v1/surveys', (req, res) => {
  const survey = {
    id: uuidv4(),
    surveyId: uuidv4(),
    survey_key: `survey_${Date.now()}`,
    surveyKey: `survey_${Date.now()}`,
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  surveys.set(survey.id, survey);
  res.status(201).json(survey);
});

app.get('/v1/surveys/:id', (req, res) => {
  const survey = surveys.get(req.params.id);
  if (!survey) return res.status(404).json({ error: 'Not found' });
  res.json(survey);
});

app.put('/v1/surveys/:id', (req, res) => {
  const survey = surveys.get(req.params.id);
  if (!survey) return res.status(404).json({ error: 'Not found' });
  Object.assign(survey, req.body, { updatedAt: new Date().toISOString() });
  surveys.set(req.params.id, survey);
  res.json(survey);
});

app.post('/v1/surveys/:key/responses', (req, res) => {
  const responseId = uuidv4();
  const response = {
    id: responseId,
    surveyKey: req.params.key,
    ...req.body,
    submittedAt: new Date().toISOString(),
  };
  
  if (!responses.has(req.params.key)) {
    responses.set(req.params.key, []);
  }
  responses.get(req.params.key).push(response);
  
  res.status(201).json(response);
});

app.get('/v1/surveys/:id/results', (req, res) => {
  const survey = surveys.get(req.params.id);
  if (!survey) return res.status(404).json({ error: 'Not found' });
  
  const surveyResponses = responses.get(survey.survey_key) || [];
  
  res.json({
    surveyId: survey.id,
    totalResponses: surveyResponses.length,
    responses: surveyResponses,
    aggregated: {
      byQuestion: {},
    },
  });
});

app.post('/v1/surveys/:id/export', (req, res) => {
  res.json({
    exportId: uuidv4(),
    status: 'pending',
    format: req.body.format || 'csv',
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Mock Micro-Survey running on port ${PORT}`);
});

// microsurvey-mock/package.json
{
  "name": "microsurvey-mock",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "uuid": "^9.0.1"
  }
}

// microsurvey-mock/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
