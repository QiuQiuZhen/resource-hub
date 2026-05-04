let tools = [];
let settings = {};
let editingId = "";

const endpoints = {
  auth: "./api/auth.php",
  tools: "./api/tools.php",
  settings: "./api/settings.php",
  upload: "./api/upload.php"
};

const defaultSettings = {
  siteName: "集盒",
  siteSubtitle: "Resource Hub",
  logoText: "集",
  logoUrl: "",
  faviconUrl: "",
  footerText: "© 2026 集盒 Resource Hub",
  icpText: "",
  icpUrl: "",
  resourceTypes: [
    { id: "ai", label: "AI 工具" },
    { id: "computer", label: "电脑工具" }
  ],
  groupsEnabled: true,
  groups: [
    { id: "starter", title: "新手入门", description: "刚关注先看这组" },
    { id: "creator", title: "内容创作", description: "写作、图片、视频" },
    { id: "office", title: "办公装机", description: "截图、PDF、效率" }
  ],
  slides: [],
  preferences: []
};

const elements = {
  logoutButton: document.querySelector("#logoutButton"),
  adminApp: document.querySelector("#adminApp"),
  tabButtons: document.querySelectorAll("[data-panel]"),
  toolsPanel: document.querySelector("#toolsPanel"),
  settingsPanel: document.querySelector("#settingsPanel"),
  toolCount: document.querySelector("#toolCount"),
  aiCount: document.querySelector("#aiCount"),
  aiCountLabel: document.querySelector("#aiCountLabel"),
  computerCount: document.querySelector("#computerCount"),
  computerCountLabel: document.querySelector("#computerCountLabel"),
  toolSearch: document.querySelector("#toolSearch"),
  toolList: document.querySelector("#toolList"),
  toolForm: document.querySelector("#toolForm"),
  settingsForm: document.querySelector("#settingsForm"),
  newToolButton: document.querySelector("#newToolButton"),
  resetButton: document.querySelector("#resetButton"),
  deleteButton: document.querySelector("#deleteButton"),
  iconFile: document.querySelector("#iconFile"),
  uploadIconButton: document.querySelector("#uploadIconButton"),
  clearIconButton: document.querySelector("#clearIconButton"),
  iconPreview: document.querySelector("#iconPreview"),
  addButtonButton: document.querySelector("#addButtonButton"),
  buttonList: document.querySelector("#buttonList"),
  addSlideButton: document.querySelector("#addSlideButton"),
  slideList: document.querySelector("#slideList"),
  addResourceTypeButton: document.querySelector("#addResourceTypeButton"),
  resourceTypeList: document.querySelector("#resourceTypeList"),
  addGroupButton: document.querySelector("#addGroupButton"),
  groupList: document.querySelector("#groupList"),
  toolGroupList: document.querySelector("#toolGroupList"),
  addPreferenceButton: document.querySelector("#addPreferenceButton"),
  preferenceList: document.querySelector("#preferenceList"),
  editorMode: document.querySelector("#editorMode"),
  editorTitle: document.querySelector("#editorTitle"),
  statusText: document.querySelector("#statusText"),
  settingsStatus: document.querySelector("#settingsStatus"),
  categoryOptions: document.querySelector("#categoryOptions")
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char];
  });
}

function splitList(value) {
  return String(value || "")
    .split(/[\n,，、;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function setStatus(element, message, tone = "idle") {
  element.textContent = message;
  element.dataset.tone = tone;
}

function endpoint(path, id = "") {
  const url = new URL(path, window.location.href);
  if (id) url.searchParams.set("id", id);
  return url.href;
}

async function requestJson(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {})
  };

  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...headers,
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
    const message = payload.errors?.join("；") || payload.error || "请求失败";
    throw new Error(message);
  }

  return payload;
}

async function checkAuth() {
  try {
    const auth = await requestJson(endpoint(endpoints.auth));
    if (!auth.loggedIn) {
      window.location.href = "./login.php";
      return;
    }
    await loadAdminData();
  } catch {
    window.location.href = "./login.php";
  }
}

