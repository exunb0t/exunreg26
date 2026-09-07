class LoginPage {
  constructor() {
    this.currentEmail = "";
    this.resendTimer = null;
    this.resendUntil = 0;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkExistingSession();
  }

  async checkExistingSession() {
    try {
      const session = await window.ExunServices.api.getSession();
      if (session && session.authenticated) {
        window.location.href = "/summary";
      }
    } catch (e) {}
  }

  setupEventListeners() {
    const authForm = document.getElementById("auth-form");
    const otpForm = document.getElementById("otp-form");
    if (authForm) {
      authForm.addEventListener("submit", (e) => this.handleEmailSubmit(e));
    }
    if (otpForm) {
      otpForm.addEventListener("submit", (e) => this.handleOTPSubmit(e));
    }
    this.setupOTPInputs();
    const resendLink = document.getElementById("resend-otp");
    if (resendLink) {
      resendLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.resendOTP();
      });
    }
    const changeLink = document.getElementById("change-email");
    if (changeLink) {
      changeLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.showEmailForm();
      });
    }
  }

  setupOTPInputs() {
    const otpInputs = document.querySelectorAll(".otp-input");
    otpInputs.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        e.target.value = (e.target.value || "").replace(/\D/g, "").slice(0, 1);
        if (e.target.value.length === 1 && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && input.value === "" && index > 0) {
          otpInputs[index - 1].focus();
        }
      });
      input.addEventListener("paste", (e) => {
        e.preventDefault();
        let pasteData = "";
        try {
          pasteData = e.clipboardData ? e.clipboardData.getData("text") : "";
        } catch (err) {
          pasteData = "";
        }
        const digits = (pasteData.match(/\d/g) || []).slice(0, otpInputs.length);
        if (digits.length === 0) return;
        digits.forEach((char, i) => {
          if (index + i < otpInputs.length) {
            otpInputs[index + i].value = char;
          }
        });
        const nextIndex = Math.min(index + digits.length, otpInputs.length - 1);
        otpInputs[nextIndex].focus();
      });
    });
  }

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
  }

  setStatus(elId, message, kind) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = message || "";
    el.dataset.kind = kind || "";
  }

  async handleEmailSubmit(e) {
    e.preventDefault();
    const emailEl = document.getElementById("email");
    const errorEl = document.getElementById("email-error");
    const email = (emailEl && emailEl.value ? emailEl.value : "").trim();
    if (errorEl) errorEl.textContent = "";
    if (!this.validateEmail(email)) {
      if (errorEl) errorEl.textContent = "Please enter a valid email address";
      return;
    }
    const submitBtn = e.target.querySelector('button[type="submit"]');
    Utils.setLoading(submitBtn, true);
    this.setStatus("auth-status", "Sending OTP...");
    try {
      const resp = await window.ExunServices.auth.sendOTP(email);
      const data = (resp && resp.data) || {};
      this.currentEmail = email;
      this.showOTPForm(data);
      if (data.reused) {
        this.setStatus("otp-status", "An OTP was already sent to this email. It stays valid for 10 minutes. Please check your inbox and spam folder.", "info");
        Utils.showToast("OTP already sent. Please check your email.", "info");
      } else if (data.isNewUser) {
        this.setStatus("otp-status", "OTP sent. A new account will be created when you verify.", "success");
        Utils.showToast("OTP sent. A new account will be created on verification.", "success");
      } else {
        this.setStatus("otp-status", "OTP sent. Welcome back.", "success");
        Utils.showToast("OTP sent. Welcome back.", "success");
      }
      this.startResendTimer(60);
    } catch (error) {
      const msg = (error && error.message) || "Failed to send OTP";
      this.setStatus("auth-status", msg, "error");
      Utils.showToast(msg, "error");
    } finally {
      Utils.setLoading(submitBtn, false);
    }
  }

  async handleOTPSubmit(e) {
    e.preventDefault();
    const otpInputs = document.querySelectorAll(".otp-input");
    const otp = Array.from(otpInputs).map((input) => input.value).join("");
    if (otp.length !== 6) {
      Utils.showToast("Please enter all 6 digits", "error");
      return;
    }
    const submitBtn = e.target.querySelector('button[type="submit"]');
    Utils.setLoading(submitBtn, true);
    try {
      const resp = await window.ExunServices.auth.verifyOTP(this.currentEmail, otp);
      const data = (resp && resp.data) || {};
      if (data.isNewUser) {
        Utils.showToast("Account created. Welcome to Exun 2026.", "success");
      } else {
        Utils.showToast("Login successful. Welcome back.", "success");
      }
      setTimeout(() => {
        window.location.href = "/complete";
      }, 700);
    } catch (error) {
      const msg = (error && error.message) || "OTP verification failed";
      this.setStatus("otp-status", msg, "error");
      Utils.showToast(msg, "error");
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("no otp")) {
        this.clearOTPInputs();
      } else {
        this.clearOTPInputs();
        const first = document.querySelector(".otp-input");
        if (first) first.focus();
      }
    } finally {
      Utils.setLoading(submitBtn, false);
    }
  }

  async resendOTP() {
    if (Date.now() < this.resendUntil) return;
    if (!this.currentEmail) return;
    const resendLink = document.getElementById("resend-otp");
    Utils.setLoading(resendLink, true);
    try {
      const resp = await window.ExunServices.auth.sendOTP(this.currentEmail, true);
      const data = (resp && resp.data) || {};
      if (data.expiresAt) {
        try {
          document.getElementById("otp-meta").textContent = `Code valid until ${new Date(data.expiresAt).toLocaleString()}`;
        } catch (e) {}
      }
      if (data.reused) {
        this.setStatus("otp-status", "Your earlier OTP is still valid for 10 minutes. No new email was sent.", "info");
        Utils.showToast("Earlier OTP still valid. No new email sent.", "info");
      } else {
        this.setStatus("otp-status", "A fresh OTP was sent to your email. It is valid for 10 minutes.", "success");
        Utils.showToast("New OTP sent to your email", "success");
      }
      this.startResendTimer(60);
      this.clearOTPInputs();
    } catch (error) {
      const msg = (error && error.message) || "Failed to resend OTP";
      this.setStatus("otp-status", msg, "error");
      Utils.showToast(msg, "error");
    } finally {
      Utils.setLoading(resendLink, false);
    }
  }

  showOTPForm(data) {
    const authContainer = document.getElementById("auth-container");
    const otpContainer = document.getElementById("otp-container");
    if (authContainer) authContainer.style.display = "none";
    if (otpContainer) otpContainer.style.display = "block";
    const emailLabel = document.getElementById("otp-email");
    if (emailLabel) emailLabel.textContent = this.currentEmail;
    const meta = document.getElementById("otp-meta");
    if (meta) {
      if (data && data.expiresAt) {
        try {
          meta.textContent = `Code valid until ${new Date(data.expiresAt).toLocaleString()}`;
        } catch (e) {
          meta.textContent = "Code valid for 10 minutes";
        }
      } else {
        meta.textContent = "Code valid for 10 minutes";
      }
    }
    const first = document.querySelector(".otp-input");
    if (first) first.focus();
  }

  showEmailForm() {
    const authContainer = document.getElementById("auth-container");
    const otpContainer = document.getElementById("otp-container");
    if (authContainer) authContainer.style.display = "block";
    if (otpContainer) otpContainer.style.display = "none";
    this.clearOTPInputs();
    this.setStatus("otp-status", "");
  }

  startResendTimer(seconds) {
    const resendLink = document.getElementById("resend-otp");
    if (!resendLink) return;
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendUntil = Date.now() + seconds * 1000;
    let remaining = seconds;
    resendLink.style.pointerEvents = "none";
    resendLink.textContent = `Resend OTP (${remaining}s)`;
    this.resendTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(this.resendTimer);
        this.resendTimer = null;
        resendLink.textContent = "Resend OTP";
        resendLink.style.pointerEvents = "auto";
      } else {
        resendLink.textContent = `Resend OTP (${remaining}s)`;
      }
    }, 1000);
  }

  clearOTPInputs() {
    const otpInputs = document.querySelectorAll(".otp-input");
    otpInputs.forEach((input) => {
      input.value = "";
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "login") {
    new LoginPage();
  }
});
