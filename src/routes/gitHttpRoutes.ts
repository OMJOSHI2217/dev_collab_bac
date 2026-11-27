import { Router } from 'express';
import { handleInfoRefs, handleRpc } from '../controllers/gitHttpController.js';

const router = Router();

// Git Smart HTTP protocol endpoints
router.get('/:owner/:repo/info/refs', handleInfoRefs);
router.post('/:owner/:repo/:service', handleRpc);

export default router;