function normalizeToolForForm(tool = {}) {
  const buttons =
    Array.isArray(tool.buttons) && tool.buttons.length
      ? tool.buttons
      : tool.url
        ? [{ label: tool.buttonLabel || "打开官网", url: tool.url }]
        : [{ label: "打开官网", url: "" }];

  const groupIds = normalizeToolGroupIds(tool);

  return {
    id: tool.id || "",
    name: tool.name || "",
    type: tool.type || getResourceTypes()[0]?.id || "ai",
    category: tool.category || "",
    description: tool.description || "",
    longDescription: tool.longDescription || "",
    bestFor: tool.bestFor || "",
    price: tool.price || "",
    platforms: joinList(tool.platforms),
    access: tool.access || "",
    domain: tool.domain || "",
    iconUrl: tool.iconUrl || "",
    buttons,
    tags: joinList(tool.tags),
    groupIds,
    featured: Boolean(tool.featured)
  };
}

function addButtonRow(button = {}) {
  elements.buttonList.insertAdjacentHTML(
    "beforeend",
    `
      <div class="repeat-item button-row">
        <label>
          <span>按钮文案</span>
          <input data-field="label" type="text" value="${escapeHtml(button.label || "")}" placeholder="例如 打开官网" />
        </label>
        <label>
          <span>按钮链接</span>
          <input data-field="url" type="url" value="${escapeHtml(button.url || "")}" placeholder="https://example.com" />
        </label>
        <button class="danger-button small" type="button" data-remove-row>删除</button>
      </div>
    `
  );
}

function updateIconPreview(iconUrl = "") {
  if (!iconUrl) {
    elements.iconPreview.innerHTML = "图标";
    elements.iconPreview.classList.remove("has-image");
    return;
  }

  elements.iconPreview.innerHTML = `<img src="${escapeHtml(iconUrl)}" alt="" />`;
  elements.iconPreview.classList.add("has-image");
}

