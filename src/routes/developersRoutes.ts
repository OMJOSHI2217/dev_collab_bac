import { Router } from 'express';
import { getDevelopers, getDeveloperById } from '../controllers/developersController.js';

const router = Router();

router.get('/', getDevelopers);
router.get('/:id', getDeveloperById);

export default router;
