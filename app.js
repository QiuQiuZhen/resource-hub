let resources = window.RESOURCE_DATA || [];
let settings = {};
let heroTimer = null;
let activeSlide = 0;

const API_ENDPOINTS = {
  tools: [window.RESOURCE_API || "./api/tools.php", "/api/tools"],
  settings: [window.SETTINGS_API || "./api/settings.php"]
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
  slides: [
    {
      title: "AI 工具合集 + 电脑必装工具集",
      subtitle: "给公众号自动回复准备的资源导航页",
      description: "把常用工具按场景整理好，用户从公众号点进来就能搜索、筛选、直达官网。",
      image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80"
    }
  ],
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
  preferences: [
    { id: "free", label: "优先免费 / 免费可用", field: "price", keywords: ["免费", "开源"] },
    { id: "domestic", label: "国内访问更友好", field: "all", keywords: ["国内访问友好", "domestic"] }
  ]
};

const state = {
  query: "",
  type: "all",
  category: "all",
  selectedPreferences: new Set(),
  sort: "featured",
  group: null
};

const elements = {
  searchInput: document.querySelector("#searchInput"),
  filterToggle: document.querySelector("#filterToggle"),
  filterPanel: document.querySelector(".filter-panel"),
  typeFilters: document.querySelector(".segmented"),
  categoryFilters: document.querySelector("#categoryFilters"),
  preferenceFilters: document.querySelector("#preferenceFilters"),
  sortSelect: document.querySelector("#sortSelect"),
  resourceGrid: document.querySelector("#resourceGrid"),
  emptyState: document.querySelector("#emptyState"),
  resultCount: document.querySelector("#resultCount"),
  totalCount: document.querySelector("#totalCount"),
  categoryCount: document.querySelector("#categoryCount"),
  heroCarousel: document.querySelector("#heroCarousel"),
  brandMark: document.querySelector("#brandMark"),
  siteName: document.querySelector("#siteName"),
  siteSubtitle: document.querySelector("#siteSubtitle"),
  faviconLink: document.querySelector("#faviconLink"),
  footerText: document.querySelector("#footerText"),
  icpLink: document.querySelector("#icpLink")
};

const categoryColor = {
  对话写作: "mint",
  搜索研究: "cyan",
  办公协作: "blue",
  图片设计: "rose",
  视频音频: "orange",
  编程开发: "violet",
  开发工具: "violet",
  系统效率: "mint",
  截图录屏: "orange",
  浏览下载: "cyan",
  压缩安全: "rose",
  "文档 PDF": "blue",
  文件传输: "mint"
};

let filterToggleBound = false;

function normalizeText(text) {
  return String(text || "").trim().toLowerCase();
}

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

function safeUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "#";
  } catch {
    return "#";
  }
}

function normalizeButtons(item) {
  if (Array.isArray(item.buttons) && item.buttons.length) {
    return item.buttons
      .map((button) => ({
        label: button.label || "打开链接",
        url: button.url || ""
      }))
      .filter((button) => button.url);
  }

  if (item.url) {
    return [
      {
        label: item.buttonLabel || "打开官网",
        url: item.url
      }
    ];
  }

  return [];
}

