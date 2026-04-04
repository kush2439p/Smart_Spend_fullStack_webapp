package com.smartspend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.public-url:http://10.11.213.10:8081}")
    private String publicUrl;

    @Value("${app.frontend-url:exp://10.11.213.10:8082}")
    private String frontendUrl;

    public void sendVerificationEmail(String toEmail, String name, String token) {
        String subject = "Verify your SmartSpend account";
        // Uses the /verify-email browser endpoint (returns HTML page, not JSON)
        String verifyUrl = publicUrl + "/verify-email?token=" + token;

        String html = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8"/>
              <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 40px; text-align: center; }
                .header h1 { color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 1px; }
                .header p { color: #e0d7ff; margin: 8px 0 0; font-size: 14px; }
                .body { padding: 40px; }
                .body h2 { color: #1f2937; margin-top: 0; }
                .body p { color: #6b7280; line-height: 1.6; }
                .btn { display: inline-block; margin: 24px 0; padding: 14px 36px; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; }
                .footer { background: #f9fafb; padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>💰 SmartSpend</h1>
                  <p>Smart Personal Expense Tracker</p>
                </div>
                <div class="body">
                  <h2>Hello, %s! 👋</h2>
                  <p>Thanks for signing up with SmartSpend. You're just one step away from taking control of your finances.</p>
                  <p>Please verify your email address by clicking the button below:</p>
                  <a href="%s" class="btn">✅ Verify My Email</a>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="word-break:break-all;color:#7c3aed;">%s</p>
                  <p>This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                  <p>© 2026 SmartSpend. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
            """.formatted(name, verifyUrl, verifyUrl);

        sendEmail(toEmail, subject, html);
    }

    public void sendWelcomeEmail(String toEmail, String name) {
        String subject = "Welcome to SmartSpend! 🎉";

        String html = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8"/>
              <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 40px; text-align: center; }
                .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
                .body { padding: 40px; }
                .body h2 { color: #1f2937; }
                .body p { color: #6b7280; line-height: 1.6; }
                .feature { display: flex; align-items: flex-start; margin: 16px 0; }
                .feature-icon { font-size: 24px; margin-right: 12px; }
                .feature-text h4 { margin: 0 0 4px; color: #1f2937; }
                .feature-text p { margin: 0; font-size: 14px; color: #6b7280; }
                .footer { background: #f9fafb; padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎉 You're all set, %s!</h1>
                </div>
                <div class="body">
                  <h2>Welcome to SmartSpend</h2>
                  <p>Your email has been verified and your account is ready. Here's what you can do:</p>
                  <div class="feature">
                    <div class="feature-icon">📊</div>
                    <div class="feature-text">
                      <h4>Track Expenses</h4>
                      <p>Log and categorize all your income and expenses effortlessly.</p>
                    </div>
                  </div>
                  <div class="feature">
                    <div class="feature-icon">🤖</div>
                    <div class="feature-text">
                      <h4>AI Assistant</h4>
                      <p>Just type "spent 500 on food" and let AI do the rest.</p>
                    </div>
                  </div>
                  <div class="feature">
                    <div class="feature-icon">🎯</div>
                    <div class="feature-text">
                      <h4>Budget Goals</h4>
                      <p>Set spending limits and get alerts before you overspend.</p>
                    </div>
                  </div>
                  <div class="feature">
                    <div class="feature-icon">📈</div>
                    <div class="feature-text">
                      <h4>Smart Insights</h4>
                      <p>AI-powered analysis of your spending patterns.</p>
                    </div>
                  </div>
                  <p>Start your financial journey today!</p>
                </div>
                <div class="footer">
                  <p>© 2026 SmartSpend. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
            """.formatted(name);

        sendEmail(toEmail, subject, html);
    }

    public void sendBudgetAlertEmail(String toEmail, String name, String categoryName,
                                      double percentage, String spent, String limit) {
        String subject = "⚠️ Budget Alert: " + categoryName + " spending at " + (int) percentage + "%";

        String html = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8"/>
              <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #ef4444, #f97316); padding: 40px; text-align: center; }
                .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
                .body { padding: 40px; }
                .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .progress-bar { background: #e5e7eb; border-radius: 9999px; height: 12px; margin: 12px 0; }
                .progress-fill { background: linear-gradient(90deg, #f97316, #ef4444); border-radius: 9999px; height: 12px; width: %s%%; }
                .amounts { display: flex; justify-content: space-between; font-size: 14px; color: #6b7280; }
                .footer { background: #f9fafb; padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>⚠️ Budget Alert</h1>
                </div>
                <div class="body">
                  <h2>Hey %s, heads up!</h2>
                  <p>Your <strong>%s</strong> spending has reached <strong>%d%%</strong> of your monthly budget.</p>
                  <div class="alert-box">
                    <strong>%s Budget</strong>
                    <div class="progress-bar">
                      <div class="progress-fill"></div>
                    </div>
                    <div class="amounts">
                      <span>Spent: ₹%s</span>
                      <span>Limit: ₹%s</span>
                    </div>
                  </div>
                  <p>Consider reviewing your spending in this category to stay within your budget.</p>
                </div>
                <div class="footer">
                  <p>© 2026 SmartSpend. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
            """.formatted((int) percentage, name, categoryName, (int) percentage, categoryName, spent, limit);

        sendEmail(toEmail, subject, html);
    }

    public void sendPasswordResetEmail(String toEmail, String name, String token) {
        String subject = "Reset your SmartSpend password";
        // Deep link into the app's reset-password screen
        String resetUrl = frontendUrl + "/reset-password?token=" + token;

        String html = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8"/>
              <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 40px; text-align: center; }
                .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
                .body { padding: 40px; }
                .body h2 { color: #1f2937; margin-top: 0; }
                .body p { color: #6b7280; line-height: 1.6; }
                .btn { display: inline-block; margin: 24px 0; padding: 14px 36px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; }
                .alert { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 20px 0; }
                .token-box { background: #f3f4f6; border: 2px dashed #d97706; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
                .token-text { font-family: monospace; font-size: 16px; color: #d97706; font-weight: bold; word-break: break-all; }
                .footer { background: #f9fafb; padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔐 Password Reset</h1>
                </div>
                <div class="body">
                  <h2>Hello, %s!</h2>
                  <p>We received a request to reset your SmartSpend password. Click the button below to set a new password:</p>
                  <a href="%s" class="btn">🔄 Reset My Password</a>
                  <div class="alert">
                    <strong>⏰ This link expires in 1 hour</strong><br>
                    If you didn't request this password reset, you can safely ignore this email.
                  </div>
                  <p>If the button doesn't work on your device, you can enter the reset token manually:</p>
                  <div class="token-box">
                    <p style="margin: 0 0 8px 0; font-weight: bold; color: #374151;">Your Reset Token:</p>
                    <p class="token-text">%s</p>
                  </div>
                  <p style="font-size: 14px; color: #6b7280;">Open the SmartSpend app and go to the reset password screen, then enter this token manually if the button above doesn't work.</p>
                </div>
                <div class="footer">
                  <p>© 2026 SmartSpend. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
            """.formatted(name, resetUrl, token);

        sendEmail(toEmail, subject, html);
    }

    public void sendPasswordResetConfirmationEmail(String toEmail, String name) {
        String subject = "Password Reset Successful - SmartSpend";

        String html = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8"/>
              <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #10b981, #059669); padding: 40px; text-align: center; }
                .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
                .body { padding: 40px; }
                .body h2 { color: #1f2937; margin-top: 0; }
                .body p { color: #6b7280; line-height: 1.6; }
                .success-box { background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
                .footer { background: #f9fafb; padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Password Reset Complete</h1>
                </div>
                <div class="body">
                  <h2>Hi %s!</h2>
                  <p>Your SmartSpend password has been successfully reset.</p>
                  <div class="success-box">
                    <strong>🎉 Password Updated Successfully!</strong><br>
                    You can now log in with your new password.
                  </div>
                  <p>If you didn't make this change, please contact our support team immediately.</p>
                </div>
                <div class="footer">
                  <p>© 2026 SmartSpend. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
            """.formatted(name);

        sendEmail(toEmail, subject, html);
    }

    private void sendEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Email sent to: {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Failed to send email: " + e.getMessage());
        }
    }
}
