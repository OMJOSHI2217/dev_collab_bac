import { Router } from 'express';
import { login, register, updateProfile, uploadAvatar } from '../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.put('/profile/:id', updateProfile);
router.put('/profile/:id/avatar', uploadAvatar);

export default router;
