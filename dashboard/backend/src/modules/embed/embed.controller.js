// backend/src/modules/embed/embed.controller.js
export async function getPublishedSurvey(req, res) {
  const { surveyKey } = req.params;
  
  // Get published survey
  const survey = await db.query(
    `SELECT s.*, ss.snapshot
     FROM surveys s
     JOIN survey_snapshots ss ON s.published_snapshot_id = ss.id
     WHERE s.survey_key = $1 AND s.status = 'published'`,
    [surveyKey]
  );
  
  if (survey.rows.length === 0) {
    return res.status(404).json({ error: 'Survey not found' });
  }
  
  res.json(survey.rows[0].snapshot);
}
