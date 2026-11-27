import { Router } from 'express';
import { getProjects, createProject, completeProject, getProjectHistory } from '../controllers/projectsController.js';

const router = Router();

router.get('/', getProjects);
router.post('/', createProject);
router.post('/:id/complete', completeProject);
router.get('/history/all', getProjectHistory);

export default router;
