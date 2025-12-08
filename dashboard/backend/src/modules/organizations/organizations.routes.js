import { Router } from 'express';
import organizationsController from './organizations.controller.js';
import { validate } from '../../middleware/validate.js';
import { authRequired } from '../../middleware/auth.js';
import { createOrganizationSchema, updateOrganizationSchema } from './organizations.validation.js';

const router = Router();

router.use(authRequired);

router.post('/', validate(createOrganizationSchema), organizationsController.create);
router.get('/', organizationsController.getAll);
router.get('/:id', organizationsController.getById);
router.put('/:id', validate(updateOrganizationSchema), organizationsController.update);
router.delete('/:id', organizationsController.delete);

export default router;
