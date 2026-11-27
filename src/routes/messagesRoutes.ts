import { Router } from 'express';
import { getConversations, getMessages, sendMessage, assignProjectRole } from '../controllers/messagesController.js';

const router = Router();

router.get('/conversations', getConversations);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/messages', sendMessage);
router.post('/assign-role', assignProjectRole);

export default router;
