(() => {
  const form = document.querySelector(
    '.contact-form[data-contact-mode="temporary"]',
  );
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    openNotice();
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
