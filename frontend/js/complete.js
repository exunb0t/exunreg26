document.addEventListener("DOMContentLoaded", async () => {
  if (document.body.dataset.page !== "complete") return;

  const instField = document.getElementById("institution-field");
  const princField = document.getElementById("principal-name-field");
  const princEmailField = document.getElementById("principal-email-field");
  const messageEl = document.getElementById("message");
  const modeBtns = Array.from(document.querySelectorAll(".mode-switch__btn"));
  const state = { isIndividual: false };
  let dirty = false;
  const markDirty = () => { dirty = true; };

  document.getElementById("complete-profile-form").addEventListener("input", markDirty);

  const schoolInputs = ["institution_name", "principals_name", "principals_email"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const schoolGroups = [instField, princField, princEmailField].filter(Boolean);

  function applyMode() {
    modeBtns.forEach((b) => {
      const active = (b.dataset.mode === "individual") === state.isIndividual;
      b.classList.toggle("active", active);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(active));
    });
    schoolInputs.forEach((el) => {
      el.disabled = state.isIndividual;
    });
    schoolGroups.forEach((g) => g.classList.toggle("is-disabled", state.isIndividual));
  }

  function setMessage(text, kind) {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.dataset.kind = kind || "";
  }

  modeBtns.forEach((b) => {
    b.addEventListener("click", async () => {
      const next = b.dataset.mode === "individual";
      if (next && !state.isIndividual) {
        const inst = (document.getElementById("institution_name").value || "").trim();
        const pn = (document.getElementById("principals_name").value || "").trim();
        const pe = (document.getElementById("principals_email").value || "").trim();
        if (inst || pn || pe) {
          const ok = await Utils.showConfirmModal("Switching to Individual clears your saved school, principal name and principal email. Continue?", "Switch to Individual", "Switch", "Keep editing");
          if (!ok) return;
        }
      }
      state.isIndividual = next;
      markDirty();
      applyMode();
    });
  });

  applyMode();

  let iti = null;
  const phoneEl = document.getElementById("phone_number");
  try {
    if (phoneEl && window.intlTelInput) {
      iti = window.intlTelInput(phoneEl, {
        separateDialCode: true,
        preferredCountries: ["in", "us", "gb", "ae"],
        initialCountry: "in",
        utilsScript: "/js/vendor/intlTelUtils.js"
      });
    }
  } catch (e) {
    iti = null;
  }

  function phoneValue() {
    if (iti && phoneEl) {
      try {
        return iti.getNumber() || "";
      } catch (e) {}
    }
    return phoneEl ? phoneEl.value.trim() : "";
  }

  function phoneValid(value) {
    if (iti && phoneEl) {
      try {
        return iti.isValidNumber();
      } catch (e) {}
    }
    return !!value && value.replace(/\D/g, "").length >= 8;
  }

  try {
    const session = await window.ExunServices.api.getSession();
    if (!session.authenticated) {
      window.location.href = "/login";
      return;
    }
  } catch (e) {
    window.location.href = "/login";
    return;
  }

  try {
    const resp = await window.ExunServices.profile.get();
    const user = (resp && resp.data) || {};
    if (user.phoneNumber) {
      try {
        if (iti) iti.setNumber(user.phoneNumber);
        else document.getElementById("phone_number").value = user.phoneNumber;
      } catch (e) {
        document.getElementById("phone_number").value = user.phoneNumber;
      }
    }
    if (user.principalsEmail) document.getElementById("principals_email").value = user.principalsEmail;
    if (user.principalsName) document.getElementById("principals_name").value = user.principalsName;
    if (user.institutionName) document.getElementById("institution_name").value = user.institutionName;
    if (user.address) document.getElementById("address").value = user.address;
    if (typeof user.individual === "boolean") {
      state.isIndividual = user.individual;
    }
  } catch (err) {}

  applyMode();

  document.getElementById("save-profile").addEventListener("click", async (e) => {
    e.preventDefault();
    setMessage("");

    const isInd = state.isIndividual;
    const payload = {
      phoneNumber: phoneValue(),
      address: (document.getElementById("address").value || "").trim(),
      individual: isInd
    };
    if (!isInd) {
      payload.principalsEmail = (document.getElementById("principals_email").value || "").trim();
      payload.principalsName = (document.getElementById("principals_name").value || "").trim();
      payload.institutionName = (document.getElementById("institution_name").value || "").trim();
    }

    let error = "";
    if (!phoneValid(payload.phoneNumber)) {
      error = "Enter a valid phone number with country code";
    }
    if (!error && !isInd) {
      if (!payload.principalsEmail) {
        error = "Principal's email is required for teams";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.principalsEmail)) {
        error = "Enter a valid email address";
      } else if (!payload.institutionName) {
        error = "Institution name is required";
      }
    }
    if (error) {
      Utils.showToast(error, "error");
      return;
    }

    const saveBtn = document.getElementById("save-profile");
    Utils.setLoading(saveBtn, true);
    try {
      const resp = await window.ExunServices.profile.update(payload);
      if (resp && resp.status === "success") {
        dirty = false;
        Utils.showToast("Profile saved. Redirecting to summary...", "success");
        setTimeout(() => {
          window.location.href = "/summary";
        }, 700);
      } else {
        Utils.showToast((resp && (resp.error || resp.message)) || "Failed to save profile.", "error");
      }
    } catch (err) {
      Utils.showToast((err && err.message) || "Failed to save profile.", "error");
    } finally {
      Utils.setLoading(saveBtn, false);
    }
  });

  const backBtn = document.getElementById("back-to-profile");
  if (backBtn) {
    backBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (dirty) {
        const ok = await Utils.showConfirmModal("You have unsaved changes. Leave without saving?", "Discard changes", "Discard", "Keep editing");
        if (!ok) return;
      }
      window.location.href = "/summary";
    });
  }
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
});
