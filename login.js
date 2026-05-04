const elements = {
  form: document.querySelector("#loginForm"),
  status: document.querySelector("#loginStatus"),
  captchaImage: document.querySelector("#captchaImage"),
  refreshCaptcha: document.querySelector("#refreshCaptcha")
};

function setStatus(message, tone = "idle") {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function refreshCaptcha() {
  elements.captchaImage.src = `./api/captcha.php?t=${Date.now()}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    const plainText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error(plainText || "接口没有返回 JSON，请检查 PHP 错误日志");
  }

  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }

  return payload;
}

elements.refreshCaptcha.addEventListener("click", refreshCaptcha);
elements.captchaImage.addEventListener("click", refreshCaptcha);

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = elements.form.elements;

  try {
    setStatus("正在登录", "idle");
    await requestJson("./api/auth.php", {
      method: "POST",
      body: JSON.stringify({
        username: form.username.value,
        password: form.password.value,
        captcha: form.captcha.value
      })
    });
    setStatus("登录成功，正在进入后台", "success");
    window.location.href = "./admin.php";
  } catch (error) {
    setStatus(error.message, "error");
    form.captcha.value = "";
    refreshCaptcha();
  }
});
