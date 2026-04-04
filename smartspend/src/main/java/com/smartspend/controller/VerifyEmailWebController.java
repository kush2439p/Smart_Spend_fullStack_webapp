package com.smartspend.controller;

import com.smartspend.dto.AuthResponse;
import com.smartspend.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class VerifyEmailWebController {

    private final AuthService authService;

    /**
     * Browser-accessible email verification endpoint.
     * Returns an HTML page — works from any browser on any device.
     * This is the URL sent in the verification email.
     */
    @GetMapping(value = "/verify-email", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> verifyEmailWeb(@RequestParam String token) {
        try {
            AuthResponse result = authService.verifyEmail(token);
            String html = buildSuccessPage(result.getUser().getName());
            return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
        } catch (RuntimeException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Verification failed.";
            boolean expired = msg.startsWith("EXPIRED:");
            if (expired) msg = msg.substring(8);
            String html = buildErrorPage(msg, expired);
            return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
        }
    }

    private String buildSuccessPage(String name) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8"/>
              <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
              <title>Email Verified – SmartSpend</title>
              <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                       background: #0f0f1a; color: #ffffff; min-height: 100vh;
                       display: flex; align-items: center; justify-content: center; padding: 20px; }
                .card { background: #1a1a2e; border-radius: 20px; padding: 48px 40px;
                        max-width: 480px; width: 100%%; text-align: center;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
                .icon { font-size: 64px; margin-bottom: 24px; }
                h1 { font-size: 26px; color: #00c897; margin-bottom: 12px; }
                p { font-size: 16px; color: #9ca3af; line-height: 1.6; margin-bottom: 8px; }
                .name { color: #ffffff; font-weight: 600; }
                .divider { height: 1px; background: #2d2d44; margin: 28px 0; }
                .step { font-size: 14px; color: #6b7280; margin: 8px 0; }
                .step strong { color: #c4b5fd; }
                .badge { display: inline-block; background: rgba(0,200,151,0.15);
                         color: #00c897; border: 1px solid #00c897; border-radius: 50px;
                         padding: 6px 18px; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">✅</div>
                <div class="badge">Verified Successfully</div>
                <h1>You're all set, <span class="name">%s</span>!</h1>
                <p>Your SmartSpend email has been verified successfully.</p>
                <div class="divider"></div>
                <p class="step"><strong>Next step:</strong> Open the SmartSpend app on your phone and log in with your email and password.</p>
                <p class="step" style="margin-top:16px; font-size:13px;">You can close this browser tab.</p>
              </div>
            </body>
            </html>
            """.formatted(name);
    }

    private String buildErrorPage(String message, boolean expired) {
        String title = expired ? "Link Expired" : "Invalid Link";
        String icon = expired ? "⏰" : "❌";
        String color = expired ? "#f59e0b" : "#ef4444";
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8"/>
              <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
              <title>%s – SmartSpend</title>
              <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                       background: #0f0f1a; color: #ffffff; min-height: 100vh;
                       display: flex; align-items: center; justify-content: center; padding: 20px; }
                .card { background: #1a1a2e; border-radius: 20px; padding: 48px 40px;
                        max-width: 480px; width: 100%%; text-align: center;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
                .icon { font-size: 64px; margin-bottom: 24px; }
                h1 { font-size: 26px; color: %s; margin-bottom: 12px; }
                p { font-size: 16px; color: #9ca3af; line-height: 1.6; margin-bottom: 16px; }
                .hint { font-size: 14px; color: #6b7280; margin-top: 16px; }
                .hint strong { color: #c4b5fd; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">%s</div>
                <h1>%s</h1>
                <p>%s</p>
                <p class="hint">Open the <strong>SmartSpend app</strong> and use the <strong>"Resend Email"</strong> button on the verification screen to get a new link.</p>
              </div>
            </body>
            </html>
            """.formatted(title, color, icon, title, message);
    }
}
