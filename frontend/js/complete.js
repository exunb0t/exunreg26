document.addEventListener("DOMContentLoaded", async () => {
  if (document.body.dataset.page !== "complete") return;

  const individualCheckbox = document.getElementById("individual");
  const instField = document.getElementById("institution-field");
  const princField = document.getElementById("principal-name-field");
  const princEmailField = document.getElementById("principal-email-field");
  const fullnameField = document.getElementById("fullname-field");
  const messageEl = document.getElementById("message");

  function toggleFields() {
    const isInd = individualCheckbox ? individualCheckbox.checked : false;
    if (instField) instField.style.display = isInd ? "none" : "block";
    if (princField) princField.style.display = isInd ? "none" : "block";
    if (princEmailField) princEmailField.style.display = isInd ? "none" : "block";
    if (fullnameField) fullnameField.style.display = isInd ? "block" : "none";
  }

  function setMessage(text, kind) {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.dataset.kind = kind || "";
  }

  if (individualCheckbox) {
    individualCheckbox.addEventListener("change", toggleFields);
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
    if (user.fullname) document.getElementById("fullname").value = user.fullname;
    if (user.phoneNumber) document.getElementById("phone_number").value = user.phoneNumber;
    if (user.principalsEmail) document.getElementById("principals_email").value = user.principalsEmail;
    if (user.principalsName) document.getElementById("principals_name").value = user.principalsName;
    if (user.institutionName) document.getElementById("institution_name").value = user.institutionName;
    if (user.address) document.getElementById("address").value = user.address;
    if (typeof user.individual === "boolean" && individualCheckbox) {
      individualCheckbox.checked = user.individual;
    }
  } catch (err) {}

  toggleFields();

  document.getElementById("save-profile").addEventListener("click", async (e) => {
    e.preventDefault();
    setMessage("");

    const isInd = individualCheckbox ? individualCheckbox.checked : false;
    const payload = {
      fullname: (document.getElementById("fullname").value || "").trim(),
      phoneNumber: (document.getElementById("phone_number").value || "").trim(),
      principalsEmail: (document.getElementById("principals_email").value || "").trim(),
      principalsName: (document.getElementById("principals_name").value || "").trim(),
      institutionName: (document.getElementById("institution_name").value || "").trim(),
      address: (document.getElementById("address").value || "").trim(),
      individual: isInd
    };

    let error = "";
    if (isInd && !payload.fullname) {
      error = "Full name is required";
    }
    const digits = payload.phoneNumber.replace(/\D/g, "");
    if (!error && (!payload.phoneNumber || digits.length < 8)) {
      error = "Enter a valid phone number";
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
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/summary";
    });
  }
});
