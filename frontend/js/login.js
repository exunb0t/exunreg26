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
    const maybeAutoSubmit = () => {
      const code = Array.from(otpInputs).map((i) => i.value).join("");
      if (code.length === otpInputs.length && /^[0-9]+$/.test(code)) {
        const form = document.getElementById("otp-form");
        if (form && typeof form.requestSubmit === "function") form.requestSubmit();
      }
    };
    otpInputs.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        e.target.value = (e.target.value || "").replace(/\D/g, "").slice(0, 1);
        if (e.target.value.length === 1 && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        } else {
          maybeAutoSubmit();
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

  async handleEmailSubmit(e) {
    e.preventDefault();
    const emailEl = document.getElementById("email");
    const email = (emailEl && emailEl.value ? emailEl.value : "").trim();
    if (!this.validateEmail(email)) {
      Utils.showToast("Please enter a valid email address", "error");
      if (emailEl) emailEl.focus();
      return;
    }
    const submitBtn = e.target.querySelector('button[type="submit"]');
    Utils.setLoading(submitBtn, true);
    try {
      const resp = await window.ExunServices.auth.sendOTP(email);
      const data = (resp && resp.data) || {};
      this.currentEmail = email;
      this.showOTPForm(data);
      if (data.reused) {
        Utils.showToast("OTP already sent. Please check your email.", "info");
      } else if (data.isNewUser) {
        Utils.showToast("OTP sent. A new account will be created on verification.", "success");
      } else {
        Utils.showToast("OTP sent. Welcome back.", "success");
      }
      this.startResendTimer(60);
    } catch (error) {
      const msg = (error && error.message) || "Failed to send OTP";
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
      this.startOtpCountdown(data.expiresAt);
      if (data.reused) {
        Utils.showToast("Earlier OTP still valid. No new email sent.", "info");
      } else {
        Utils.showToast("New OTP sent to your email", "success");
      }
      this.startResendTimer(60);
      this.clearOTPInputs();
    } catch (error) {
      const msg = (error && error.message) || "Failed to resend OTP";
      Utils.showToast(msg, "error");
    } finally {
      Utils.setLoading(resendLink, false);
    }
  }

  stopOtpCountdown() {
    if (this.otpCountdown) {
      clearInterval(this.otpCountdown);
      this.otpCountdown = null;
    }
  }

  startOtpCountdown(expiresAt) {
    this.stopOtpCountdown();
    const meta = document.getElementById("otp-meta");
    if (!meta) return;
    const end = new Date(expiresAt).getTime();
    if (!expiresAt || Number.isNaN(end)) {
      meta.textContent = "Code valid for 10 minutes";
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      const m = Math.floor(left / 60);
      const s = String(left % 60).padStart(2, "0");
      meta.textContent = left > 0 ? `Code expires in ${m}:${s}` : "Code expired. Please resend.";
      if (left <= 0) this.stopOtpCountdown();
    };
    tick();
    this.otpCountdown = setInterval(tick, 1000);
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
      this.startOtpCountdown(data && data.expiresAt);
    }
    const first = document.querySelector(".otp-input");
    if (first) first.focus();
  }

  showEmailForm() {
    this.stopOtpCountdown();
    const authContainer = document.getElementById("auth-container");
    const otpContainer = document.getElementById("otp-container");
    if (authContainer) authContainer.style.display = "block";
    if (otpContainer) otpContainer.style.display = "none";
    this.clearOTPInputs();
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
