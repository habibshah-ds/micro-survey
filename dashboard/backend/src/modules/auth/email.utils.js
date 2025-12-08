// ============================================
// FILE: backend/src/modules/auth/email.utils.js
// Email utility with stub implementation (swap with real provider)
// ============================================
import { logger } from '../../lib/logger.js';
import { config } from '../../config/index.js';

/**
 * Email service interface
 * STUB IMPLEMENTATION - Replace with SendGrid, AWS SES, etc.
 */
class EmailService {
  constructor() {
    this.fromEmail = config.email?.from || process.env.EMAIL_FROM || 'noreply@example.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} resetToken - Password reset token
   */
  async sendPasswordReset(email, name, resetToken) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;
    
    // STUB: Log email instead of sending (development)
    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      logger.info('📧 [STUB] Password reset email', {
        to: email,
        subject: 'Reset Your Password',
        resetUrl,
        expiresIn: '6 hours',
      });
      
      console.log('\n' + '='.repeat(70));
      console.log('📧 PASSWORD RESET EMAIL (DEVELOPMENT MODE)');
      console.log('='.repeat(70));
      console.log(`To: ${email}`);
      console.log(`Subject: Reset Your Password`);
      console.log('');
      console.log(`Hi ${name},`);
      console.log('');
      console.log('You requested to reset your password. Click the link below:');
      console.log('');
      console.log(`  ${resetUrl}`);
      console.log('');
      console.log('This link will expire in 6 hours.');
      console.log('');
      console.log('If you did not request this, please ignore this email.');
      console.log('='.repeat(70) + '\n');
      
      return { success: true, messageId: 'stub_' + Date.now() };
    }

    // TODO: Replace with real email provider
    // Example with SendGrid:
    // const msg = {
    //   to: email,
    //   from: this.fromEmail,
    //   subject: 'Reset Your Password',
    //   html: this.getPasswordResetTemplate(name, resetUrl),
    // };
    // await sgMail.send(msg);
    
    throw new Error('Email provider not configured for production');
  }

  /**
   * Send email verification email
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {string} verificationToken - Verification token
   */
  async sendEmailVerification(email, name, verificationToken) {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${verificationToken}`;
    
    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      logger.info('📧 [STUB] Email verification', {
        to: email,
        verificationUrl,
      });
      
      console.log('\n' + '='.repeat(70));
      console.log('📧 EMAIL VERIFICATION (DEVELOPMENT MODE)');
      console.log('='.repeat(70));
      console.log(`To: ${email}`);
      console.log(`Subject: Verify Your Email`);
      console.log('');
      console.log(`Hi ${name},`);
      console.log('');
      console.log('Please verify your email address by clicking:');
      console.log('');
      console.log(`  ${verificationUrl}`);
      console.log('');
      console.log('='.repeat(70) + '\n');
      
      return { success: true, messageId: 'stub_' + Date.now() };
    }

    throw new Error('Email provider not configured for production');
  }

  /**
   * Send welcome email
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   */
  async sendWelcome(email, name) {
    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      logger.info('📧 [STUB] Welcome email', { to: email });
      console.log(`\n📧 Welcome email sent to ${email} (STUB)\n`);
      return { success: true, messageId: 'stub_' + Date.now() };
    }

    throw new Error('Email provider not configured for production');
  }

  /**
   * HTML template for password reset email
   * @private
   */
  getPasswordResetTemplate(name, resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Reset Your Password</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${name},</p>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 6 hours.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #999; font-size: 12px; word-break: break-all;">${resetUrl}</p>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();

export async function sendPasswordReset(email, name, resetToken) {
  return emailService.sendPasswordReset(email, name, resetToken);
}

export async function sendEmailVerification(email, name, verificationToken) {
  return emailService.sendEmailVerification(email, name, verificationToken);
}

export async function sendWelcome(email, name) {
  return emailService.sendWelcome(email, name);
}

export default emailService;
