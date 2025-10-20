/**
 * Admin Routes for SwasthyaLink
 * Handles admin-specific operations
 */

const express = require('express');
const router = express.Router();
const DoctorModel = require('../src/models/doctorModel');
const { requireAdmin } = require('../src/middleware/auth');

// Get all doctors (Admin only)
router.get('/doctors', requireAdmin, async (req, res) => {
  try {
    const result = await DoctorModel.getAllDoctors();
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch doctors'
    });
  }
});

// Get doctor statistics (Admin only)
router.get('/doctors/stats', requireAdmin, async (req, res) => {
  try {
    const result = await DoctorModel.getDoctorStatistics();
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch statistics'
    });
  }
});

// Get all patients (Admin only)
router.get('/patients', requireAdmin, async (req, res) => {
  try {
    const result = await DoctorModel.getAllPatients();
    res.json(result);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch patients'
    });
  }
});

// Update doctor account (Admin only)
router.put('/doctors/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await DoctorModel.updateDoctorProfile(id, updates);
    res.json(result);
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update doctor'
    });
  }
});

// Update doctor status (Admin only)
router.post('/doctors/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' or 'suspended'

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "active" or "suspended"'
      });
    }

    const result = await DoctorModel.updateDoctorStatus(id, status, req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('Error updating doctor status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update doctor status'
    });
  }
});

// Disable doctor account (Admin only)
router.post('/doctors/:id/disable', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DoctorModel.disableDoctor(id, req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('Error disabling doctor:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to disable doctor'
    });
  }
});

/**
 * Admin login endpoint
 */
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name and password are required'
      });
    }

    // Check preset admin credentials
    if (name === 'admin' && password === 'admin123') {
      return res.json({
        success: true,
        admin: {
          id: 'preset-admin',
          name: 'admin',
          email: 'admin@gmail.com',
          role: 'admin'
        },
        token: 'preset-admin-token'
      });
    }

    // For future implementation with database
    // const adminRef = doc(db, 'admins', name);
    // const adminSnap = await getDoc(adminRef);
    // if (!adminSnap.exists()) {
    //   return res.status(401).json({
    //     success: false,
    //     error: 'Invalid credentials'
    //   });
    // }

    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

module.exports = router;