function normalizeResource(item) {
  const knownTypes = settings.resourceTypes?.map((type) => type.id) || ["ai", "computer"];
  const buttons = normalizeButtons(item);
  const primaryUrl = buttons[0]?.url || item.url || "#";

  return {
    ...item,
    id: item.id || `tool-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: item.name || "未命名工具",
    type: knownTypes.includes(item.type) ? item.type : item.type || "ai",
    category: item.category || "未分类",
    description: item.description || "",
    longDescription: item.longDescription || "",
    bestFor: item.bestFor || "",
    price: item.price || "",
    access: item.access || "",
    url: primaryUrl,
    domain: item.domain || "",
    iconUrl: item.iconUrl || "",
    buttonLabel: buttons[0]?.label || item.buttonLabel || "打开官网",
    buttons,
    groupIds: Array.isArray(item.groupIds) ? item.groupIds : [],
    platforms: Array.isArray(item.platforms) ? item.platforms : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    featured: Boolean(item.featured)
  };
}

function normalizeSettings(data) {
  return {
    ...defaultSettings,
    ...(data || {}),
    slides: Array.isArray(data?.slides) && data.slides.length ? data.slides : defaultSettings.slides,
    resourceTypes:
      Array.isArray(data?.resourceTypes) && data.resourceTypes.length
        ? data.resourceTypes
        : defaultSettings.resourceTypes,
    groupsEnabled: data?.groupsEnabled !== false,
    groups: Array.isArray(data?.groups) ? data.groups : defaultSettings.groups,
    preferences: Array.isArray(data?.preferences) ? data.preferences : defaultSettings.preferences
  };
}

async function fetchFirstJson(endpoints, fallback) {
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) throw new Error("API unavailable");
      return await response.json();
    } catch {
      continue;
    }
  }

  return fallback;
}

async function loadResources() {
  const data = await fetchFirstJson(API_ENDPOINTS.tools, window.RESOURCE_DATA || []);
  resources = Array.isArray(data) ? data.map(normalizeResource) : [];
}

async function loadSettings() {
  const data = await fetchFirstJson(API_ENDPOINTS.settings, defaultSettings);
  settings = normalizeSettings(data);
}

function getCategories() {
  return [...new Set(resources.map((item) => item.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN")
  );
}

function getTypeLabel(typeId) {
  return settings.resourceTypes?.find((type) => type.id === typeId)?.label || typeId || "工具";
}

function getPreferenceValue(item, field) {
  if (field === "price") return item.price;
  if (field === "access") return item.access;
  if (field === "tags") return item.tags.join(" ");
  if (field === "category") return item.category;
  if (field === "platforms") return item.platforms.join(" ");

  return [
    item.name,
    item.type,
    item.category,
    item.description,
    item.longDescription,
    item.bestFor,
    item.price,
    item.access,
    item.domain,
    ...(item.tags || []),
    ...(item.platforms || [])
  ].join(" ");
}

function matchesPreference(item, preference) {
  const keywords = Array.isArray(preference.keywords) ? preference.keywords : [];
  if (!keywords.length) return true;

  const value = normalizeText(getPreferenceValue(item, preference.field || "all"));
  return keywords.some((keyword) => value.includes(normalizeText(keyword)));
}

function matchesSelectedPreferences(item) {
  if (!state.selectedPreferences.size) return true;

  const preferences = settings.preferences || [];
  return [...state.selectedPreferences].every((id) => {
    const preference = preferences.find((item) => item.id === id);
    return preference ? matchesPreference(item, preference) : true;
  });
}

function matchesQuery(item) {
  if (!state.query) return true;
  const keyword = normalizeText(state.query);
  const haystack = getPreferenceValue(item, "all").toLowerCase();

  return haystack.includes(keyword);
}

function isDomesticFriendly(item) {
  return item.access.includes("国内访问友好") || item.tags.includes("domestic");
}

function getToolGroups(item) {
  const groupIds = Array.isArray(item.groupIds) ? item.groupIds : [];
  return [...new Set([...groupIds, ...(item.tags || [])])];
}

function matchesGroup(item) {
  if (!state.group) return true;
  return getToolGroups(item).includes(state.group);
}

function getFilteredResources() {
  const filtered = resources.filter((item) => {
    const typeMatched = state.type === "all" || item.type === state.type;
    const categoryMatched = state.category === "all" || item.category === state.category;

    return (
      typeMatched &&
      categoryMatched &&
      matchesQuery(item) &&
      matchesGroup(item) &&
      matchesSelectedPreferences(item)
    );
  });

  return filtered.sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name);
    if (state.sort === "category") {
      return a.category.localeCompare(b.category, "zh-Hans-CN") || a.name.localeCompare(b.name);
    }

    return Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name);
  });
}

function createLogo(item) {
  const imageUrl = item.iconUrl
    ? safeUrl(item.iconUrl)
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.domain)}&sz=128`;

  return `
    <div class="tool-logo" aria-hidden="true">
      <img src="${imageUrl}" alt="" loading="lazy" />
    </div>
  `;
}

function createPlatformList(platforms) {
  return platforms.map((platform) => `<span>${escapeHtml(platform)}</span>`).join("");
}

function createButtonList(buttons) {
  return buttons
    .map((button, index) => {
      const url = safeUrl(button.url);
      const className = index === 0 ? "visit-link" : "visit-link secondary";

      return `
        <a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(button.label)}
          <span aria-hidden="true">↗</span>
        </a>
      `;
    })
    .join("");
}

function createCard(item) {
  const color = categoryColor[item.category] || "mint";
  const featured = item.featured ? '<span class="badge recommended">推荐</span>' : "";
  const domestic = isDomesticFriendly(item) ? '<span class="badge domestic">国内友好</span>' : "";

  return `
    <article class="resource-card" data-type="${escapeHtml(item.type)}" data-detail-id="${escapeHtml(item.id)}" tabindex="0">
      <div class="card-top">
        ${createLogo(item)}
        <div>
          <p class="type-label">${escapeHtml(getTypeLabel(item.type))}</p>
          <h4>${escapeHtml(item.name)}</h4>
        </div>
      </div>

      <p class="description">${escapeHtml(item.description)}</p>

      <div class="meta-row">
        <span class="category-pill ${color}">${escapeHtml(item.category)}</span>
        ${featured}
        ${domestic}
      </div>

      <dl class="detail-list">
        <div>
          <dt>适合</dt>
          <dd>${escapeHtml(item.bestFor)}</dd>
        </div>
      </dl>

      <div class="platform-list" aria-label="支持平台">
        ${createPlatformList(item.platforms)}
      </div>

      <div class="card-actions">
        <button class="detail-button" type="button">
          查看详情
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  `;
}

function createInfoRow(label, value) {
  if (!value) return "";
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function ensureDetailModal() {
  if (document.querySelector("#detailModal")) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="detail-modal" id="detailModal" aria-hidden="true">
        <div class="detail-backdrop" data-close-detail></div>
        <section class="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
          <button class="detail-close" type="button" data-close-detail aria-label="关闭详情">×</button>
          <div id="detailContent"></div>
        </section>
      </div>
    `
  );

  document.querySelector("#detailModal").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-detail]")) {
      closeDetailModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetailModal();
  });
}

function openDetailModal(item) {
  ensureDetailModal();
  const modal = document.querySelector("#detailModal");
  const content = document.querySelector("#detailContent");
  const detailText = item.longDescription || item.description || "暂未填写详细介绍。";

  content.innerHTML = `
    <div class="detail-header">
      ${createLogo(item)}
      <div>
        <p class="type-label">${escapeHtml(getTypeLabel(item.type))}</p>
        <h2 id="detailTitle">${escapeHtml(item.name)}</h2>
      </div>
    </div>

    <div class="meta-row detail-meta">
      <span class="category-pill ${categoryColor[item.category] || "mint"}">${escapeHtml(item.category)}</span>
      ${item.featured ? '<span class="badge recommended">推荐</span>' : ""}
      ${isDomesticFriendly(item) ? '<span class="badge domestic">国内友好</span>' : ""}
    </div>

    <article class="detail-copy">
      ${escapeHtml(detailText)
        .split(/\n+/)
        .map((paragraph) => `<p>${paragraph}</p>`)
        .join("")}
    </article>

    <dl class="detail-list modal-detail-list">
      ${createInfoRow("适合", item.bestFor)}
      ${createInfoRow("访问", item.access)}
      ${createInfoRow("平台", item.platforms.join("、"))}
    </dl>

    <div class="detail-actions">
      ${createButtonList(item.buttons)}
    </div>
  `;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeDetailModal() {
  const modal = document.querySelector("#detailModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function applySiteSettings() {
  document.title = `${settings.siteName || "集盒"} - AI 工具与电脑必装资源库`;

  elements.siteName.textContent = settings.siteName || "集盒";
  elements.siteSubtitle.textContent = settings.siteSubtitle || "Resource Hub";
  elements.footerText.textContent = settings.footerText || "© 2026 集盒 Resource Hub";

  if (settings.logoUrl) {
    elements.brandMark.innerHTML = `<img src="${escapeHtml(safeUrl(settings.logoUrl))}" alt="" />`;
    elements.brandMark.classList.add("has-image");
  } else {
    elements.brandMark.textContent = settings.logoText || (settings.siteName || "集").slice(0, 1);
    elements.brandMark.classList.remove("has-image");
  }

  if (settings.faviconUrl) {
    elements.faviconLink.href = safeUrl(settings.faviconUrl);
  }

  if (settings.icpText) {
    elements.icpLink.hidden = false;
    elements.icpLink.textContent = settings.icpText;
    elements.icpLink.href = settings.icpUrl ? safeUrl(settings.icpUrl) : "#";
  } else {
    elements.icpLink.hidden = true;
  }
}

function showSlide(index) {
  const slides = elements.heroCarousel.querySelectorAll(".hero-slide");
  const dots = elements.heroCarousel.querySelectorAll(".hero-dot");
  if (!slides.length) return;

  activeSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === activeSlide);
  });

  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === activeSlide);
  });
}

function renderHero() {
  const slides = settings.slides || defaultSettings.slides;
  elements.heroCarousel.innerHTML = `
    <div class="hero-stage">
      ${slides
        .map((slide, index) => {
          const image = safeUrl(slide.image);

          return `
            <section class="hero-slide ${index === 0 ? "active" : ""}">
              <img class="hero-image" src="${escapeHtml(image)}" alt="" loading="${index === 0 ? "eager" : "lazy"}" />
              <div class="hero-scrim"></div>
              <div class="hero-content">
                <p class="eyebrow">${escapeHtml(slide.subtitle || "")}</p>
                <h2>${escapeHtml(slide.title || "")}</h2>
                <p>${escapeHtml(slide.description || "")}</p>
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
    <div class="hero-dots">
      ${slides
        .map(
          (_, index) =>
            `<button class="hero-dot ${index === 0 ? "active" : ""}" type="button" data-slide="${index}" aria-label="切换到第 ${
              index + 1
            } 张轮播"></button>`
        )
        .join("")}
    </div>
  `;

  elements.heroCarousel.querySelectorAll("[data-slide]").forEach((button) => {
    button.addEventListener("click", () => {
      showSlide(Number(button.dataset.slide));
    });
  });

  clearInterval(heroTimer);
  if (slides.length > 1) {
    heroTimer = setInterval(() => showSlide(activeSlide + 1), 5000);
  }
}

function syncMobileLayout() {
  const isMobile = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches;
  document.documentElement.classList.toggle("is-mobile", isMobile);

  if (!isMobile && elements.filterPanel) {
    elements.filterPanel.classList.remove("open");
  }

  if (elements.filterToggle) {
    elements.filterToggle.setAttribute("aria-expanded", "false");
    const icon = elements.filterToggle.querySelector("span");
    if (icon) icon.textContent = "＋";
  }
}

function bindFilterToggle() {
  if (filterToggleBound || !elements.filterToggle || !elements.filterPanel) return;
  filterToggleBound = true;

  elements.filterToggle.addEventListener("click", () => {
    const isOpen = elements.filterPanel.classList.toggle("open");
    elements.filterToggle.setAttribute("aria-expanded", String(isOpen));
    const icon = elements.filterToggle.querySelector("span");
    if (icon) icon.textContent = isOpen ? "－" : "＋";
  });

  window.addEventListener("resize", syncMobileLayout);
  syncMobileLayout();
}

function renderCategories() {
  const categories = getCategories();
  const allButton = `<button class="chip active" type="button" data-category="all">全部分类</button>`;
  const categoryButtons = categories
    .map(
      (category) =>
        `<button class="chip" type="button" data-category="${escapeHtml(category)}">${escapeHtml(
          category
        )}</button>`
    )
    .join("");

  elements.categoryFilters.innerHTML = allButton + categoryButtons;
  elements.categoryCount.textContent = categories.length;
}

function renderTypes() {
  const types = settings.resourceTypes || defaultSettings.resourceTypes;
  const allButton = `<button class="segment active" type="button" data-type="all">全部</button>`;
  const typeButtons = types
    .map(
      (type) =>
        `<button class="segment" type="button" data-type="${escapeHtml(type.id)}">${escapeHtml(type.label)}</button>`
    )
    .join("");

  elements.typeFilters.innerHTML = allButton + typeButtons;
}

function renderPreferences() {
  const preferences = settings.preferences || [];

  if (!preferences.length) {
    elements.preferenceFilters.innerHTML = '<p class="muted-note">暂无偏好筛选</p>';
    return;
  }

  elements.preferenceFilters.innerHTML = preferences
    .map(
      (preference) => `
        <label class="toggle-row">
          <input type="checkbox" value="${escapeHtml(preference.id)}" />
          <span>${escapeHtml(preference.label)}</span>
        </label>
      `
    )
    .join("");
}

function updateCategoryState() {
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === state.category);
  });
}

function updateTypeState() {
  document.querySelectorAll("[data-type]").forEach((button) => {
    if (!button.classList.contains("segment")) return;
    button.classList.toggle("active", button.dataset.type === state.type);
  });
}

function updateGroupState() {
  document.querySelectorAll("[data-group]").forEach((button) => {
    button.classList.toggle("active", button.dataset.group === state.group);
  });
}

function updatePreferenceState() {
  elements.preferenceFilters.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.checked = state.selectedPreferences.has(input.value);
  });
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  const category = params.get("category");
  const query = params.get("q");
  const typeIds = ["all", ...(settings.resourceTypes || []).map((item) => item.id)];

  if (typeIds.includes(type)) state.type = type;
  if (category && ["all", ...getCategories()].includes(category)) state.category = category;
  if (query) state.query = query;

  elements.searchInput.value = state.query;
}

function writeUrlState() {
  const params = new URLSearchParams();
  if (state.type !== "all") params.set("type", state.type);
  if (state.category !== "all") params.set("category", state.category);
  if (state.query) params.set("q", state.query);

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

function renderResources() {
  const filtered = getFilteredResources();
  elements.resourceGrid.innerHTML = filtered.map(createCard).join("");
  elements.resultCount.textContent = filtered.length;
  elements.emptyState.hidden = filtered.length > 0;
  updateCategoryState();
  updateTypeState();
  updateGroupState();
  updatePreferenceState();
  writeUrlState();
}

function renderGroups() {
  const strip = document.querySelector("#groupStrip");
  if (!strip) return;

  const groups = settings.groups || [];
  if (!settings.groupsEnabled || !groups.length) {
    strip.hidden = true;
    strip.innerHTML = "";
    return;
  }

  strip.hidden = false;
  strip.innerHTML = groups
    .map(
      (group) => `
        <button class="collection-card" type="button" data-group="${escapeHtml(group.id)}">
          <span>${escapeHtml(group.title)}</span>
          <strong>${escapeHtml(group.description || "查看这个分组")}</strong>
        </button>
      `
    )
    .join("");
}

function applyGroup(groupId) {
  state.group = state.group === groupId ? null : groupId;
  state.query = "";
  state.type = "all";
  state.category = "all";
  state.selectedPreferences = new Set();
  elements.searchInput.value = state.query;
  renderResources();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.group = null;
    renderResources();
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.type = button.dataset.type;
      state.group = null;
      renderResources();
    });
  });

  elements.categoryFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    state.group = null;
    renderResources();
  });

  elements.preferenceFilters.addEventListener("change", (event) => {
    const input = event.target.closest("input[type='checkbox']");
    if (!input) return;

    if (input.checked) {
      state.selectedPreferences.add(input.value);
    } else {
      state.selectedPreferences.delete(input.value);
    }

    state.group = null;
    renderResources();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderResources();
  });

  const groupStrip = document.querySelector("#groupStrip");
  groupStrip?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group]");
    if (!button) return;
    applyGroup(button.dataset.group);
  });

  elements.resourceGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-detail-id]");
    if (!card) return;
    const item = resources.find((resource) => resource.id === card.dataset.detailId);
    if (item) openDetailModal(item);
  });

  elements.resourceGrid.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const card = event.target.closest("[data-detail-id]");
    if (!card) return;
    event.preventDefault();
    const item = resources.find((resource) => resource.id === card.dataset.detailId);
    if (item) openDetailModal(item);
  });
}

async function init() {
  bindFilterToggle();
  await loadSettings();
  await loadResources();
  applySiteSettings();
  renderHero();
  renderTypes();
  renderCategories();
  renderPreferences();
  renderGroups();
  elements.totalCount.textContent = resources.length;
  readUrlState();
  bindEvents();
  renderResources();
}

init();
