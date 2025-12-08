import { Router } from 'express';
import questionsController from './questions.controller.js';
import { validate } from '../../middleware/validate.js';
import { authRequired } from '../../middleware/auth.js';
import { createQuestionSchema, updateQuestionSchema } from './questions.validation.js';

const router = Router();

router.use(authRequired);

router.post('/', validate(createQuestionSchema), questionsController.create);
router.get('/', questionsController.getAll);
router.get('/:id', questionsController.getById);
router.put('/:id', validate(updateQuestionSchema), questionsController.update);
router.delete('/:id', questionsController.delete);

export default router;
