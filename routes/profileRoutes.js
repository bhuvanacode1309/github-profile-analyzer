const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// POST /api/profiles - Analyze and save a profile
router.post('/', profileController.analyzeProfile);

// GET /api/profiles - Get all analyzed profiles
router.get('/', profileController.getAllProfiles);

// GET /api/profiles/:username - Get a single analyzed profile
router.get('/:username', profileController.getSingleProfile);

// GET /api/profiles/:username/resume - Get HTML resume card
router.get('/:username/resume', profileController.getProfileResume);

module.exports = router;
