/**
 * OTP Service for SwasthyaLink
 * Handles OTP generation, sending, and verification for patient-doctor connections
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Firebase Firestore - only initialize if Firebase Admin is available
let db = null;
if (admin.apps.length > 0) {
  db = admin.firestore();
} else {
  console.log('⚠️ Firebase Firestore not available in OTP service - using in-memory storage');
}

class OTPService {
  constructor() {
    // Configure email transporter (you'll need to set up your email service)
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail', // or your preferred email service
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password'
      }
    });
  }

  /**
   * Generate a 6-digit OTP
   */
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Generate and send OTP via email
   */
  async sendEmailOTP(email, doctorName, purpose = 'connection') {
    try {
      const otp = this.generateOTP();
      const otpId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in database
      await db.collection('otps').doc(otpId).set({
        id: otpId,
        otp,
        email,
        purpose,
        doctorName,
        verified: false,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      });

      // Send email
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@swasthyalink.com',
        to: email,
        subject: 'SwasthyaLink - Doctor Connection Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">SwasthyaLink - Doctor Connection Request</h2>
            <p>Hello,</p>
            <p><strong>Dr. ${doctorName}</strong> wants to connect with you on SwasthyaLink.</p>
            <p>To accept this connection, please use the following verification code:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #1f2937; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this connection, please ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated message from SwasthyaLink. Please do not reply to this email.
            </p>
          </div>
        `
      };

      // For testing - log OTP to console instead of sending email
      console.log('📧 EMAIL OTP (for testing):');
      console.log('=====================================');
      console.log(`To: ${email}`);
      console.log(`From: Dr. ${doctorName}`);
      console.log(`OTP Code: ${otp}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log('=====================================');
      
      // Uncomment the line below when email is properly configured
      // await this.emailTransporter.sendMail(mailOptions);

      return {
        success: true,
        otpId,
        message: 'OTP generated successfully (check console for testing)',
        debug: { otp, email, doctorName }
      };
    } catch (error) {
      console.error('Error sending email OTP:', error);
      throw new Error('Failed to send OTP via email');
    }
  }

  /**
   * Send OTP via SMS (placeholder - requires SMS service integration)
   */
  async sendSMSOTP(phone, doctorName, purpose = 'connection') {
    try {
      const otp = this.generateOTP();
      const otpId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in database
      await db.collection('otps').doc(otpId).set({
        id: otpId,
        otp,
        phone,
        purpose,
        doctorName,
        verified: false,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      });

      // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
      // For now, we'll just log the OTP (remove in production)
      console.log(`SMS OTP for ${phone}: ${otp}`);

      // Placeholder SMS sending logic
      // await this.smsService.send({
      //   to: phone,
      //   message: `SwasthyaLink: Dr. ${doctorName} wants to connect. Your verification code is: ${otp}. Valid for 10 minutes.`
      // });

      return {
        success: true,
        otpId,
        message: 'OTP sent successfully to phone',
        // Remove this in production
        debug: { otp, phone }
      };
    } catch (error) {
      console.error('Error sending SMS OTP:', error);
      throw new Error('Failed to send OTP via SMS');
    }
  }

  /**
   * Verify OTP
   */
  async verifyOTP(otpId, providedOTP) {
    try {
      const otpRef = db.collection('otps').doc(otpId);
      const otpSnap = await otpRef.get();

      if (!otpSnap.exists()) {
        return {
          success: false,
          error: 'Invalid OTP ID'
        };
      }

      const otpData = otpSnap.data();

      // Check if already verified
      if (otpData.verified) {
        return {
          success: false,
          error: 'OTP already used'
        };
      }

      // Check if expired
      if (new Date() > new Date(otpData.expiresAt)) {
        await otpRef.update({
          expired: true,
          updatedAt: new Date().toISOString()
        });
        return {
          success: false,
          error: 'OTP has expired'
        };
      }

      // Check attempts
      if (otpData.attempts >= otpData.maxAttempts) {
        await otpRef.update({
          blocked: true,
          updatedAt: new Date().toISOString()
        });
        return {
          success: false,
          error: 'Maximum verification attempts exceeded'
        };
      }

      // Verify OTP
      if (otpData.otp !== providedOTP) {
        await otpRef.update({
          attempts: otpData.attempts + 1,
          updatedAt: new Date().toISOString()
        });
        return {
          success: false,
          error: 'Invalid OTP',
          attemptsRemaining: otpData.maxAttempts - (otpData.attempts + 1)
        };
      }

      // OTP is valid
      await otpRef.update({
        verified: true,
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'OTP verified successfully',
        otpData: {
          email: otpData.email,
          phone: otpData.phone,
          purpose: otpData.purpose,
          doctorName: otpData.doctorName
        }
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw new Error('Failed to verify OTP');
    }
  }

  /**
   * Resend OTP
   */
  async resendOTP(otpId) {
    try {
      const otpRef = db.collection('otps').doc(otpId);
      const otpSnap = await otpRef.get();

      if (!otpSnap.exists()) {
        return {
          success: false,
          error: 'Invalid OTP ID'
        };
      }

      const otpData = otpSnap.data();

      if (otpData.verified) {
        return {
          success: false,
          error: 'OTP already verified'
        };
      }

      // Generate new OTP
      const newOTP = this.generateOTP();
      const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await otpRef.update({
        otp: newOTP,
        attempts: 0,
        expiresAt: newExpiresAt.toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Resend based on original method
      if (otpData.email) {
        await this.sendEmailOTP(otpData.email, otpData.doctorName, otpData.purpose);
      } else if (otpData.phone) {
        await this.sendSMSOTP(otpData.phone, otpData.doctorName, otpData.purpose);
      }

      return {
        success: true,
        message: 'OTP resent successfully'
      };
    } catch (error) {
      console.error('Error resending OTP:', error);
      throw new Error('Failed to resend OTP');
    }
  }

  /**
   * Clean up expired OTPs (should be run periodically)
   */
  async cleanupExpiredOTPs() {
    try {
      const expiredOTPs = await db.collection('otps')
        .where('expiresAt', '<', new Date().toISOString())
        .get();

      const batch = db.batch();
      expiredOTPs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      return {
        success: true,
        deletedCount: expiredOTPs.size
      };
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
      throw new Error('Failed to cleanup expired OTPs');
    }
  }
}

module.exports = new OTPService();
