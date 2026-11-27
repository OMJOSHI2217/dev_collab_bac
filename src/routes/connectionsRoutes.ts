import { Router } from 'express';
import { getRequests, sendRequest, updateRequestStatus } from '../controllers/connectionsController.js';

const router = Router();

router.get('/requests', getRequests);
router.post('/requests', sendRequest);
router.patch('/requests/:id', updateRequestStatus);

export default router;
