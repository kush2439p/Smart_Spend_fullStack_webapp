package com.smartspend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final RestTemplate restTemplate;

    @Value("${resend.api-key}")
    private String resendApiKey;

    @Value("${resend.from-email:SmartSpend <onboarding@resend.dev>}")
    private String fromEmail;

    public void sendVerificationEmail(String toEmail, String name, String token) {
        String subject = "Verify your SmartSpend account";
        String verifyUrl = "https://smartspendfullstackwebapp-production.up.railway.app/api/auth/verify?token=" + token;

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
                  <p>Thanks for signing up. You're one step away from taking control of your finances.</p>
                  <p>Click the button below to verify your email address:</p>
                  <a href="%s" class="btn">✅ Verify My Email</a>
                  <p>Or copy this link into your browser:</p>
                  <p style="word-break:break-all;color:#7c3aed;">%s</p>
                  <p>This link expires in 24 hours.</p>
                </div>
                <div class="footer"><p>© 2026 SmartSpend. All rights reserved.</p></div>
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
                .footer { background: #f9fafb; padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header"><h1>🎉 You're all set, %s!</h1></div>
                <div class="body">
                  <h2>Welcome to SmartSpend</h2>
                  <p>Your email has been verified and your account is ready. Start tracking your expenses, setting budgets, and scanning receipts with AI!</p>
                </div>
                <div class="footer"><p>© 2026 SmartSpend. All rights reserved.</p></div>
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
                .amounts { display: flex; justify-content: space-between; font-size: 14px; color: #6b7280; }
                .footer { background: #f9fafb; padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header"><h1>⚠️ Budget Alert</h1></div>
                <div class="body">
                  <h2>Hey %s, heads up!</h2>
                  <p>Your <strong>%s</strong> spending has reached <strong>%d%%</strong> of your monthly budget.</p>
                  <div class="alert-box">
                    <strong>%s Budget</strong>
                    <div class="amounts"><span>Spent: ₹%s</span><span>Limit: ₹%s</span></div>
                  </div>
                  <p>Consider reviewing your spending to stay within budget.</p>
                </div>
                <div class="footer"><p>© 2026 SmartSpend. All rights reserved.</p></div>
              </div>
            </body>
            </html>
            """.formatted(name, categoryName, (int) percentage, categoryName, spent, limit);

        sendEmail(toEmail, subject, html);
    }

    public void sendPasswordResetEmail(String toEmail, String name, String token) {
        String subject = "Reset your SmartSpend password";
        String resetUrl = "https://smartspendfullstackwebapp-production.up.railway.app/api/reset-password?token=" + token;

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
                .token-box { background: #f3f4f6; border: 2px dashed #d97706; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
                .token-text { font-family: monospace; font-size: 16px; color: #d97706; font-weight: bold; word-break: break-all; }
                .footer { background: #f9fafb; padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header"><h1>🔐 Password Reset</h1></div>
                <div class="body">
                  <h2>Hello, %s!</h2>
                  <p>We received a request to reset your SmartSpend password. Click the button below:</p>
                  <a href="%s" class="btn">🔄 Reset My Password</a>
                  <p>Or enter this token manually in the app:</p>
                  <div class="token-box"><p class="token-text">%s</p></div>
                  <p style="font-size:13px;color:#9ca3af;">This link expires in 1 hour.</p>
                </div>
                <div class="footer"><p>© 2026 SmartSpend. All rights reserved.</p></div>
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
                .success-box { background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
                .footer { background: #f9fafb; padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header"><h1>✅ Password Reset Complete</h1></div>
                <div class="body">
                  <h2 style="color:#1f2937;margin-top:0;">Hi %s!</h2>
                  <div class="success-box"><strong>🎉 Password Updated Successfully!</strong><br>You can now log in with your new password.</div>
                </div>
                <div class="footer"><p>© 2026 SmartSpend. All rights reserved.</p></div>
              </div>
            </body>
            </html>
            """.formatted(name);

        sendEmail(toEmail, subject, html);
    }

    private void sendEmail(String to, String subject, String htmlContent) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(resendApiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = Map.of(
                "from", fromEmail,
                "to", List.of(to),
                "subject", subject,
                "html", htmlContent
            );

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            restTemplate.postForEntity("https://api.resend.com/emails", entity, String.class);
            log.info("Email sent via Resend to: {}", to);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Failed to send email: " + e.getMessage());
        }
    }
}
