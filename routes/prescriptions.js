/**
 * Prescription Routes for SwasthyaLink
 * Handles prescription management
 */

const express = require('express');
const router = express.Router();
const PrescriptionModel = require('../src/models/prescriptionModel');
const { requireAuth, requireDoctor, requirePatient } = require('../src/middleware/auth');

// Create prescription (Doctor only)
router.post('/create', requireDoctor, async (req, res) => {
  try {
    const { patientId, medications, diagnosis, instructions, notes, priority, validUntil } = req.body;
    const doctorId = req.user.uid;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID is required'
      });
    }

    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one medication is required'
      });
    }

    const result = await PrescriptionModel.createPrescription({
      doctorId,
      patientId,
      medications,
      diagnosis,
      instructions,
      notes,
      priority,
      validUntil
    });

    res.json(result);
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create prescription'
    });
  }
});

// Send prescription to patient (Doctor only)
router.post('/:prescriptionId/send', requireDoctor, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const doctorId = req.user.uid;

    const result = await PrescriptionModel.sendPrescription(prescriptionId, doctorId);
    res.json(result);
  } catch (error) {
    console.error('Error sending prescription:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send prescription'
    });
  }
});

// Get doctor's prescriptions (Doctor only)
router.get('/doctor', requireDoctor, async (req, res) => {
  try {
    const doctorId = req.user.uid;
    const limit = parseInt(req.query.limit) || 50;

    const result = await PrescriptionModel.getDoctorPrescriptions(doctorId, limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor prescriptions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch prescriptions'
    });
  }
});

// Get patient's prescriptions (Patient only)
router.get('/patient', requirePatient, async (req, res) => {
  try {
    const patientId = req.user.uid;
    const limit = parseInt(req.query.limit) || 50;

    const result = await PrescriptionModel.getPatientPrescriptions(patientId, limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching patient prescriptions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch prescriptions'
    });
  }
});

// Get prescription details (Both doctor and patient can view)
router.get('/:prescriptionId', requireAuth, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const userId = req.user.uid;

    const result = await PrescriptionModel.getPrescriptionDetails(prescriptionId, userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching prescription details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch prescription details'
    });
  }
});

// Update prescription status (Both doctor and patient can update)
router.put('/:prescriptionId/status', requireAuth, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { status } = req.body;
    const userId = req.user.uid;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const result = await PrescriptionModel.updatePrescriptionStatus(prescriptionId, status, userId);
    res.json(result);
  } catch (error) {
    console.error('Error updating prescription status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update prescription status'
    });
  }
});

// Cancel prescription (Both doctor and patient can cancel)
router.delete('/:prescriptionId', requireAuth, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { reason } = req.body;
    const userId = req.user.uid;

    const result = await PrescriptionModel.cancelPrescription(prescriptionId, userId, reason);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling prescription:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel prescription'
    });
  }
});

// Quick prescription templates (Doctor only)
router.get('/templates/common', requireDoctor, async (req, res) => {
  try {
    // Common prescription templates
    const templates = [
      {
        id: 'common-cold',
        name: 'Common Cold',
        medications: [
          {
            name: 'Paracetamol',
            dosage: '500mg',
            frequency: 'Every 6 hours',
            duration: '3-5 days',
            instructions: 'Take with food'
          },
          {
            name: 'Cetirizine',
            dosage: '10mg',
            frequency: 'Once daily',
            duration: '5 days',
            instructions: 'Take at bedtime'
          }
        ],
        diagnosis: 'Common Cold',
        instructions: 'Rest, drink plenty of fluids, avoid cold foods'
      },
      {
        id: 'hypertension',
        name: 'Hypertension Management',
        medications: [
          {
            name: 'Amlodipine',
            dosage: '5mg',
            frequency: 'Once daily',
            duration: 'Ongoing',
            instructions: 'Take in the morning'
          }
        ],
        diagnosis: 'Hypertension',
        instructions: 'Monitor blood pressure regularly, maintain low sodium diet'
      },
      {
        id: 'diabetes',
        name: 'Diabetes Management',
        medications: [
          {
            name: 'Metformin',
            dosage: '500mg',
            frequency: 'Twice daily',
            duration: 'Ongoing',
            instructions: 'Take with meals'
          }
        ],
        diagnosis: 'Type 2 Diabetes',
        instructions: 'Monitor blood sugar levels, maintain healthy diet and exercise'
      }
    ];

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error fetching prescription templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescription templates'
    });
  }
});

// Drug database search (Doctor only)
router.get('/drugs/search', requireDoctor, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    // Mock drug database (in production, this would query a real drug database)
    const mockDrugs = [
      { name: 'Paracetamol', category: 'Analgesic', commonDosages: ['500mg', '650mg'] },
      { name: 'Ibuprofen', category: 'NSAID', commonDosages: ['200mg', '400mg'] },
      { name: 'Amoxicillin', category: 'Antibiotic', commonDosages: ['250mg', '500mg'] },
      { name: 'Metformin', category: 'Antidiabetic', commonDosages: ['500mg', '850mg'] },
      { name: 'Amlodipine', category: 'Antihypertensive', commonDosages: ['2.5mg', '5mg', '10mg'] },
      { name: 'Cetirizine', category: 'Antihistamine', commonDosages: ['5mg', '10mg'] },
      { name: 'Omeprazole', category: 'PPI', commonDosages: ['20mg', '40mg'] },
      { name: 'Atorvastatin', category: 'Statin', commonDosages: ['10mg', '20mg', '40mg'] }
    ];

    const filteredDrugs = mockDrugs.filter(drug => 
      drug.name.toLowerCase().includes(query.toLowerCase())
    );

    res.json({
      success: true,
      drugs: filteredDrugs
    });
  } catch (error) {
    console.error('Error searching drugs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search drugs'
    });
  }
});

module.exports = router;
