/**
 * Doctor Routes for SwasthyaLink
 * Handles doctor-specific operations
 */

const express = require('express');
const router = express.Router();
const DoctorModel = require('../src/models/doctorModel');
const { requireDoctor } = require('../src/middleware/auth');

// Doctor registration endpoint
router.post('/register', async (req, res) => {
  try {
    console.log('Received registration data:', req.body);
    const { name, email, specialization, license, experience, description, phone } = req.body;

    if (!name || !email || !specialization || !license || !phone) {
      console.log('Missing required fields:', { name, email, specialization, license, phone });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, email, specialization, license, phone'
      });
    }

    const result = await DoctorModel.submitRegistration({
      name,
      email,
      specialization,
      license,
      experience: experience || '',
      description: description || '',
      phone
    });

    res.json(result);
  } catch (error) {
    console.error('Doctor registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit registration'
    });
  }
});

// Doctor login endpoint
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Login ID and password are required'
      });
    }

    const result = await DoctorModel.authenticateDoctor(loginId, password);
    res.json(result);
  } catch (error) {
    console.error('Doctor authentication error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed'
    });
  }
});

// Get doctor profile (requires authentication)
router.get('/profile', requireDoctor, async (req, res) => {
  try {
    const result = await DoctorModel.getDoctorById(req.doctor.id);
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch profile'
    });
  }
});

// Update doctor profile (requires authentication)
router.put('/profile', requireDoctor, async (req, res) => {
  try {
    const updates = req.body;

    // Remove sensitive fields from updates
    delete updates.password;
    delete updates.loginId;
    delete updates.sessionToken;
    delete updates.role;

    const result = await DoctorModel.updateDoctorProfile(req.doctor.id, updates);
    res.json(result);
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update profile'
    });
  }
});

module.exports = router;
