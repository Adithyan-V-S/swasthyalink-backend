/**
 * OTP Routes for SwasthyaLink
 * Handles OTP generation, sending, and verification
 */

const express = require('express');
const router = express.Router();
const otpService = require('../src/services/otpService');
const { requireDoctor } = require('../src/middleware/auth');

// Send OTP via email (Doctor only)
router.post('/send-email', requireDoctor, async (req, res) => {
  try {
    const { email, doctorName, purpose } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (!doctorName) {
      return res.status(400).json({
        success: false,
        error: 'Doctor name is required'
      });
    }

    const result = await otpService.sendEmailOTP(email, doctorName, purpose);
    res.json(result);
  } catch (error) {
    console.error('Error sending email OTP:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send OTP via email'
    });
  }
});

// Send OTP via SMS (Doctor only)
router.post('/send-sms', requireDoctor, async (req, res) => {
  try {
    const { phone, doctorName, purpose } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    if (!doctorName) {
      return res.status(400).json({
        success: false,
        error: 'Doctor name is required'
      });
    }

    const result = await otpService.sendSMSOTP(phone, doctorName, purpose);
    res.json(result);
  } catch (error) {
    console.error('Error sending SMS OTP:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send OTP via SMS'
    });
  }
});

// Verify OTP (Public endpoint - no auth required as patient might not be logged in)
router.post('/verify', async (req, res) => {
  try {
    const { otpId, otp } = req.body;

    if (!otpId || !otp) {
      return res.status(400).json({
        success: false,
        error: 'OTP ID and OTP are required'
      });
    }

    const result = await otpService.verifyOTP(otpId, otp);
    res.json(result);
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify OTP'
    });
  }
});

// Resend OTP (Public endpoint)
router.post('/resend', async (req, res) => {
  try {
    const { otpId } = req.body;

    if (!otpId) {
      return res.status(400).json({
        success: false,
        error: 'OTP ID is required'
      });
    }

    const result = await otpService.resendOTP(otpId);
    res.json(result);
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resend OTP'
    });
  }
});

// Cleanup expired OTPs (Admin endpoint - could be called by a cron job)
router.delete('/cleanup', async (req, res) => {
  try {
    // Add admin authentication if needed
    const result = await otpService.cleanupExpiredOTPs();
    res.json(result);
  } catch (error) {
    console.error('Error cleaning up OTPs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cleanup OTPs'
    });
  }
});

module.exports = router;
