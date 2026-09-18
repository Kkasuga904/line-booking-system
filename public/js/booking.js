(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const qs = new URLSearchParams(window.location.search);
  const bookingDate = qs.get("date") || "";
  const bookingTime = qs.get("time") || "";

  const summaryEl = $("#summary-text");
  const formEl = $("#booking-form");
  const resultEl = $("#result");
  const submitBtn = $("#submit");

  let resolvedStoreId = "***REMOVED-ROTATE-CREDENTIAL***";

  function setError(field, message) {
    const el = document.getElementById(`err-${field}`);
    if (el) {
      el.textContent = message || "";
    }
  }

  function clearErrors() {
    ["name", "tel", "agree"].forEach((field) => setError(field, ""));
  }

  function sanitizePhone(value) {
    return (value || "").replace(/[^\d]/g, "");
  }

  function isValidPhone(value) {
    const digits = sanitizePhone(value);
    return digits.length === 10 || digits.length === 11;
  }

  async function fetchConfig() {
    try {
      const response = await fetch("/api/config", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("config error");
      const payload = await response.json();
      if (payload && typeof payload.storeId === "string" && payload.storeId.trim()) {
        return payload.storeId.trim();
      }
    } catch (_) {}
    return "***REMOVED-ROTATE-CREDENTIAL***";
  }

  function validateDateTime(date, time) {
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
    const timeOk = /^\d{2}:\d{2}$/.test(time);
    return dateOk && timeOk;
  }

  function setSubmittingState(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? "送信中…" : "この内容で予約する";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearErrors();
    resultEl.textContent = "";

    const nameValue = $("#name").value.trim();
    const telValue = $("#tel").value.trim();
    const noteValue = $("#note").value.trim();
    const agreed = $("#agree").checked;

    let hasError = false;
    if (!nameValue) {
      setError("name", "お名前を入力してください");
      hasError = true;
    }
    if (!isValidPhone(telValue)) {
      setError("tel", "電話番号を正しく入力してください（ハイフン不要）");
      hasError = true;
    }
    if (!agreed) {
      setError("agree", "同意が必要です");
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setSubmittingState(true);

    const payload = {
      store_id: resolvedStoreId,
      date: bookingDate,
      time: bookingTime,
      customer_name: nameValue,
      customer_phone: sanitizePhone(telValue),
      specialRequests: noteValue,
      people: 1,
    };

    try {
      const response = await fetch("/api/reservation/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        const message = data?.error || "予約に失敗しました。時間を置いてお試しください。";
        resultEl.textContent = message;
        setSubmittingState(false);
        return;
      }

      resultEl.textContent = "予約を受け付けました。LINEに確認メッセージを送ります。";
      submitBtn.textContent = "送信完了";
      submitBtn.disabled = true;
    } catch (error) {
      console.error("[booking] submission error", error);
      resultEl.textContent = "通信に失敗しました。電波状況をご確認ください。";
      setSubmittingState(false);
    }
  }

  async function init() {
    if (!validateDateTime(bookingDate, bookingTime)) {
      summaryEl.textContent = "日時情報が不正です。もう一度カレンダーから選び直してください。";
      submitBtn.disabled = true;
      return;
    }

    summaryEl.textContent = `予約日時：${bookingDate} ${bookingTime}`;
    resolvedStoreId = await fetchConfig();

    formEl?.addEventListener("submit", handleSubmit);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
