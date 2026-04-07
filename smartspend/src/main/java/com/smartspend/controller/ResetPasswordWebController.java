package com.smartspend.controller;

import com.smartspend.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ResetPasswordWebController {

    private final AuthService authService;

    @GetMapping(value = "/reset-password-web", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> resetPasswordForm(@RequestParam String token) {
        String html = """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8"/>
              <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
              <title>Reset Password – SmartSpend</title>
              <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                       background: #0f0f1a; color: #ffffff; min-height: 100vh;
                       display: flex; align-items: center; justify-content: center; padding: 20px; }
                .card { background: #1a1a2e; border-radius: 20px; padding: 48px 40px;
                        max-width: 440px; width: 100%%;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
                .icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
                h1 { font-size: 22px; color: #c4b5fd; margin-bottom: 8px; text-align: center; }
                p { font-size: 14px; color: #9ca3af; margin-bottom: 28px; text-align: center; line-height: 1.5; }
                label { display: block; font-size: 13px; color: #d1d5db; margin-bottom: 6px; font-weight: 600; }
                input { width: 100%%; background: #0f0f1a; border: 1px solid #2d2d44; border-radius: 10px;
                        padding: 12px 14px; color: #ffffff; font-size: 15px; outline: none;
                        transition: border-color 0.2s; margin-bottom: 16px; }
                input:focus { border-color: #6C63FF; }
                button { width: 100%%; background: #6C63FF; color: #fff; border: none; border-radius: 12px;
                         padding: 14px; font-size: 16px; font-weight: 700; cursor: pointer;
                         transition: opacity 0.2s; margin-top: 4px; }
                button:hover { opacity: 0.9; }
                .error { background: rgba(239,68,68,0.15); border: 1px solid #ef4444; border-radius: 10px;
                         padding: 12px; font-size: 13px; color: #fca5a5; margin-bottom: 16px; display: none; }
                .success { background: rgba(0,200,151,0.15); border: 1px solid #00c897; border-radius: 10px;
                           padding: 12px; font-size: 13px; color: #6ee7b7; margin-bottom: 16px; display: none; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">🔒</div>
                <h1>Reset Your Password</h1>
                <p>Enter a new password for your SmartSpend account.</p>
                <div class="error" id="err"></div>
                <div class="success" id="ok"></div>
                <form id="form">
                  <label>New Password</label>
                  <input type="password" id="pw" placeholder="Min. 6 characters" required minlength="6"/>
                  <label>Confirm Password</label>
                  <input type="password" id="cpw" placeholder="Repeat new password" required/>
                  <button type="submit" id="btn">Reset Password</button>
                </form>
              </div>
              <script>
                const token = "%s";
                document.getElementById("form").addEventListener("submit", async (e) => {
                  e.preventDefault();
                  const pw = document.getElementById("pw").value;
                  const cpw = document.getElementById("cpw").value;
                  const errEl = document.getElementById("err");
                  const okEl = document.getElementById("ok");
                  const btn = document.getElementById("btn");
                  errEl.style.display = "none";
                  okEl.style.display = "none";
                  if (pw !== cpw) { errEl.textContent = "Passwords do not match."; errEl.style.display = "block"; return; }
                  btn.disabled = true; btn.textContent = "Resetting…";
                  try {
                    const res = await fetch("/api/auth/reset-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ token, newPassword: pw })
                    });
                    const data = await res.json();
                    if (!res.ok) { errEl.textContent = data.error || data.message || "Reset failed."; errEl.style.display = "block"; btn.disabled = false; btn.textContent = "Reset Password"; return; }
                    okEl.textContent = "Password reset! Open the SmartSpend app and log in.";
                    okEl.style.display = "block";
                    document.getElementById("form").style.display = "none";
                  } catch(err) {
                    errEl.textContent = "Network error. Please try again."; errEl.style.display = "block";
                    btn.disabled = false; btn.textContent = "Reset Password";
                  }
                });
              </script>
            </body>
            </html>
            """.formatted(token);
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }
}
