(() => {
  const form = document.querySelector(".contact-form");
  const notice = document.querySelector("#contact-form-notice");

  if (!form || !notice) return;

  const submitButton = form.querySelector('[type="submit"]');
  const emailLink = notice.querySelector("[data-contact-email]");
  const startedAt = form.querySelector('[name="formStartedAt"]');

  if (startedAt) startedAt.value = new Date().toISOString();

  const buildEmailLink = () => {
    const data = new FormData(form);
    const value = (name) => String(data.get(name) || "").trim();
    const inquiry = value("inquiry") || "Website Inquiry";
    const product = value("product");
    const subject = product ? `${inquiry} — ${product}` : inquiry;

    const body = [
      `Name: ${value("name")}`,
      `Company: ${value("company")}`,
      `Email: ${value("email")}`,
      `Phone: ${value("phone") || "Not provided"}`,
      `Product of Interest: ${product || "Not specified"}`,
      `Inquiry Type: ${inquiry}`,
      "",
      "Message:",
      value("message"),
    ].join("\n");

    emailLink.href =
      "mailto:info@unistarchemical.com" +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  };

  const openNotice = () => {
    buildEmailLink();
    document.body.classList.add("contact-notice-open");

    if (typeof notice.showModal === "function") {
      notice.showModal();
      emailLink.focus();
      return;
    }

    window.alert(
      "Your form has not been sent. Please email info@unistarchemical.com or call (847) 724-8869.",
    );

    document.body.classList.remove("contact-notice-open");
  };

  const closeNotice = () => {
    if (notice.open) notice.close();
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    try {
      const response = await fetch("/api/contact.php", {
        method: "POST",
        body: new FormData(form),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to send message.");
      }

      form.reset();

      if (startedAt) {
        startedAt.value = new Date().toISOString();
      }

      window.alert(
        "Thank you! Your message has been sent successfully. We will be in touch soon.",
      );
    } catch (error) {
      console.error("Contact form submission failed:", error);
      openNotice();
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Request";
      }
    }
  });

  notice.querySelectorAll("[data-dialog-close]").forEach((button) => {
    button.addEventListener("click", closeNotice);
  });

  notice.addEventListener("click", (event) => {
    if (event.target === notice) closeNotice();
  });

  notice.addEventListener("close", () => {
    document.body.classList.remove("contact-notice-open");
    submitButton?.focus();
  });

  notice.addEventListener("cancel", () => {
    document.body.classList.remove("contact-notice-open");
  });
})();