async function uploadIcon() {
  const file = elements.iconFile.files?.[0];
  if (!file) {
    setStatus(elements.statusText, "请先选择图标文件", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  setStatus(elements.statusText, "正在上传图标", "idle");
  const result = await requestJson(endpoint(endpoints.upload), {
    method: "POST",
    body: formData
  });

  elements.toolForm.elements.iconUrl.value = result.url;
  updateIconPreview(result.url);
  setStatus(elements.statusText, "图标上传成功", "success");
}

function getResourceTypes() {
  return Array.isArray(settings.resourceTypes) && settings.resourceTypes.length
    ? settings.resourceTypes
    : defaultSettings.resourceTypes;
}

function getResourceGroups() {
  return Array.isArray(settings.groups) ? settings.groups : defaultSettings.groups;
}

function normalizeToolGroupIds(tool = {}) {
  const configuredIds = new Set(getResourceGroups().map((group) => group.id));
  const directIds = Array.isArray(tool.groupIds) ? tool.groupIds : [];
  const legacyTagIds = Array.isArray(tool.tags) ? tool.tags.filter((tag) => configuredIds.has(tag)) : [];

  return [...new Set([...directIds, ...legacyTagIds])].filter(Boolean);
}

function renderToolTypeOptions(selectedType = "") {
  const types = getResourceTypes();
  elements.toolForm.elements.type.innerHTML = types
    .map(
      (type) =>
        `<option value="${escapeHtml(type.id)}" ${type.id === selectedType ? "selected" : ""}>${escapeHtml(
          type.label
        )}</option>`
    )
    .join("");
}

function renderToolGroupOptions(selectedGroupIds = []) {
  if (!elements.toolGroupList) return;

  const selected = new Set(selectedGroupIds);
  const groups = getResourceGroups();

  if (!groups.length) {
    elements.toolGroupList.innerHTML = '<p class="muted-note">暂无分组，请先在“站点设置”里添加。</p>';
    return;
  }

  const disabledNote =
    settings.groupsEnabled === false
      ? '<p class="muted-note full">当前前台分组模块已关闭，勾选会保存，但首页暂不显示。</p>'
      : "";

  elements.toolGroupList.innerHTML =
    disabledNote +
    groups
      .map(
        (group) => `
          <label class="check-pill">
            <input type="checkbox" value="${escapeHtml(group.id)}" ${selected.has(group.id) ? "checked" : ""} />
            <span>${escapeHtml(group.title || group.id)}</span>
          </label>
        `
      )
      .join("");
}

function renderButtonRows(buttons) {
  elements.buttonList.innerHTML = "";
  (buttons.length ? buttons : [{ label: "打开官网", url: "" }]).forEach(addButtonRow);
}

function collectButtons() {
  return [...elements.buttonList.querySelectorAll(".button-row")]
    .map((row) => ({
      label: row.querySelector("[data-field='label']").value.trim(),
      url: row.querySelector("[data-field='url']").value.trim()
    }))
    .filter((button) => button.label || button.url);
}

function collectToolGroupIds() {
  if (!elements.toolGroupList) return [];

  return [...elements.toolGroupList.querySelectorAll("input[type='checkbox']:checked")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function fillForm(tool = {}) {
  const data = normalizeToolForForm(tool);
  renderToolTypeOptions(data.type);
  elements.toolForm.elements.id.value = data.id;
  elements.toolForm.elements.name.value = data.name;
  elements.toolForm.elements.type.value = data.type;
  elements.toolForm.elements.category.value = data.category;
  elements.toolForm.elements.description.value = data.description;
  elements.toolForm.elements.longDescription.value = data.longDescription;
  elements.toolForm.elements.bestFor.value = data.bestFor;
  elements.toolForm.elements.price.value = data.price;
  elements.toolForm.elements.platforms.value = data.platforms;
  elements.toolForm.elements.access.value = data.access;
  elements.toolForm.elements.domain.value = data.domain;
  elements.toolForm.elements.iconUrl.value = data.iconUrl;
  elements.toolForm.elements.tags.value = data.tags;
  elements.toolForm.elements.featured.checked = data.featured;
  updateIconPreview(data.iconUrl);
  renderButtonRows(data.buttons);
  renderToolGroupOptions(data.groupIds);

  editingId = data.id;
  elements.deleteButton.disabled = !editingId;
  elements.editorMode.textContent = editingId ? "编辑工具" : "新建工具";
  elements.editorTitle.textContent = data.name || "填写资源信息";
  renderList();
}

function fillDomainFromFirstButton() {
  const domainInput = elements.toolForm.elements.domain;
  if (domainInput.value.trim()) return;

  const firstUrl = collectButtons()[0]?.url || "";
  if (!firstUrl) return;

  try {
    const url = new URL(/^https?:\/\//i.test(firstUrl) ? firstUrl : `https://${firstUrl}`);
    domainInput.value = url.hostname.replace(/^www\./i, "");
  } catch {
    domainInput.value = "";
  }
}

function buildPayload() {
  const form = elements.toolForm.elements;
  const buttons = collectButtons();
  const primaryButton = buttons[0] || { label: "打开官网", url: "" };

  return {
    name: form.name.value,
    type: form.type.value,
    category: form.category.value,
    description: form.description.value,
    longDescription: form.longDescription.value,
    bestFor: form.bestFor.value,
    price: form.price.value,
    platforms: splitList(form.platforms.value),
    access: form.access.value,
    domain: form.domain.value,
    iconUrl: form.iconUrl.value,
    url: primaryButton.url,
    buttonLabel: primaryButton.label,
    buttons,
    groupIds: collectToolGroupIds(),
    tags: splitList(form.tags.value),
    featured: form.featured.checked
  };
}

function renderStats() {
  const types = getResourceTypes();
  const firstType = types[0] || { id: "ai", label: "AI" };
  const secondType = types[1] || { id: "computer", label: "电脑" };
  elements.toolCount.textContent = tools.length;
  elements.aiCount.textContent = tools.filter((tool) => tool.type === firstType.id).length;
  elements.aiCountLabel.textContent = firstType.label;
  elements.computerCount.textContent = tools.filter((tool) => tool.type === secondType.id).length;
  elements.computerCountLabel.textContent = secondType.label;
}

function renderCategoryOptions() {
  const categories = [...new Set(tools.map((tool) => tool.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN")
  );

  elements.categoryOptions.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");
}

function getTypeLabel(typeId) {
  return getResourceTypes().find((type) => type.id === typeId)?.label || typeId || "工具";
}

function renderList() {
  const keyword = elements.toolSearch.value.trim().toLowerCase();
  const filtered = tools
    .filter((tool) => {
      const text = [tool.name, tool.category, tool.description, tool.buttonLabel].join(" ").toLowerCase();
      return text.includes(keyword);
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));

  if (!filtered.length) {
    elements.toolList.innerHTML = '<div class="empty-list">没有匹配的工具</div>';
    return;
  }

  elements.toolList.innerHTML = filtered
    .map(
      (tool) => `
        <button class="tool-item ${tool.id === editingId ? "active" : ""}" type="button" data-id="${escapeHtml(
          tool.id
        )}">
          <span>
            <strong>${escapeHtml(tool.name)}</strong>
            <small>${escapeHtml(tool.category)} · ${escapeHtml(tool.buttonLabel || "打开官网")}</small>
          </span>
          <em>${escapeHtml(getTypeLabel(tool.type))}</em>
        </button>
      `
    )
    .join("");
}

async function loadTools() {
  tools = await requestJson(endpoint(endpoints.tools));
  renderStats();
  renderCategoryOptions();
  renderList();

  if (!editingId) fillForm();
}

function normalizeSettings(data = {}) {
  return {
    ...defaultSettings,
    ...data,
    resourceTypes: Array.isArray(data.resourceTypes) && data.resourceTypes.length ? data.resourceTypes : defaultSettings.resourceTypes,
    groupsEnabled: data.groupsEnabled !== false,
    groups: Array.isArray(data.groups) ? data.groups : defaultSettings.groups,
    slides: Array.isArray(data.slides) ? data.slides : [],
    preferences: Array.isArray(data.preferences) ? data.preferences : []
  };
}

function addSlideRow(slide = {}) {
  elements.slideList.insertAdjacentHTML(
    "beforeend",
    `
      <div class="repeat-item slide-row wide">
        <label>
          <span>小标题</span>
          <input data-field="subtitle" type="text" value="${escapeHtml(slide.subtitle || "")}" placeholder="例如 资源导航页" />
        </label>
        <label>
          <span>主标题</span>
          <input data-field="title" type="text" value="${escapeHtml(slide.title || "")}" placeholder="轮播标题" />
        </label>
        <label>
          <span>图片地址</span>
          <input data-field="image" type="url" value="${escapeHtml(slide.image || "")}" placeholder="https://example.com/banner.jpg" />
        </label>
        <label class="span-all">
          <span>描述文案</span>
          <textarea data-field="description" rows="2" placeholder="轮播描述">${escapeHtml(slide.description || "")}</textarea>
        </label>
        <button class="danger-button small" type="button" data-remove-row>删除</button>
      </div>
    `
  );
}

function addResourceTypeRow(type = {}) {
  elements.resourceTypeList.insertAdjacentHTML(
    "beforeend",
    `
      <div class="repeat-item resource-type-row">
        <label>
          <span>分类 ID</span>
          <input data-field="id" type="text" value="${escapeHtml(type.id || "")}" placeholder="例如 ai" />
        </label>
        <label>
          <span>显示名称</span>
          <input data-field="label" type="text" value="${escapeHtml(type.label || "")}" placeholder="例如 AI 工具" />
        </label>
        <button class="danger-button small" type="button" data-remove-row>删除</button>
      </div>
    `
  );
}

function addGroupRow(group = {}) {
  elements.groupList.insertAdjacentHTML(
    "beforeend",
    `
      <div class="repeat-item group-row wide">
        <label>
          <span>分组 ID</span>
          <input data-field="id" type="text" value="${escapeHtml(group.id || "")}" placeholder="starter" />
        </label>
        <label>
          <span>分组标题</span>
          <input data-field="title" type="text" value="${escapeHtml(group.title || "")}" placeholder="新手入门" />
        </label>
        <label>
          <span>分组描述</span>
          <input data-field="description" type="text" value="${escapeHtml(group.description || "")}" placeholder="刚关注先看这组" />
        </label>
        <button class="danger-button small" type="button" data-remove-row>删除</button>
      </div>
    `
  );
}

function addPreferenceRow(preference = {}) {
  elements.preferenceList.insertAdjacentHTML(
    "beforeend",
    `
      <div class="repeat-item preference-row wide">
        <label>
          <span>筛选 ID</span>
          <input data-field="id" type="text" value="${escapeHtml(preference.id || "")}" placeholder="free" />
        </label>
        <label>
          <span>显示名称</span>
          <input data-field="label" type="text" value="${escapeHtml(preference.label || "")}" placeholder="优先免费" />
        </label>
        <label>
          <span>匹配字段</span>
          <select data-field="field">
            ${[
              ["all", "全部内容"],
              ["price", "价格说明"],
              ["access", "访问情况"],
              ["tags", "标签"],
              ["category", "分类"],
              ["platforms", "支持平台"]
            ]
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${value === (preference.field || "all") ? "selected" : ""}>${label}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="span-all">
          <span>匹配关键词</span>
          <textarea data-field="keywords" rows="2" placeholder="多个关键词可换行或逗号分隔">${escapeHtml(
            joinList(preference.keywords)
          )}</textarea>
        </label>
        <button class="danger-button small" type="button" data-remove-row>删除</button>
      </div>
    `
  );
}

function fillSettingsForm(nextSettings = {}) {
  settings = normalizeSettings(nextSettings);
  const form = elements.settingsForm.elements;
  form.siteName.value = settings.siteName;
  form.siteSubtitle.value = settings.siteSubtitle;
  form.logoText.value = settings.logoText;
  form.logoUrl.value = settings.logoUrl;
  form.faviconUrl.value = settings.faviconUrl;
  form.footerText.value = settings.footerText;
  form.icpText.value = settings.icpText;
  form.icpUrl.value = settings.icpUrl;

  elements.slideList.innerHTML = "";
  (settings.slides.length ? settings.slides : [{}]).forEach(addSlideRow);

  elements.resourceTypeList.innerHTML = "";
  (settings.resourceTypes.length ? settings.resourceTypes : defaultSettings.resourceTypes).forEach(addResourceTypeRow);
  renderToolTypeOptions(elements.toolForm.elements.type.value);

  form.groupsEnabled.checked = settings.groupsEnabled !== false;
  elements.groupList.innerHTML = "";
  settings.groups.forEach(addGroupRow);
  renderToolGroupOptions(collectToolGroupIds());

  elements.preferenceList.innerHTML = "";
  (settings.preferences.length ? settings.preferences : [{}]).forEach(addPreferenceRow);
}

function collectSlides() {
  return [...elements.slideList.querySelectorAll(".slide-row")]
    .map((row) => ({
      subtitle: row.querySelector("[data-field='subtitle']").value.trim(),
      title: row.querySelector("[data-field='title']").value.trim(),
      image: row.querySelector("[data-field='image']").value.trim(),
      description: row.querySelector("[data-field='description']").value.trim()
    }))
    .filter((slide) => slide.title || slide.image);
}

function collectResourceTypes() {
  return [...elements.resourceTypeList.querySelectorAll(".resource-type-row")]
    .map((row) => ({
      id: row.querySelector("[data-field='id']").value.trim(),
      label: row.querySelector("[data-field='label']").value.trim()
    }))
    .filter((type) => type.id && type.label);
}

function collectGroups() {
  return [...elements.groupList.querySelectorAll(".group-row")]
    .map((row) => ({
      id: row.querySelector("[data-field='id']").value.trim(),
      title: row.querySelector("[data-field='title']").value.trim(),
      description: row.querySelector("[data-field='description']").value.trim()
    }))
    .filter((group) => group.id && group.title);
}

function collectPreferences() {
  return [...elements.preferenceList.querySelectorAll(".preference-row")]
    .map((row) => ({
      id: row.querySelector("[data-field='id']").value.trim(),
      label: row.querySelector("[data-field='label']").value.trim(),
      field: row.querySelector("[data-field='field']").value,
      keywords: splitList(row.querySelector("[data-field='keywords']").value)
    }))
    .filter((preference) => preference.label && preference.keywords.length);
}

function buildSettingsPayload() {
  const form = elements.settingsForm.elements;

  return {
    siteName: form.siteName.value,
    siteSubtitle: form.siteSubtitle.value,
    logoText: form.logoText.value,
    logoUrl: form.logoUrl.value,
    faviconUrl: form.faviconUrl.value,
    footerText: form.footerText.value,
    icpText: form.icpText.value,
    icpUrl: form.icpUrl.value,
    resourceTypes: collectResourceTypes(),
    groupsEnabled: form.groupsEnabled.checked,
    groups: collectGroups(),
    slides: collectSlides(),
    preferences: collectPreferences()
  };
}

async function loadSettings() {
  const data = await requestJson(endpoint(endpoints.settings));
  fillSettingsForm(data);
}

async function loadAdminData() {
  try {
    setStatus(elements.statusText, "正在加载", "idle");
    await loadSettings();
    await loadTools();
    setStatus(elements.statusText, "已同步", "success");
    setStatus(elements.settingsStatus, "已同步", "success");
  } catch (error) {
    setStatus(elements.statusText, error.message, "error");
    setStatus(elements.settingsStatus, error.message, "error");
  }
}

function switchPanel(panel) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panel);
  });

  elements.toolsPanel.classList.toggle("active", panel === "tools");
  elements.settingsPanel.classList.toggle("active", panel === "settings");
}

function bindEvents() {
  elements.logoutButton.addEventListener("click", async () => {
    await requestJson(endpoint(endpoints.auth), {
      method: "POST",
      body: JSON.stringify({ action: "logout" })
    });
    window.location.href = "./login.php";
  });

  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchPanel(button.dataset.panel));
  });

  elements.toolSearch.addEventListener("input", renderList);
  elements.newToolButton.addEventListener("click", () => {
    switchPanel("tools");
    fillForm();
    setStatus(elements.statusText, "新建模式", "idle");
  });

  elements.resetButton.addEventListener("click", () => {
    fillForm();
    setStatus(elements.statusText, "已清空", "idle");
  });

  elements.toolList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button) return;
    const tool = tools.find((item) => item.id === button.dataset.id);
    if (tool) {
      switchPanel("tools");
      fillForm(tool);
      setStatus(elements.statusText, "正在编辑", "idle");
    }
  });

  elements.uploadIconButton.addEventListener("click", async () => {
    try {
      await uploadIcon();
    } catch (error) {
      setStatus(elements.statusText, error.message, "error");
    }
  });

  elements.clearIconButton.addEventListener("click", () => {
    elements.toolForm.elements.iconUrl.value = "";
    elements.iconFile.value = "";
    updateIconPreview("");
    setStatus(elements.statusText, "已清除图标", "idle");
  });

  elements.addButtonButton.addEventListener("click", () => addButtonRow({ label: "打开官网", url: "" }));
  elements.buttonList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-row]");
    if (!button) return;
    if (elements.buttonList.querySelectorAll(".button-row").length <= 1) {
      setStatus(elements.statusText, "至少保留一个按钮", "error");
      return;
    }
    button.closest(".repeat-item").remove();
  });

  elements.toolForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    fillDomainFromFirstButton();

    try {
      setStatus(elements.statusText, "正在保存", "idle");
      const payload = buildPayload();
      const saved = editingId
        ? await requestJson(endpoint(endpoints.tools, editingId), {
            method: "PUT",
            body: JSON.stringify(payload)
          })
        : await requestJson(endpoint(endpoints.tools), {
            method: "POST",
            body: JSON.stringify(payload)
          });

      await loadTools();
      fillForm(saved);
      setStatus(elements.statusText, "保存成功", "success");
    } catch (error) {
      setStatus(elements.statusText, error.message, "error");
    }
  });

  elements.deleteButton.addEventListener("click", async () => {
    if (!editingId) return;

    const tool = tools.find((item) => item.id === editingId);
    const confirmed = window.confirm(`确定删除「${tool?.name || editingId}」吗？`);
    if (!confirmed) return;

    try {
      setStatus(elements.statusText, "正在删除", "idle");
      await requestJson(endpoint(endpoints.tools, editingId), {
        method: "DELETE"
      });
      fillForm();
      await loadTools();
      setStatus(elements.statusText, "删除成功", "success");
    } catch (error) {
      setStatus(elements.statusText, error.message, "error");
    }
  });

  elements.addSlideButton.addEventListener("click", () => addSlideRow());
  elements.addResourceTypeButton.addEventListener("click", () => addResourceTypeRow());
  elements.addGroupButton?.addEventListener("click", () => addGroupRow());
  elements.addPreferenceButton.addEventListener("click", () => addPreferenceRow());

  [elements.slideList, elements.resourceTypeList, elements.groupList, elements.preferenceList].filter(Boolean).forEach((list) => {
    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-row]");
      if (!button) return;
      button.closest(".repeat-item").remove();
    });
  });

  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      setStatus(elements.settingsStatus, "正在保存", "idle");
      const saved = await requestJson(endpoint(endpoints.settings), {
        method: "PUT",
        body: JSON.stringify(buildSettingsPayload())
      });
      fillSettingsForm(saved);
      renderStats();
      renderList();
      setStatus(elements.settingsStatus, "保存成功", "success");
    } catch (error) {
      setStatus(elements.settingsStatus, error.message, "error");
    }
  });
}

bindEvents();
checkAuth();
