"use strict";

const RULES = window.DAILY_COMPASS_RULES;
const PROGRESS_KEY = "daily-compass-progress-v2";
const SCHEDULE_KEY = "daily-compass-schedule-v2";
const CUSTOM_QUESTS_KEY = "daily-compass-custom-quests-v1";
const QUEST_INBOX_KEY = "daily-compass-quest-inbox-v1";
const QUEST_FEEDBACK_KEY = "daily-compass-quest-feedback-v1";
const QUEST_TUNING_KEY = "daily-compass-quest-tuning-v1";
const WEEKLY_TUNING_KEY = "daily-compass-weekly-tuning-v1";
const WEEKLY_REVIEW_KEY = "daily-compass-weekly-review-v1";
const LEGACY_KEY = "daily-compass-state-v1";
const SERVER_STATE_ENDPOINT = "/api/state";
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];
const WEIGHT_IDS = ["light", "medium", "heavy"];
const FREQUENCY_IDS = ["low", "medium", "high"];
const WEEKLY_WEIGHT_IDS = ["light", "medium", "heavy"];
const WEEKLY_QUEST_XP = 45;
const WEEK_START_DAY = 2;
const DAILY_PLAN_RULE_VERSION = 3;

const selectors = {
  planDate: document.querySelector("#planDate"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  todayTitle: document.querySelector("#todayTitle"),
  questCount: document.querySelector("#questCount"),
  todayQuests: document.querySelector("#todayQuests"),
  todayDayType: document.querySelector("#todayDayType"),
  resetToday: document.querySelector("#resetToday"),
  todaySummary: document.querySelector("#todaySummary"),
  weeklyMini: document.querySelector("#weeklyMini"),
  gamePanel: document.querySelector("#gamePanel"),
  questRoad: document.querySelector("#questRoad"),
  createTravelMemo: document.querySelector("#createTravelMemo"),
  travelMemo: document.querySelector("#travelMemo"),
  weekLabel: document.querySelector("#weekLabel"),
  weeklyQuests: document.querySelector("#weeklyQuests"),
  weekBalance: document.querySelector("#weekBalance"),
  weeklyReviewQuestion: document.querySelector("#weeklyReviewQuestion"),
  weeklyReviewInput: document.querySelector("#weeklyReviewInput"),
  saveWeeklyReview: document.querySelector("#saveWeeklyReview"),
  weeklyReviewStatus: document.querySelector("#weeklyReviewStatus"),
  scheduleMonthLabel: document.querySelector("#scheduleMonthLabel"),
  schedulePrevMonth: document.querySelector("#schedulePrevMonth"),
  scheduleNextMonth: document.querySelector("#scheduleNextMonth"),
  scheduleTodayMonth: document.querySelector("#scheduleTodayMonth"),
  scheduleCalendar: document.querySelector("#scheduleCalendar"),
  dayTypeLegend: document.querySelector("#dayTypeLegend"),
  questForm: document.querySelector("#questForm"),
  customTitle: document.querySelector("#customTitle"),
  customWeight: document.querySelector("#customWeight"),
  customFrequency: document.querySelector("#customFrequency"),
  customMinutes: document.querySelector("#customMinutes"),
  customDetail: document.querySelector("#customDetail"),
  customSourceNote: document.querySelector("#customSourceNote"),
  categoryChecks: document.querySelector("#categoryChecks"),
  dayFitChecks: document.querySelector("#dayFitChecks"),
  clearQuestForm: document.querySelector("#clearQuestForm"),
  questTuningList: document.querySelector("#questTuningList"),
  weeklyTuningList: document.querySelector("#weeklyTuningList"),
  customQuestList: document.querySelector("#customQuestList"),
  removeQuestForm: document.querySelector("#removeQuestForm"),
  removeQuestSelect: document.querySelector("#removeQuestSelect"),
  removeQuestReason: document.querySelector("#removeQuestReason"),
  removedQuestList: document.querySelector("#removedQuestList"),
  forgeMessage: document.querySelector("#forgeMessage"),
  codexNoteInput: document.querySelector("#codexNoteInput"),
  saveCodexNote: document.querySelector("#saveCodexNote"),
  exportCodexData: document.querySelector("#exportCodexData"),
  codexDataOutput: document.querySelector("#codexDataOutput"),
  codexImportInput: document.querySelector("#codexImportInput"),
  importCodexData: document.querySelector("#importCodexData"),
  rulesOverview: document.querySelector("#rulesOverview"),
  questPool: document.querySelector("#questPool"),
  historyStats: document.querySelector("#historyStats"),
  historyLog: document.querySelector("#historyLog"),
  exportProgress: document.querySelector("#exportProgress"),
  importProgress: document.querySelector("#importProgress"),
  dataOutput: document.querySelector("#dataOutput"),
  emptyTemplate: document.querySelector("#emptyStateTemplate"),
};

let activeDate = todayKey();
let progress = loadProgress();
let schedule = loadSchedule();
let customQuests = loadCustomQuests();
let questInbox = loadQuestInbox();
let questFeedback = loadQuestFeedback();
let questTuning = loadQuestTuning();
let weeklyTuning = loadWeeklyTuning();
let weeklyReviews = loadWeeklyReviews();
let scheduleCursor = startOfMonth(parseDate(activeDate));
let serverBackupEnabled = false;
let serverBackupTimer = null;

init();

async function init() {
  serverBackupEnabled = await hydrateFromServerBackup();
  selectors.planDate.value = activeDate;
  populateDayTypeSelect();
  populateQuestFormOptions();
  bindEvents();
  renderAll();
  scheduleServerBackup();
}

function bindEvents() {
  selectors.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  selectors.planDate.addEventListener("change", () => {
    activeDate = selectors.planDate.value || todayKey();
    scheduleCursor = startOfMonth(parseDate(activeDate));
    renderAll();
  });

  selectors.todayDayType.addEventListener("change", () => {
    setDayType(activeDate, selectors.todayDayType.value);
    resetDailyPlan(activeDate);
    renderAll();
  });

  selectors.resetToday.addEventListener("click", () => {
    resetDateProgress(activeDate);
    renderAll();
  });

  selectors.schedulePrevMonth.addEventListener("click", () => {
    scheduleCursor = addMonths(scheduleCursor, -1);
    renderSchedule();
  });

  selectors.scheduleNextMonth.addEventListener("click", () => {
    scheduleCursor = addMonths(scheduleCursor, 1);
    renderSchedule();
  });

  selectors.scheduleTodayMonth.addEventListener("click", () => {
    scheduleCursor = startOfMonth(parseDate(todayKey()));
    renderSchedule();
  });

  selectors.questForm.addEventListener("submit", handleQuestFormSubmit);
  selectors.clearQuestForm.addEventListener("click", resetQuestForm);

  selectors.questTuningList.addEventListener("submit", (event) => {
    if (!event.target.matches(".tuning-form")) return;
    handleQuestTuningSubmit(event);
  });

  selectors.weeklyTuningList.addEventListener("submit", (event) => {
    if (!event.target.matches(".weekly-tuning-form")) return;
    handleWeeklyTuningSubmit(event);
  });

  selectors.saveWeeklyReview.addEventListener("click", saveWeeklyReview);

  selectors.customQuestList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-custom]");
    if (!deleteButton) return;
    deleteCustomQuest(deleteButton.dataset.deleteCustom);
  });

  selectors.removeQuestForm.addEventListener("submit", handleRemoveQuestSubmit);

  selectors.removedQuestList.addEventListener("click", (event) => {
    const restoreButton = event.target.closest("[data-restore-feedback]");
    if (!restoreButton) return;
    restoreQuestFeedback(restoreButton.dataset.restoreFeedback);
  });

  selectors.saveCodexNote.addEventListener("click", saveCodexNote);
  selectors.exportCodexData.addEventListener("click", exportCodexPayload);
  selectors.importCodexData.addEventListener("click", importCodexPayload);
  selectors.createTravelMemo.addEventListener("click", createTravelMemo);

  selectors.exportProgress.addEventListener("click", exportProgressBackup);
  selectors.importProgress.addEventListener("click", importProgressBackup);
}

function loadProgress() {
  const stored = localStorage.getItem(PROGRESS_KEY);
  if (stored) {
    try {
      return normalizeProgress(JSON.parse(stored));
    } catch (error) {
      console.warn("Progress data could not be read.", error);
    }
  }
  return migrateLegacyProgress() || normalizeProgress({});
}

function normalizeProgress(value) {
  return {
    version: 2,
    events: Array.isArray(value.events) ? value.events : [],
    dailyPlans: value.dailyPlans || {},
    weeklyChecks: value.weeklyChecks || {},
  };
}

function migrateLegacyProgress() {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return null;
  try {
    const parsed = JSON.parse(legacy);
    const events = Object.entries(parsed.logs || {}).map(([key, log]) => {
      const [dateKey] = key.split(":");
      return {
        id: `legacy-${key}`,
        dateKey,
        questId: log.taskId || key,
        title: log.title || "旧タスク",
        categories: [log.area || "legacy"],
        weight: "light",
        type: log.status === "done" ? "done" : "reroll",
        createdAt: log.updatedAt || new Date().toISOString(),
      };
    });
    return normalizeProgress({ events });
  } catch (error) {
    console.warn("Legacy data could not be migrated.", error);
    return null;
  }
}

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  scheduleServerBackup();
}

function loadSchedule() {
  const stored = localStorage.getItem(SCHEDULE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        overrides: parsed.overrides || {},
      };
    } catch (error) {
      console.warn("Schedule data could not be read.", error);
    }
  }
  return { overrides: {} };
}

function saveSchedule() {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  scheduleServerBackup();
}

function loadCustomQuests() {
  const stored = localStorage.getItem(CUSTOM_QUESTS_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    const quests = Array.isArray(parsed) ? parsed : parsed.quests;
    if (!Array.isArray(quests)) return [];
    return quests.map(normalizeCustomQuest).filter(Boolean);
  } catch (error) {
    console.warn("Custom quest data could not be read.", error);
    return [];
  }
}

function saveCustomQuests() {
  localStorage.setItem(CUSTOM_QUESTS_KEY, JSON.stringify({
    version: 1,
    quests: customQuests,
  }));
  scheduleServerBackup();
}

function loadQuestInbox() {
  const stored = localStorage.getItem(QUEST_INBOX_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Quest inbox data could not be read.", error);
    return [];
  }
}

function saveQuestInbox() {
  localStorage.setItem(QUEST_INBOX_KEY, JSON.stringify(questInbox));
  scheduleServerBackup();
}

function loadQuestFeedback() {
  const stored = localStorage.getItem(QUEST_FEEDBACK_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Quest feedback data could not be read.", error);
    return [];
  }
}

function saveQuestFeedback() {
  localStorage.setItem(QUEST_FEEDBACK_KEY, JSON.stringify(questFeedback));
  scheduleServerBackup();
}

function loadQuestTuning() {
  const stored = localStorage.getItem(QUEST_TUNING_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Quest tuning data could not be read.", error);
    return [];
  }
}

function saveQuestTuning() {
  localStorage.setItem(QUEST_TUNING_KEY, JSON.stringify(questTuning));
  scheduleServerBackup();
}

function loadWeeklyTuning() {
  const stored = localStorage.getItem(WEEKLY_TUNING_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeWeeklyTuning).filter(Boolean) : [];
  } catch (error) {
    console.warn("Weekly quest tuning data could not be read.", error);
    return [];
  }
}

function saveWeeklyTuning() {
  localStorage.setItem(WEEKLY_TUNING_KEY, JSON.stringify(weeklyTuning));
  scheduleServerBackup();
}

function loadWeeklyReviews() {
  const stored = localStorage.getItem(WEEKLY_REVIEW_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeWeeklyReview).filter(Boolean) : [];
  } catch (error) {
    console.warn("Weekly review data could not be read.", error);
    return [];
  }
}

function saveWeeklyReviews() {
  localStorage.setItem(WEEKLY_REVIEW_KEY, JSON.stringify(weeklyReviews));
  scheduleServerBackup();
}

async function hydrateFromServerBackup() {
  if (location.protocol === "file:") return false;
  try {
    const response = await fetch(SERVER_STATE_ENDPOINT, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401) {
      window.location.href = "/login";
      return false;
    }
    if (!response.ok) return false;
    const payload = await response.json();
    if (!payload?.state) return true;
    const merged = mergePersistentStates(collectPersistentState(), normalizePersistentState(payload.state));
    applyPersistentState(merged);
    savePersistentStateLocally();
    return true;
  } catch (error) {
    console.warn("Server backup could not be loaded.", error);
    return false;
  }
}

function collectPersistentState() {
  return {
    progress,
    schedule,
    customQuests,
    questInbox,
    questFeedback,
    questTuning,
    weeklyTuning,
    weeklyReviews,
    rulesVersion: RULES.version,
  };
}

function normalizePersistentState(value) {
  return {
    progress: normalizeProgress(value.progress || {}),
    schedule: { overrides: value.schedule?.overrides || {} },
    customQuests: Array.isArray(value.customQuests)
      ? value.customQuests.map(normalizeCustomQuest).filter(Boolean)
      : [],
    questInbox: Array.isArray(value.questInbox) ? value.questInbox : [],
    questFeedback: Array.isArray(value.questFeedback) ? value.questFeedback : [],
    questTuning: Array.isArray(value.questTuning) ? value.questTuning : [],
    weeklyTuning: Array.isArray(value.weeklyTuning)
      ? value.weeklyTuning.map(normalizeWeeklyTuning).filter(Boolean)
      : [],
    weeklyReviews: Array.isArray(value.weeklyReviews)
      ? value.weeklyReviews.map(normalizeWeeklyReview).filter(Boolean)
      : [],
    rulesVersion: value.rulesVersion || "",
  };
}

function mergePersistentStates(localState, serverState) {
  return {
    progress: mergeProgress(serverState.progress, localState.progress),
    schedule: {
      overrides: {
        ...(serverState.schedule?.overrides || {}),
        ...(localState.schedule?.overrides || {}),
      },
    },
    customQuests: mergeById(serverState.customQuests, localState.customQuests),
    questInbox: mergeById(serverState.questInbox, localState.questInbox).slice(0, 30),
    questFeedback: mergeById(serverState.questFeedback, localState.questFeedback),
    questTuning: mergeById(serverState.questTuning, localState.questTuning),
    weeklyTuning: mergeWeeklyTuning(serverState.weeklyTuning, localState.weeklyTuning),
    weeklyReviews: mergeById(serverState.weeklyReviews, localState.weeklyReviews),
    rulesVersion: RULES.version,
  };
}

function mergeProgress(serverProgress, localProgress) {
  const events = mergeById(serverProgress.events || [], localProgress.events || [])
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  return normalizeProgress({
    events,
    dailyPlans: {
      ...(serverProgress.dailyPlans || {}),
      ...(localProgress.dailyPlans || {}),
    },
    weeklyChecks: {
      ...(serverProgress.weeklyChecks || {}),
      ...(localProgress.weeklyChecks || {}),
    },
  });
}

function mergeById(serverItems = [], localItems = []) {
  const byId = new Map();
  [...serverItems, ...localItems].forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const id = item.id || item.questId || `${index}-${JSON.stringify(item)}`;
    byId.set(id, item);
  });
  return [...byId.values()];
}

function mergeWeeklyTuning(serverItems = [], localItems = []) {
  const byWeeklyId = new Map();
  [...serverItems, ...localItems].forEach((item) => {
    if (!item || typeof item !== "object" || !item.weeklyId) return;
    const current = byWeeklyId.get(item.weeklyId);
    const currentTime = current ? Date.parse(current.updatedAt || current.createdAt || "") || 0 : 0;
    const nextTime = Date.parse(item.updatedAt || item.createdAt || "") || 0;
    if (!current || nextTime >= currentTime) byWeeklyId.set(item.weeklyId, item);
  });
  return [...byWeeklyId.values()];
}

function applyPersistentState(state) {
  progress = state.progress;
  schedule = state.schedule;
  customQuests = state.customQuests;
  questInbox = state.questInbox;
  questFeedback = state.questFeedback;
  questTuning = state.questTuning;
  weeklyTuning = state.weeklyTuning;
  weeklyReviews = state.weeklyReviews;
}

function savePersistentStateLocally() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  localStorage.setItem(CUSTOM_QUESTS_KEY, JSON.stringify({ version: 1, quests: customQuests }));
  localStorage.setItem(QUEST_INBOX_KEY, JSON.stringify(questInbox));
  localStorage.setItem(QUEST_FEEDBACK_KEY, JSON.stringify(questFeedback));
  localStorage.setItem(QUEST_TUNING_KEY, JSON.stringify(questTuning));
  localStorage.setItem(WEEKLY_TUNING_KEY, JSON.stringify(weeklyTuning));
  localStorage.setItem(WEEKLY_REVIEW_KEY, JSON.stringify(weeklyReviews));
}

function scheduleServerBackup() {
  if (!serverBackupEnabled || location.protocol === "file:") return;
  window.clearTimeout(serverBackupTimer);
  serverBackupTimer = window.setTimeout(pushServerBackup, 400);
}

async function pushServerBackup() {
  try {
    await fetch(SERVER_STATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        version: 1,
        state: collectPersistentState(),
      }),
    }).then((response) => {
      if (response.status === 401) window.location.href = "/login";
    });
  } catch (error) {
    console.warn("Server backup could not be saved.", error);
  }
}

function populateDayTypeSelect() {
  selectors.todayDayType.innerHTML = "";
  Object.entries(RULES.dayTypes).forEach(([id, dayType]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = dayType.label;
    selectors.todayDayType.append(option);
  });
}

function populateQuestFormOptions() {
  selectors.categoryChecks.innerHTML = "";
  Object.entries(RULES.categoryLabels).forEach(([id, label]) => {
    selectors.categoryChecks.append(createCheckbox("custom-category", id, label, id === "pokemon"));
  });

  selectors.dayFitChecks.innerHTML = "";
  Object.entries(RULES.dayTypes).forEach(([id, dayType]) => {
    selectors.dayFitChecks.append(createCheckbox("custom-dayfit", id, dayType.label, true));
  });
}

function createCheckbox(name, value, label, checked = false) {
  const wrapper = document.createElement("label");
  wrapper.className = "check-item";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.value = value;
  input.checked = checked;
  input.defaultChecked = checked;
  wrapper.append(input, document.createTextNode(label));
  return wrapper;
}

function switchView(viewName) {
  selectors.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === viewName);
  });
  selectors.views.forEach((view) => {
    view.classList.toggle("is-active", view.id === `view-${viewName}`);
  });
}

function renderAll() {
  ensureDailyPlan(activeDate);
  renderToday();
  renderWeek();
  renderSchedule();
  renderForge();
  renderRules();
  renderHistory();
}

function renderToday() {
  const date = parseDate(activeDate);
  const dayTypeId = getDayType(activeDate);
  const dayType = RULES.dayTypes[dayTypeId];
  const plan = ensureDailyPlan(activeDate);
  const doneCount = plan.questIds.filter((questId) => isQuestDone(activeDate, questId)).length;

  selectors.todayTitle.textContent = `${date.getMonth() + 1}/${date.getDate()} (${DAY_NAMES[date.getDay()]}) のクエスト`;
  selectors.questCount.textContent = `${doneCount}/${RULES.dailyQuestCount}`;
  selectors.todayDayType.value = dayTypeId;
  selectors.todayQuests.innerHTML = "";

  plan.questIds.forEach((questId) => {
    const quest = findQuest(questId);
    if (quest) selectors.todayQuests.append(createQuestCard(quest, activeDate));
  });

  while (selectors.todayQuests.children.length < RULES.dailyQuestCount) {
    selectors.todayQuests.append(emptyState("候補が足りません", "追加画面かCodexでクエスト候補を増やせます。"));
    break;
  }

  renderTodaySummary(plan, dayType);
  renderWeeklyMini();
  renderGamePanel();
  renderQuestRoad();
}

function renderTodaySummary(plan, dayType) {
  const categories = plan.questIds.flatMap((questId) => findQuest(questId)?.categories || []);
  const heavyCount = plan.questIds.filter((questId) => findQuest(questId)?.weight === "heavy").length;
  selectors.todaySummary.innerHTML = "";
  [
    ["日タイプ", dayType.label],
    ["分類", compactCategorySummary(categories)],
    ["重め", `${heavyCount}/${dayType.heavyLimit}`],
    ["入れ替え", `${getDateEvents(activeDate, "reroll").length}回`],
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "summary-item";
    item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    selectors.todaySummary.append(item);
  });
}

function createQuestCard(quest, dateKey) {
  const done = isQuestDone(dateKey, quest.id);
  const card = document.createElement("article");
  card.className = `quest-card category-${dominantCategory(quest)} ${done ? "is-done" : ""}`;
  const categories = formatCategories(quest.categories);
  const source = sourceLabel(quest);
  card.innerHTML = `
    <div class="quest-main">
      <div class="quest-title-row">
        <h3>${escapeHtml(quest.title)}</h3>
        <span class="badge">${escapeHtml(categories)}</span>
        <span class="badge ${quest.weight}">${escapeHtml(RULES.weightLabels[quest.weight] || quest.weight)}</span>
        <span class="xp-badge">+${xpForWeight(quest.weight)} EXP</span>
        ${source ? `<span class="source-badge">${escapeHtml(source)}</span>` : ""}
      </div>
      <div class="quest-detail" hidden>
        ${createQuestDetailHtml(quest, dateKey)}
      </div>
    </div>
    <div class="quest-actions">
      <button class="small-button done" type="button" data-action="done" ${done ? "disabled" : ""}>${done ? "完了済み" : "完了"}</button>
      <button class="small-button reroll" type="button" data-action="reroll" ${done ? "disabled" : ""}>入れ替え</button>
      <button class="small-button" type="button" data-action="detail">詳細</button>
    </div>
  `;
  card.querySelector('[data-action="done"]').addEventListener("click", () => {
    markDone(dateKey, quest);
    renderAll();
  });
  card.querySelector('[data-action="reroll"]').addEventListener("click", () => {
    rerollQuest(dateKey, quest);
    renderAll();
  });
  card.querySelector('[data-action="detail"]').addEventListener("click", (event) => {
    const detail = card.querySelector(".quest-detail");
    const isHidden = detail.hasAttribute("hidden");
    detail.toggleAttribute("hidden", !isHidden);
    event.currentTarget.textContent = isHidden ? "閉じる" : "詳細";
  });
  card.querySelector(".tuning-form").addEventListener("submit", handleQuestTuningSubmit);
  return card;
}

function createQuestDetailHtml(quest, dateKey) {
  const dayType = RULES.dayTypes[getDayType(dateKey)];
  const lastDone = lastEventForQuest(quest.id, "done", dateKey);
  const lastShown = lastShownDate(quest.id, dateKey);
  const reason = explainQuest(quest, dateKey);
  const source = sourceLabel({ source: quest.source }) || "標準ルール";
  return `
    <div class="detail-grid">
      <span>分類</span><strong>${escapeHtml(formatCategories(quest.categories))}</strong>
      <span>重さ</span><strong>${escapeHtml(RULES.weightLabels[quest.weight] || quest.weight)}</strong>
      <span>獲得EXP</span><strong>+${xpForWeight(quest.weight)} EXP</strong>
      <span>想定時間</span><strong>${quest.minutes}分</strong>
      <span>今日の扱い</span><strong>${escapeHtml(dayType.label)}</strong>
      <span>前回表示</span><strong>${escapeHtml(lastShown || "記録なし")}</strong>
      <span>前回完了</span><strong>${escapeHtml(lastDone?.dateKey || "記録なし")}</strong>
      <span>登録元</span><strong>${escapeHtml(source)}</strong>
      ${quest.tuningId ? `<span>調整理由</span><strong>${escapeHtml(quest.tuningReason || "記録なし")}</strong>` : ""}
      ${quest.tunedAt ? `<span>調整日</span><strong>${escapeHtml(quest.tunedAt.slice(0, 10))}</strong>` : ""}
      <span>判断</span><strong>${escapeHtml(reason)}</strong>
      <span>メモ</span><strong>${escapeHtml(quest.detail)}</strong>
      ${quest.sourceNote ? `<span>補足</span><strong>${escapeHtml(quest.sourceNote)}</strong>` : ""}
    </div>
    ${createQuestTuningHtml(quest)}
  `;
}

function createQuestTuningHtml(quest) {
  const tuning = getQuestTuning(quest.id);
  return `
    <form class="tuning-form" data-quest-id="${escapeHtml(quest.id)}">
      <div class="tuning-grid">
        <label>
          重さ
          <select name="weight">
            ${createOptionHtml(WEIGHT_IDS, RULES.weightLabels, tuning?.weight || quest.weight)}
          </select>
        </label>
        <label>
          想定分
          <input name="minutes" type="number" min="1" max="180" value="${quest.minutes}">
        </label>
        <label>
          頻度
          <select name="frequency">
            ${createOptionHtml(FREQUENCY_IDS, frequencyLabels(), tuning?.frequency || quest.frequency)}
          </select>
        </label>
        <label class="wide-field">
          メモ
          <textarea name="detail" rows="3">${escapeHtml(tuning?.detail ?? quest.detail)}</textarea>
        </label>
        <label class="wide-field">
          調整メモ
          <textarea name="reason" rows="2">${escapeHtml(tuning?.reason || "")}</textarea>
        </label>
        <div class="form-actions wide-field">
          <button class="small-button done" type="submit">調整を保存</button>
          ${tuning ? '<span class="source-badge">調整済み</span>' : ""}
        </div>
      </div>
    </form>
  `;
}

function createOptionHtml(ids, labels, selectedId) {
  return ids.map((id) => {
    const selected = id === selectedId ? " selected" : "";
    return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(labels[id] || id)}</option>`;
  }).join("");
}

function frequencyLabels() {
  return {
    low: "低め",
    medium: "普通",
    high: "高め",
  };
}

function weeklyWeightLabels() {
  return {
    light: "軽め",
    medium: "標準",
    heavy: "重め",
  };
}

function renderWeek() {
  const weekKey = getWeekKey(activeDate);
  const weekQuests = buildWeeklyQuests(activeDate);
  selectors.weekLabel.textContent = formatWeekStatus(activeDate);
  selectors.weeklyQuests.innerHTML = "";

  weekQuests.forEach((quest) => {
    const checked = isWeeklyDone(weekKey, quest.id);
    const card = document.createElement("article");
    card.className = `weekly-card weekly-${quest.weeklyWeight || "medium"} ${checked ? "is-done" : ""}`;
    card.innerHTML = `
      <div>
        <div class="weekly-title-row">
          <h3>${escapeHtml(quest.title)}</h3>
          <span class="badge ${quest.weeklyWeight || "medium"}">${escapeHtml(weeklyWeightLabels()[quest.weeklyWeight || "medium"])}</span>
          <span class="xp-badge">+${WEEKLY_QUEST_XP} EXP</span>
          ${quest.tuningId ? '<span class="source-badge">調整済み</span>' : ""}
        </div>
        <p>${escapeHtml(quest.detail)}</p>
        <div class="quest-detail" hidden>
          ${createWeeklyDetailHtml(quest, activeDate)}
        </div>
      </div>
      <div class="weekly-actions">
        <button class="small-button" type="button" data-action="weekly-detail">詳細</button>
        <button class="small-button done" type="button" data-action="weekly-done" ${checked ? "disabled" : ""}>${checked ? "達成済み" : "達成"}</button>
      </div>
    `;
    card.querySelector('[data-action="weekly-done"]').addEventListener("click", () => {
      markWeeklyDone(weekKey, quest);
      renderAll();
    });
    card.querySelector('[data-action="weekly-detail"]').addEventListener("click", () => {
      const detail = card.querySelector(".quest-detail");
      const isHidden = detail.hasAttribute("hidden");
      detail.toggleAttribute("hidden", !isHidden);
    });
    card.querySelector(".weekly-tuning-form").addEventListener("submit", handleWeeklyTuningSubmit);
    selectors.weeklyQuests.append(card);
  });

  renderWeekBalance();
  renderWeeklyReview();
}

function createWeeklyDetailHtml(quest, dateKey) {
  const weekKey = getWeekKey(dateKey);
  const tuning = getWeeklyTuning(quest.id);
  return `
    <div class="detail-grid">
      <span>期間</span><strong>${escapeHtml(formatWeekRange(dateKey))}</strong>
      <span>扱い</span><strong>${escapeHtml(weeklyWeightLabels()[quest.weeklyWeight || "medium"])}</strong>
      <span>獲得EXP</span><strong>+${WEEKLY_QUEST_XP} EXP</strong>
      <span>締め</span><strong>${escapeHtml(formatRemainingDays(dateKey))}</strong>
      <span>状態</span><strong>${isWeeklyDone(weekKey, quest.id) ? "達成済み" : "未達成"}</strong>
      ${quest.tuningReason ? `<span>調整理由</span><strong>${escapeHtml(quest.tuningReason)}</strong>` : ""}
      ${quest.tunedAt ? `<span>調整日</span><strong>${escapeHtml(quest.tunedAt.slice(0, 10))}</strong>` : ""}
      <span>メモ</span><strong>${escapeHtml(quest.detail)}</strong>
      ${quest.tuningNote ? `<span>Codex向け</span><strong>${escapeHtml(quest.tuningNote)}</strong>` : ""}
    </div>
    ${createWeeklyTuningHtml(quest, tuning)}
  `;
}

function createWeeklyTuningHtml(quest, tuning = getWeeklyTuning(quest.id)) {
  return `
    <form class="weekly-tuning-form" data-weekly-id="${escapeHtml(quest.id)}">
      <div class="tuning-grid">
        <label class="wide-field">
          タイトル
          <input name="title" type="text" maxlength="60" value="${escapeHtml(tuning?.title || quest.title)}">
        </label>
        <label>
          重さ感
          <select name="weeklyWeight">
            ${createOptionHtml(WEEKLY_WEIGHT_IDS, weeklyWeightLabels(), tuning?.weeklyWeight || quest.weeklyWeight || "medium")}
          </select>
        </label>
        <label class="wide-field">
          詳細
          <textarea name="detail" rows="3">${escapeHtml(tuning?.detail ?? quest.detail)}</textarea>
        </label>
        <label class="wide-field">
          Codex向けメモ
          <textarea name="note" rows="2">${escapeHtml(tuning?.note || "")}</textarea>
        </label>
        <label class="wide-field">
          調整理由
          <textarea name="reason" rows="2">${escapeHtml(tuning?.reason || "")}</textarea>
        </label>
        <div class="form-actions wide-field">
          <button class="small-button done" type="submit">週クエスト調整を保存</button>
          ${tuning ? '<span class="source-badge">調整済み</span>' : ""}
        </div>
      </div>
    </form>
  `;
}

function renderWeeklyMini() {
  const weekKey = getWeekKey(activeDate);
  const weekQuests = buildWeeklyQuests(activeDate);
  const rangeRow = document.createElement("div");
  selectors.weeklyMini.innerHTML = "";
  rangeRow.className = "mini-row week-range";
  rangeRow.innerHTML = `<span>${escapeHtml(formatWeekRange(activeDate))}</span><strong>${escapeHtml(formatRemainingDays(activeDate))}</strong>`;
  selectors.weeklyMini.append(rangeRow);
  weekQuests.forEach((quest) => {
    const row = document.createElement("div");
    const done = isWeeklyDone(weekKey, quest.id);
    row.className = `mini-row ${done ? "is-done" : ""}`;
    row.innerHTML = `<span>${escapeHtml(quest.title)}</span><strong>${done ? "済" : "未"}</strong>`;
    selectors.weeklyMini.append(row);
  });
}

function renderGamePanel() {
  const stats = getGameStats();
  const rank = getRank(stats.xp);
  const nextRank = getNextRank(stats.xp);
  const reward = getRewardStatus(stats.xp);
  const upcomingRanks = getUpcomingRanks(stats.xp);
  const upcomingRewards = getUpcomingRewards(stats.xp);
  const surpriseGift = getSurpriseGift(stats.xp, activeDate);
  const rankProgress = nextRank
    ? Math.min(100, Math.round(((stats.xp - rank.xp) / (nextRank.xp - rank.xp)) * 100))
    : 100;

  selectors.gamePanel.innerHTML = `
    <div class="xp-card">
      <div class="xp-topline">
        <span>${escapeHtml(rank.label)}</span>
        <strong>${stats.xp} EXP</strong>
      </div>
      <div class="xp-bar" aria-label="次の称号まで">
        <span style="width: ${rankProgress}%"></span>
      </div>
      <p>${escapeHtml(nextRank ? `次の称号「${nextRank.label}」まで ${nextRank.xp - stats.xp} EXP` : "最高称号に到達中")}</p>
    </div>
    ${reward.current ? `
      <div class="reward-card is-unlocked">
        <span>獲得済みのご褒美</span>
        <strong>${escapeHtml(reward.current.title)}</strong>
        <p>${escapeHtml(reward.current.detail)}</p>
        <em>目的の邪魔をしない報酬だけを採用</em>
      </div>
    ` : ""}
    <div class="reward-card ${reward.allUnlocked ? "is-unlocked" : ""}">
      <span>${escapeHtml(reward.next ? "次のご褒美" : "ご褒美コンプリート")}</span>
      <strong>${escapeHtml(reward.target.title)}</strong>
      <p>${escapeHtml(reward.target.detail)}</p>
      <em>${escapeHtml(reward.next ? `あと ${reward.remaining} EXP` : "すべて解放済み")}</em>
    </div>
    <div class="preview-grid">
      <div class="preview-card">
        <span>称号予告</span>
        ${upcomingRanks.length ? upcomingRanks.map((item) => `<strong>${escapeHtml(item.label)}<em>${item.xp} EXP</em></strong>`).join("") : "<strong>最高称号まで到達中</strong>"}
      </div>
      <div class="preview-card">
        <span>ご褒美予告</span>
        ${upcomingRewards.length ? upcomingRewards.map((item) => `<strong>${escapeHtml(item.title)}<em>${item.xp} EXP</em></strong>`).join("") : "<strong>すべて解放済み</strong>"}
      </div>
    </div>
    <div class="policy-card">
      <span>ご褒美の考え方</span>
      <strong>本人が喜ぶものもOK。条件は、目的を邪魔しないこと</strong>
      <p>一人時間、休み時間、銭湯、別ゲーム、動画やアニメを候補にする。夜食・爆食い・散財・追加タスク感の強いものは避ける。</p>
    </div>
    <div class="surprise-card">
      <span>Codexからの贈り物</span>
      <strong>${escapeHtml(surpriseGift.title)}</strong>
      <p>${escapeHtml(surpriseGift.detail)}</p>
      <em>刺さらなければ次回調整で外してOK</em>
    </div>
    <div class="tip-list">
      ${gameTips().map((tip) => `<div class="tip-row"><span>${escapeHtml(tip.label)}</span><strong>${escapeHtml(tip.text)}</strong></div>`).join("")}
    </div>
  `;
}

function renderQuestRoad() {
  const plan = ensureDailyPlan(activeDate);
  const weekKey = getWeekKey(activeDate);
  const dailyNodes = plan.questIds.map((questId, index) => {
    const quest = findQuest(questId);
    return {
      label: `今日${index + 1}`,
      text: quest?.title || "未設定",
      done: Boolean(quest && isQuestDone(activeDate, quest.id)),
    };
  });
  const weeklyNodes = buildWeeklyQuests(activeDate).map((quest, index) => ({
    label: `週${index + 1}`,
    text: quest.title,
    done: isWeeklyDone(weekKey, quest.id),
  }));
  const reward = getRewardStatus(getGameStats().xp);
  const nodes = [
    ...dailyNodes,
    ...weeklyNodes,
    {
      label: "報酬",
      text: reward.target.title,
      done: reward.allUnlocked,
    },
  ];
  const doneCount = nodes.filter((node) => node.done).length;
  const width = nodes.length > 1 ? Math.round((doneCount / nodes.length) * 100) : 0;

  selectors.questRoad.innerHTML = `
    <div class="road-track" style="--road-progress: ${width}%">
      ${nodes.map((node, index) => `
        <div class="road-node ${node.done ? "is-complete" : ""}">
          <span>${node.done ? "✓" : index + 1}</span>
          <strong>${escapeHtml(node.label)}</strong>
          <em>${escapeHtml(node.text)}</em>
        </div>
      `).join("")}
    </div>
    <p class="road-note">${escapeHtml(`今日の3枠と週クエストを進めるほど、次のご褒美に近づきます。${formatRemainingDays(activeDate)}。`)}</p>
  `;
}

function renderWeeklyReview() {
  const weekKey = getWeekKey(activeDate);
  const question = getWeeklyQuestion(activeDate);
  const review = getWeeklyReview(weekKey);
  selectors.weeklyReviewQuestion.textContent = question;
  selectors.weeklyReviewInput.value = review?.answer || "";
  selectors.weeklyReviewStatus.textContent = review
    ? `保存済み: ${formatDateLabel(review.updatedAt.slice(0, 10))}`
    : "未保存";
}

function saveWeeklyReview() {
  const weekKey = getWeekKey(activeDate);
  const question = getWeeklyQuestion(activeDate);
  const answer = selectors.weeklyReviewInput.value.trim();
  if (!answer) {
    const existing = getWeeklyReview(weekKey);
    if (!existing) {
      selectors.weeklyReviewStatus.textContent = "回答を入力してください。";
      return;
    }
    weeklyReviews = weeklyReviews.filter((review) => review.weekKey !== weekKey);
    saveWeeklyReviews();
    selectors.weeklyReviewStatus.textContent = "回答を削除しました。";
    return;
  }

  const review = normalizeWeeklyReview({
    id: `review-${weekKey}`,
    weekKey,
    question,
    answer,
    updatedAt: new Date().toISOString(),
  });
  weeklyReviews = mergeById(weeklyReviews.filter((item) => item.weekKey !== weekKey), [review]);
  saveWeeklyReviews();
  selectors.weeklyReviewStatus.textContent = "保存しました。Codex用データにも含まれます。";
}

function renderWeekBalance() {
  const weekDates = getWeekDates(activeDate);
  const doneEvents = progress.events.filter((event) => {
    return event.type === "done" && weekDates.includes(event.dateKey);
  });
  const categoryCounts = {};
  doneEvents.forEach((event) => {
    event.categories.forEach((category) => {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
  });
  selectors.weekBalance.innerHTML = "";
  RULES.priorities.forEach((priority) => {
    const row = document.createElement("div");
    row.className = "rule-row";
    row.innerHTML = `<span>${escapeHtml(priority.label)}</span><strong>${categoryCounts[priority.id] || 0}件完了</strong>`;
    selectors.weekBalance.append(row);
  });
}

function getGameStats() {
  const doneEvents = progress.events.filter((event) => event.type === "done");
  const dailyXp = doneEvents.reduce((sum, event) => sum + xpForWeight(event.weight), 0);
  const fullDayBonus = countFullDailyClears(doneEvents) * 15;
  const weeklyXp = Object.values(progress.weeklyChecks).reduce((sum, weekChecks) => {
    return sum + Object.values(weekChecks || {}).filter(Boolean).length * WEEKLY_QUEST_XP;
  }, 0);
  return {
    xp: dailyXp + fullDayBonus + weeklyXp,
    dailyXp,
    fullDayBonus,
    weeklyXp,
  };
}

function xpForWeight(weight) {
  if (weight === "heavy") return 30;
  if (weight === "medium") return 18;
  return 10;
}

function countFullDailyClears(doneEvents) {
  const counts = {};
  doneEvents.forEach((event) => {
    counts[event.dateKey] = (counts[event.dateKey] || 0) + 1;
  });
  return Object.values(counts).filter((count) => count >= RULES.dailyQuestCount).length;
}

function rankTable() {
  return [
    { xp: 0, label: "旅立ち" },
    { xp: 80, label: "継続の芽" },
    { xp: 200, label: "実戦モード" },
    { xp: 360, label: "配信軸づくり" },
    { xp: 560, label: "習慣トレーナー" },
    { xp: 820, label: "チャンピオンロード" },
  ];
}

function getRank(xp) {
  return rankTable().filter((rank) => rank.xp <= xp).pop();
}

function getNextRank(xp) {
  return rankTable().find((rank) => rank.xp > xp) || null;
}

function getUpcomingRanks(xp) {
  return rankTable().filter((rank) => rank.xp > xp).slice(0, 2);
}

function rewardTable() {
  return [
    {
      xp: 40,
      title: "10分だけ一人休憩を確保する",
      detail: "スマホを眺め続ける時間ではなく、何もしない・飲み物を飲む・ぼーっとするための休み時間。",
    },
    {
      xp: 100,
      title: "気になる動画やアニメを1本、ちゃんと楽しむ",
      detail: "目標に直結しなくてもOK。見終わった後に満足感が残るものを選ぶ。",
    },
    {
      xp: 180,
      title: "別ゲームを20分だけ遊ぶ",
      detail: "ポケモンやタスクから少し離れる気分転換枠。延長しすぎないよう短めにする。",
    },
    {
      xp: 280,
      title: "休日の一人時間を30分予約する",
      detail: "取れるかどうかは別として、先に候補枠を作る。家族予定とぶつかるなら別日に移す。",
    },
    {
      xp: 420,
      title: "銭湯に行く予定を立てる",
      detail: "頻度低めの大きめ報酬。無理に当日実行せず、行ける日を決めるだけでも達成扱い。",
    },
    {
      xp: 600,
      title: "半日以内の回復イベントを予約する",
      detail: "銭湯、長めの一人時間、好きな動画時間などから選ぶ。夜食・爆食い・散財は対象外。",
    },
  ];
}

function getRewardStatus(xp) {
  const rewards = rewardTable();
  const unlocked = rewards.filter((reward) => reward.xp <= xp).pop() || null;
  const next = rewards.find((reward) => reward.xp > xp);
  return {
    current: unlocked,
    next,
    target: next || unlocked || rewards[0],
    remaining: next ? next.xp - xp : 0,
    allUnlocked: !next,
  };
}

function getUpcomingRewards(xp) {
  return rewardTable().filter((reward) => reward.xp > xp).slice(0, 2);
}

function surpriseGiftTable() {
  return [
    {
      title: "帰り道か休憩中に、5分だけ静かな寄り道をする",
      detail: "買い物ではなく、空気を入れ替えるだけの報酬。短い一人時間を外側に作る。",
    },
    {
      title: "好きな飲み物を用意して、10分だけスマホを置く",
      detail: "家の飲み物でもOK。節約しながら、休み時間そのものをご褒美にする。",
    },
    {
      title: "新しいゲームの体験版か無料タイトルを20分だけ触る",
      detail: "買わずに試す気分転換。ポケモンやタスクから少し離れるための小さな冒険。",
    },
    {
      title: "アニメを1話、倍速なし・ながら見なしで見る",
      detail: "消化ではなく鑑賞枠。見終わった後に満足感が残る見方にする。",
    },
    {
      title: "風呂上がりに、スマホを開く前の10分を取る",
      detail: "銭湯に行けない日の代替ご褒美。何かを足さず、余白を受け取る。",
    },
    {
      title: "次に行きたい銭湯を1つだけ候補に入れる",
      detail: "すぐ行けなくてもよい。未来の一人時間を少しだけ楽しみに変える。",
    },
    {
      title: "休日の30分を“何をしてもいい枠”として予約する",
      detail: "動画、別ゲーム、散歩、銭湯準備のどれでもOK。成果物を求めない。",
    },
  ];
}

function getSurpriseGift(xp, dateKey) {
  const gifts = surpriseGiftTable();
  const seed = Math.abs(seededJitter(`gift-${Math.floor(xp / 40)}`, dateKey)) + Math.floor(xp / 40);
  return gifts[seed % gifts.length];
}

function gameTips() {
  return [
    { label: "判定", text: "入れ替えは失敗ではなく作戦変更。" },
    { label: "報酬", text: "目的を逆に押すご褒美は選ばない。" },
    { label: "復帰", text: "連続記録より、戻ってきた日を強く見る。" },
  ];
}

function renderSchedule() {
  const monthStart = startOfMonth(scheduleCursor);
  const firstVisible = addDays(monthStart, -monthStart.getDay());
  selectors.scheduleMonthLabel.textContent = `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月`;
  selectors.scheduleCalendar.innerHTML = "";

  Array.from({ length: 42 }, (_, index) => addDays(firstVisible, index)).forEach((date) => {
    const dateKey = formatDate(date);
    const inMonth = isSameMonth(date, monthStart);
    const cell = document.createElement("div");
    cell.className = [
      "calendar-cell",
      inMonth ? "" : "is-muted",
      dateKey === todayKey() ? "is-today" : "",
      dateKey === activeDate ? "is-active-day" : "",
    ].filter(Boolean).join(" ");

    const dateButton = document.createElement("button");
    dateButton.className = "calendar-date";
    dateButton.type = "button";
    dateButton.innerHTML = `<strong>${date.getDate()}</strong><span>${DAY_NAMES[date.getDay()]}</span>`;
    dateButton.addEventListener("click", () => {
      activeDate = dateKey;
      selectors.planDate.value = dateKey;
      scheduleCursor = startOfMonth(parseDate(dateKey));
      renderAll();
    });

    const select = document.createElement("select");
    select.className = "calendar-select";
    Object.entries(RULES.dayTypes).forEach(([id, dayType]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = dayType.label;
      select.append(option);
    });
    select.value = getDayType(dateKey);
    select.disabled = !inMonth;
    select.addEventListener("change", () => {
      setDayType(dateKey, select.value);
      resetDailyPlan(dateKey);
      renderAll();
    });

    cell.append(dateButton, select);
    selectors.scheduleCalendar.append(cell);
  });

  selectors.dayTypeLegend.innerHTML = "";
  Object.entries(RULES.dayTypes).forEach(([, dayType]) => {
    const row = document.createElement("div");
    row.className = "rule-row";
    row.innerHTML = `<span>${escapeHtml(dayType.label)}</span><strong>${escapeHtml(dayType.note)}</strong>`;
    selectors.dayTypeLegend.append(row);
  });
}

function renderForge() {
  renderQuestTuningList();
  renderWeeklyTuningList();
  renderCustomQuestList();
  renderRemoveQuestOptions();
  renderRemovedQuestList();
}

function renderQuestTuningList() {
  selectors.questTuningList.innerHTML = "";
  const quests = getRawQuestPool();
  if (!quests.length) {
    selectors.questTuningList.append(emptyState("調整できるクエストはまだありません", "標準候補や追加候補がここに並びます。"));
    return;
  }

  const suppressed = suppressedQuestIds();
  quests.forEach((quest) => {
    const card = document.createElement("article");
    card.className = `custom-card tuning-card ${quest.tuningId ? "is-tuned" : ""}`;
    const source = sourceLabel({ source: quest.source }) || "標準候補";
    const removed = suppressed.includes(quest.id);
    card.innerHTML = `
      <details ${quest.tuningId ? "open" : ""}>
        <summary>
          <span>${escapeHtml(quest.title)}</span>
          <small>${escapeHtml(formatCategories(quest.categories))} / ${escapeHtml(RULES.weightLabels[quest.weight] || quest.weight)} / ${quest.minutes}分 / +${xpForWeight(quest.weight)} EXP</small>
        </summary>
        <div class="quest-meta">
          <span>${escapeHtml(source)}</span>
          <span>${escapeHtml(frequencyLabels()[quest.frequency] || quest.frequency)}</span>
          ${removed ? "<span>除外中</span>" : ""}
          ${quest.tuningId ? "<span>調整済み</span>" : ""}
        </div>
        <div class="quest-detail is-open">
          ${createQuestDetailHtml(quest, activeDate)}
        </div>
      </details>
    `;
    selectors.questTuningList.append(card);
  });
}

function renderWeeklyTuningList() {
  selectors.weeklyTuningList.innerHTML = "";
  getBaseWeeklyQuestPool().map(applyWeeklyTuning).forEach((quest) => {
    const card = document.createElement("article");
    card.className = `custom-card tuning-card weekly-tuning-card ${quest.tuningId ? "is-tuned" : ""}`;
    const isCurrent = buildBaseWeeklyQuests(activeDate).some((item) => item.id === quest.id);
    card.innerHTML = `
      <details ${quest.tuningId || isCurrent ? "open" : ""}>
        <summary>
          <span>${escapeHtml(quest.title)}</span>
          <small>${escapeHtml(weeklyWeightLabels()[quest.weeklyWeight || "medium"])} / +${WEEKLY_QUEST_XP} EXP / ${isCurrent ? "今週表示中" : "候補"}</small>
        </summary>
        <div class="quest-meta">
          <span>週クエスト</span>
          <span>${escapeHtml(weeklyWeightLabels()[quest.weeklyWeight || "medium"])}</span>
          ${isCurrent ? "<span>今週</span>" : ""}
          ${quest.tuningId ? "<span>調整済み</span>" : ""}
        </div>
        <div class="quest-detail is-open">
          ${createWeeklyDetailHtml(quest, activeDate)}
        </div>
      </details>
    `;
    selectors.weeklyTuningList.append(card);
  });
}

function renderCustomQuestList() {
  selectors.customQuestList.innerHTML = "";
  if (!customQuests.length) {
    selectors.customQuestList.append(emptyState("追加候補はまだありません", "ここにアプリで追加したクエストが並びます。"));
    return;
  }

  customQuests.forEach((quest) => {
    const card = document.createElement("article");
    card.className = "custom-card";
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(quest.title)}</h3>
        <div class="quest-meta">
          <span>${escapeHtml(formatCategories(quest.categories))}</span>
          <span>${escapeHtml(RULES.weightLabels[quest.weight] || quest.weight)}</span>
          <span>+${xpForWeight(quest.weight)} EXP</span>
          <span>${quest.minutes}分</span>
          <span>${escapeHtml(sourceLabel(quest) || "アプリ追加")}</span>
        </div>
        <p>${escapeHtml(quest.detail)}</p>
      </div>
      <div class="custom-card-actions">
        <button class="small-button" type="button" data-delete-custom="${escapeHtml(quest.id)}">削除</button>
      </div>
    `;
    selectors.customQuestList.append(card);
  });
}

function renderRemoveQuestOptions() {
  selectors.removeQuestSelect.innerHTML = "";
  const activeQuests = getQuestPool();
  if (!activeQuests.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "除外できる候補がありません";
    selectors.removeQuestSelect.append(option);
    selectors.removeQuestSelect.disabled = true;
    return;
  }

  selectors.removeQuestSelect.disabled = false;
  activeQuests.forEach((quest) => {
    const option = document.createElement("option");
    option.value = quest.id;
    option.textContent = `${quest.title} / ${formatCategories(quest.categories)}`;
    selectors.removeQuestSelect.append(option);
  });
}

function renderRemovedQuestList() {
  selectors.removedQuestList.innerHTML = "";
  const removed = activeQuestFeedback();
  if (!removed.length) {
    selectors.removedQuestList.append(emptyState("除外中のクエストはありません", "出したくない候補が出てきたら、理由ごと残せます。"));
    return;
  }

  removed.forEach((feedback) => {
    const card = document.createElement("article");
    card.className = "custom-card is-removed";
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(feedback.title)}</h3>
        <div class="quest-meta">
          <span>${escapeHtml(feedback.source === "rules" ? "標準候補" : sourceLabel({ source: feedback.source }) || "追加候補")}</span>
          <span>${escapeHtml(feedback.createdAt.slice(0, 10))}</span>
        </div>
        <p>${escapeHtml(feedback.reason)}</p>
      </div>
      <div class="custom-card-actions">
        <button class="small-button" type="button" data-restore-feedback="${escapeHtml(feedback.id)}">復帰</button>
      </div>
    `;
    selectors.removedQuestList.append(card);
  });
}

function renderRules() {
  selectors.rulesOverview.innerHTML = "";
  [
    ...RULES.generationRules,
    "ウィークリー期間は火曜日から月曜日。月曜日を1週間の締め日として扱う。",
    "アプリで追加したクエスト候補は別保存し、標準候補と一緒に抽選対象にする。",
    "除外フィードバックは別保存し、理由を残したまま抽選対象から外す。",
    "EXPとご褒美は完了履歴から自動計算する。ポイント入力欄は増やさない。",
    "ご褒美は目的を逆に押さないものだけにする。食事制限中の外食報酬のような逆効果は避ける。",
    "称号とご褒美は現在地、次の目標、少し先の予告だけを見せる。全部を隠しすぎず、ゲーム感も残す。",
    "ご褒美は目標直結に限らず、本人が喜ぶものも含める。ただし目的を逆に押すものは避ける。",
    "ご褒美は一人時間、休み時間、銭湯、別ゲーム、動画/アニメを中心にする。夜食、爆食い、散財、追加タスク感の強いものは避ける。",
    "本人が思いつかないご褒美として、日付とEXPに応じたCodexからの贈り物を1つ表示する。合わないものは次回調整で外す。",
    "Codex用データには追加候補、除外理由、連携メモ、予定変更、直近履歴を含める。",
  ].forEach((rule) => {
    const row = document.createElement("div");
    row.className = "rule-row";
    row.innerHTML = `<span>Rule</span><strong>${escapeHtml(rule)}</strong>`;
    selectors.rulesOverview.append(row);
  });

  selectors.questPool.innerHTML = "";
  getQuestPool().forEach((quest) => {
    const card = document.createElement("article");
    card.className = "pool-card";
    card.innerHTML = `
      <h3>${escapeHtml(quest.title)}</h3>
      <div class="quest-meta">
        <span>${escapeHtml(formatCategories(quest.categories))}</span>
        <span>${escapeHtml(RULES.weightLabels[quest.weight] || quest.weight)}</span>
        <span>+${xpForWeight(quest.weight)} EXP</span>
        <span>${quest.minutes}分</span>
        ${sourceLabel(quest) ? `<span>${escapeHtml(sourceLabel(quest))}</span>` : ""}
      </div>
      <p>${escapeHtml(quest.detail)}</p>
    `;
    selectors.questPool.append(card);
  });
}

function renderHistory() {
  const doneEvents = progress.events.filter((event) => event.type === "done");
  const rerollEvents = progress.events.filter((event) => event.type === "reroll");
  const weekDone = doneEvents.filter((event) => getWeekDates(activeDate).includes(event.dateKey));
  const stats = getGameStats();
  selectors.historyStats.innerHTML = "";
  [
    ["総EXP", `${stats.xp} EXP`],
    ["総完了", `${doneEvents.length}件`],
    ["今週完了", `${weekDone.length}件`],
    ["入れ替え", `${rerollEvents.length}回`],
    ["週クエスト", `${Object.values(progress.weeklyChecks[getWeekKey(activeDate)] || {}).filter(Boolean).length}/3`],
  ].forEach(([label, value]) => {
    const metric = document.createElement("div");
    metric.className = "metric";
    metric.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    selectors.historyStats.append(metric);
  });

  selectors.historyLog.innerHTML = "";
  selectors.historyLog.append(
    createHistorySection("完了履歴", "EXP対象", doneEvents, "完了", "完了したクエストだけがここに残ります。"),
    createHistorySection("入れ替え履歴", "EXP対象外", rerollEvents, "入替", "入れ替えた候補は完了扱いにしません。"),
  );
}

function createHistorySection(title, badge, events, eventLabel, emptyBody) {
  const section = document.createElement("section");
  section.className = "history-section";
  section.innerHTML = `
    <div class="history-section-heading">
      <h3>${escapeHtml(title)}</h3>
      <span>${escapeHtml(badge)}</span>
    </div>
  `;
  const list = document.createElement("div");
  list.className = "history-section-list";
  const sorted = events
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  if (!sorted.length) {
    list.append(emptyState(title === "完了履歴" ? "完了履歴はまだありません" : "入れ替え履歴はまだありません", emptyBody));
  } else {
    sorted.forEach((event) => {
      const row = document.createElement("div");
      row.className = `history-row ${event.type}`;
      row.innerHTML = `
        <span>${escapeHtml(event.dateKey)}</span>
        <strong>${escapeHtml(event.title)}</strong>
        <em>${escapeHtml(eventLabel)}</em>
      `;
      list.append(row);
    });
  }
  section.append(list);
  return section;
}

function handleQuestFormSubmit(event) {
  event.preventDefault();
  const title = selectors.customTitle.value.trim();
  const categories = checkedValues("custom-category");
  const dayFit = checkedValues("custom-dayfit");
  if (!title) {
    showForgeMessage("タイトルを入力してください。");
    return;
  }
  if (!categories.length) {
    showForgeMessage("分類を1つ以上選んでください。");
    return;
  }
  if (!dayFit.length) {
    showForgeMessage("出してよい日を1つ以上選んでください。");
    return;
  }

  const quest = normalizeCustomQuest({
    id: createCustomQuestId(),
    title,
    categories,
    weight: selectors.customWeight.value,
    minutes: Number(selectors.customMinutes.value),
    frequency: selectors.customFrequency.value,
    dayFit,
    detail: selectors.customDetail.value.trim() || "アプリで追加したクエスト候補。",
    source: "app",
    sourceNote: selectors.customSourceNote.value.trim(),
    createdAt: new Date().toISOString(),
  });

  customQuests = upsertCustomQuest(quest, customQuests);
  saveCustomQuests();
  resetQuestForm();
  showForgeMessage("候補に追加しました。");
  renderAll();
}

function resetQuestForm() {
  selectors.questForm.reset();
  selectors.customMinutes.value = "10";
  showForgeMessage("");
}

function deleteCustomQuest(questId) {
  customQuests = customQuests.filter((quest) => quest.id !== questId);
  questFeedback = questFeedback.filter((feedback) => feedback.questId !== questId);
  questTuning = questTuning.filter((tuning) => tuning.questId !== questId);
  Object.values(progress.dailyPlans).forEach((plan) => {
    plan.questIds = plan.questIds.filter((id) => id !== questId);
    plan.rerolledIds = (plan.rerolledIds || []).filter((id) => id !== questId);
  });
  saveCustomQuests();
  saveQuestFeedback();
  saveQuestTuning();
  saveProgress();
  showForgeMessage("追加候補を削除しました。");
  renderAll();
}

function handleQuestTuningSubmit(event) {
  event.preventDefault();
  const form = event.target.closest(".tuning-form") || event.currentTarget;
  const questId = form.dataset.questId;
  const baseQuest = findBaseQuest(questId);
  if (!baseQuest) return;

  const weight = WEIGHT_IDS.includes(form.elements.weight.value) ? form.elements.weight.value : baseQuest.weight;
  const frequency = FREQUENCY_IDS.includes(form.elements.frequency.value)
    ? form.elements.frequency.value
    : baseQuest.frequency;
  const minutes = clampNumber(Number(form.elements.minutes.value) || baseQuest.minutes, 1, 180);
  const detail = form.elements.detail.value.trim() || baseQuest.detail;
  const reason = form.elements.reason.value.trim() || "詳細画面から調整";

  const unchanged = weight === baseQuest.weight
    && frequency === baseQuest.frequency
    && minutes === baseQuest.minutes
    && detail === baseQuest.detail;
  questTuning = questTuning.filter((tuning) => tuning.questId !== questId);

  if (!unchanged) {
    questTuning.unshift({
      id: `tune-${Date.now()}`,
      questId,
      title: baseQuest.title,
      source: baseQuest.source || "rules",
      weight,
      minutes,
      frequency,
      detail,
      reason,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  saveQuestTuning();
  showForgeMessage(unchanged ? "調整を解除しました。" : "クエスト調整を保存しました。");
  renderAll();
}

function handleWeeklyTuningSubmit(event) {
  event.preventDefault();
  const form = event.target.closest(".weekly-tuning-form") || event.currentTarget;
  const weeklyId = form.dataset.weeklyId;
  const baseQuest = findBaseWeeklyQuest(weeklyId);
  if (!baseQuest) return;

  const title = form.elements.title.value.trim() || baseQuest.title;
  const weeklyWeight = WEEKLY_WEIGHT_IDS.includes(form.elements.weeklyWeight.value)
    ? form.elements.weeklyWeight.value
    : baseQuest.weeklyWeight || "medium";
  const detail = form.elements.detail.value.trim() || baseQuest.detail;
  const note = form.elements.note.value.trim();
  const reason = form.elements.reason.value.trim() || "週クエスト詳細から調整";

  const unchanged = title === baseQuest.title
    && weeklyWeight === (baseQuest.weeklyWeight || "medium")
    && detail === baseQuest.detail
    && !note;
  weeklyTuning = weeklyTuning.filter((tuning) => tuning.weeklyId !== weeklyId);

  if (!unchanged) {
    weeklyTuning.unshift({
      id: `weekly-tune-${weeklyId}`,
      weeklyId,
      title,
      weeklyWeight,
      detail,
      note,
      reason,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  saveWeeklyTuning();
  showForgeMessage(unchanged ? "週クエスト調整を解除しました。" : "週クエスト調整を保存しました。");
  renderAll();
}

function handleRemoveQuestSubmit(event) {
  event.preventDefault();
  const questId = selectors.removeQuestSelect.value;
  const quest = findQuest(questId);
  const reason = selectors.removeQuestReason.value.trim();
  if (!quest) {
    showForgeMessage("除外するクエストを選んでください。");
    return;
  }
  if (!reason) {
    showForgeMessage("理由を入力してください。");
    return;
  }

  questFeedback = questFeedback.filter((feedback) => feedback.questId !== questId);
  questFeedback.unshift({
    id: `remove-${Date.now()}`,
    action: "remove",
    active: true,
    questId,
    title: quest.title,
    source: quest.source || "rules",
    reason,
    createdAt: new Date().toISOString(),
  });
  selectors.removeQuestReason.value = "";
  removeQuestFromPlans(questId);
  saveQuestFeedback();
  saveProgress();
  showForgeMessage("除外候補にしました。");
  renderAll();
}

function restoreQuestFeedback(feedbackId) {
  const target = questFeedback.find((feedback) => feedback.id === feedbackId);
  questFeedback = questFeedback.map((feedback) => {
    if (feedback.id !== feedbackId) return feedback;
    return {
      ...feedback,
      active: false,
      restoredAt: new Date().toISOString(),
    };
  });
  if (target) {
    Object.values(progress.dailyPlans).forEach((plan) => {
      plan.rerolledIds = (plan.rerolledIds || []).filter((id) => id !== target.questId);
    });
  }
  saveQuestFeedback();
  saveProgress();
  showForgeMessage("除外を解除しました。");
  renderAll();
}

function removeQuestFromPlans(questId) {
  Object.values(progress.dailyPlans).forEach((plan) => {
    plan.questIds = plan.questIds.filter((id) => id !== questId);
    plan.rerolledIds = [...new Set([...(plan.rerolledIds || []), questId])];
  });
}

function saveCodexNote() {
  const text = selectors.codexNoteInput.value.trim();
  if (!text) {
    showForgeMessage("メモを入力してください。");
    return;
  }
  questInbox.unshift({
    id: `note-${Date.now()}`,
    text,
    createdAt: new Date().toISOString(),
  });
  questInbox = questInbox.slice(0, 30);
  saveQuestInbox();
  selectors.codexNoteInput.value = "";
  showForgeMessage("Codex向けメモを保存しました。");
  renderAll();
}

function exportCodexPayload() {
  const plan = ensureDailyPlan(activeDate);
  const payload = {
    exportedAt: new Date().toISOString(),
    rulesVersion: RULES.version,
    activeDate,
    activeDayType: getDayType(activeDate),
    categories: RULES.categoryLabels,
    weights: RULES.weightLabels,
    dayTypes: Object.fromEntries(Object.entries(RULES.dayTypes).map(([id, dayType]) => {
      return [id, { label: dayType.label, note: dayType.note }];
    })),
    priorities: RULES.priorities,
    currentDailyQuests: plan.questIds.map(findQuest).filter(Boolean).map(slimQuestForExport),
    currentWeeklyQuests: buildWeeklyQuests(activeDate).map(slimWeeklyQuestForExport),
    currentWeeklyQuestion: {
      weekKey: getWeekKey(activeDate),
      question: getWeeklyQuestion(activeDate),
      answer: getWeeklyReview(getWeekKey(activeDate))?.answer || "",
    },
    customQuests,
    questInbox,
    questFeedback,
    questTuning,
    weeklyTuning,
    weeklyReviews,
    suppressedQuestIds: suppressedQuestIds(),
    scheduleOverrides: schedule.overrides,
    recentEvents: progress.events.slice(-24),
  };
  selectors.codexDataOutput.value = JSON.stringify(payload, null, 2);
  selectors.codexDataOutput.select();
  showForgeMessage("Codex用データを作成しました。");
}

function importCodexPayload() {
  let parsed;
  try {
    parsed = JSON.parse(selectors.codexImportInput.value);
  } catch (error) {
    showForgeMessage("JSONを読み取れませんでした。");
    return;
  }

  const imported = collectImportedQuests(parsed);
  const importedFeedback = collectImportedFeedback(parsed);
  const importedTuning = collectImportedTuning(parsed);
  const importedWeeklyTuning = collectImportedWeeklyTuning(parsed);
  if (!imported.length && !importedFeedback.length && !importedTuning.length && !importedWeeklyTuning.length) {
    showForgeMessage("取り込める内容が見つかりません。");
    return;
  }

  const normalized = imported
    .map((quest) => normalizeCustomQuest({ ...quest, source: quest.source || "codex" }))
    .filter(Boolean);
  normalized.forEach((quest) => {
    customQuests = upsertCustomQuest(quest, customQuests);
  });
  const normalizedFeedback = importedFeedback.map(normalizeImportedFeedback).filter(Boolean);
  normalizedFeedback.forEach((feedback) => {
    questFeedback = questFeedback.filter((item) => item.questId !== feedback.questId);
    questFeedback.unshift(feedback);
    removeQuestFromPlans(feedback.questId);
  });
  const normalizedTuning = importedTuning.map(normalizeImportedTuning).filter(Boolean);
  normalizedTuning.forEach((tuning) => {
    questTuning = questTuning.filter((item) => item.questId !== tuning.questId);
    questTuning.unshift(tuning);
  });
  const normalizedWeeklyTuning = importedWeeklyTuning.map(normalizeWeeklyTuning).filter(Boolean);
  normalizedWeeklyTuning.forEach((tuning) => {
    weeklyTuning = weeklyTuning.filter((item) => item.weeklyId !== tuning.weeklyId);
    weeklyTuning.unshift(tuning);
  });
  saveCustomQuests();
  saveQuestFeedback();
  saveQuestTuning();
  saveWeeklyTuning();
  saveProgress();
  selectors.codexImportInput.value = "";
  showForgeMessage(`${normalized.length + normalizedFeedback.length + normalizedTuning.length + normalizedWeeklyTuning.length}件取り込みました。`);
  renderAll();
}

function exportProgressBackup() {
  selectors.dataOutput.readOnly = false;
  selectors.dataOutput.value = JSON.stringify(collectPersistentState(), null, 2);
  selectors.dataOutput.select();
  flashButton(selectors.exportProgress, "作成済み");
}

function importProgressBackup() {
  let parsed;
  try {
    parsed = JSON.parse(selectors.dataOutput.value);
  } catch (error) {
    flashButton(selectors.importProgress, "JSONエラー");
    return;
  }

  const state = parsed?.state || parsed;
  const merged = mergePersistentStates(collectPersistentState(), normalizePersistentState(state));
  applyPersistentState(merged);
  savePersistentStateLocally();
  scheduleServerBackup();
  renderAll();
  selectors.dataOutput.readOnly = false;
  selectors.dataOutput.value = JSON.stringify(collectPersistentState(), null, 2);
  flashButton(selectors.importProgress, "取り込み済み");
}

function flashButton(button, text) {
  const original = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1600);
}

function createTravelMemo() {
  const text = createTravelMemoText(activeDate);
  selectors.travelMemo.value = text;
  selectors.travelMemo.select();

  const copied = tryCopyText(text);
  selectors.createTravelMemo.textContent = copied ? "コピー済み" : "メモ作成済み";
  window.setTimeout(() => {
    selectors.createTravelMemo.textContent = "今日の持ち出しメモ作成";
  }, 1600);
}

function createTravelMemoText(dateKey) {
  const plan = ensureDailyPlan(dateKey);
  const dayType = RULES.dayTypes[getDayType(dateKey)];
  const dailyQuests = plan.questIds.map(findQuest).filter(Boolean);
  const weekKey = getWeekKey(dateKey);
  const weeklyQuests = buildWeeklyQuests(dateKey);
  const stats = getGameStats();
  const rank = getRank(stats.xp);
  const reward = getRewardStatus(stats.xp);

  const lines = [
    `Daily Compass ${formatDateLabel(dateKey)}`,
    `日タイプ: ${dayType.label}`,
    "",
    "今日のクエスト",
    ...dailyQuests.map((quest) => {
      const mark = isQuestDone(dateKey, quest.id) ? "x" : " ";
      return `[${mark}] ${quest.title} / +${xpForWeight(quest.weight)} EXP / ${quest.minutes}分 / ${formatCategories(quest.categories)}`;
    }),
    "",
    `今週のクエスト ${formatWeekRange(dateKey)} ${formatRemainingDays(dateKey)}`,
    ...weeklyQuests.map((quest) => {
      const mark = isWeeklyDone(weekKey, quest.id) ? "x" : " ";
      return `[${mark}] ${quest.title} / +${WEEKLY_QUEST_XP} EXP`;
    }),
    "",
    `現在: ${rank.label} / ${stats.xp} EXP`,
    `次のご褒美: ${reward.target.title}${reward.next ? ` / あと${reward.remaining} EXP` : ""}`,
  ];

  return lines.join("\n");
}

function tryCopyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }

  try {
    return document.execCommand("copy");
  } catch (error) {
    return false;
  }
}

function collectImportedQuests(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const quests = [];
  if (value.quest) quests.push(value.quest);
  if (Array.isArray(value.quests)) quests.push(...value.quests);
  if (Array.isArray(value.customQuests)) quests.push(...value.customQuests);
  return quests;
}

function collectImportedFeedback(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const feedback = [];
  if (Array.isArray(value.questFeedback)) feedback.push(...value.questFeedback);
  if (Array.isArray(value.removeQuests)) feedback.push(...value.removeQuests);
  if (Array.isArray(value.suppressedQuests)) feedback.push(...value.suppressedQuests);
  return feedback;
}

function collectImportedTuning(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const tuning = [];
  if (Array.isArray(value.questTuning)) tuning.push(...value.questTuning);
  if (Array.isArray(value.questAdjustments)) tuning.push(...value.questAdjustments);
  if (Array.isArray(value.tuneQuests)) tuning.push(...value.tuneQuests);
  return tuning;
}

function collectImportedWeeklyTuning(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const tuning = [];
  if (Array.isArray(value.weeklyTuning)) tuning.push(...value.weeklyTuning);
  if (Array.isArray(value.weeklyQuestTuning)) tuning.push(...value.weeklyQuestTuning);
  if (Array.isArray(value.weeklyQuestAdjustments)) tuning.push(...value.weeklyQuestAdjustments);
  return tuning;
}

function normalizeImportedFeedback(value) {
  if (!value || typeof value !== "object") return null;
  const questId = String(value.questId || value.id || "").trim();
  const quest = findAnyQuest(questId);
  const reason = String(value.reason || value.note || "").trim();
  if (!quest || !reason) return null;
  return {
    id: `remove-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action: "remove",
    active: true,
    questId,
    title: quest.title,
    source: quest.source || "rules",
    reason,
    createdAt: new Date().toISOString(),
  };
}

function normalizeImportedTuning(value) {
  if (!value || typeof value !== "object") return null;
  const questId = String(value.questId || value.id || "").trim();
  const baseQuest = findBaseQuest(questId);
  if (!baseQuest) return null;
  const weight = WEIGHT_IDS.includes(value.weight) ? value.weight : baseQuest.weight;
  const frequency = FREQUENCY_IDS.includes(value.frequency) ? value.frequency : baseQuest.frequency;
  const minutes = clampNumber(Number(value.minutes) || baseQuest.minutes, 1, 180);
  const detail = String(value.detail || baseQuest.detail).trim() || baseQuest.detail;
  const reason = String(value.reason || value.note || "Codexから調整").trim();
  const unchanged = weight === baseQuest.weight
    && frequency === baseQuest.frequency
    && minutes === baseQuest.minutes
    && detail === baseQuest.detail;
  if (unchanged) return null;
  return {
    id: `tune-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    questId,
    title: baseQuest.title,
    source: baseQuest.source || "rules",
    weight,
    minutes,
    frequency,
    detail,
    reason,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeWeeklyTuning(value) {
  if (!value || typeof value !== "object") return null;
  const weeklyId = String(value.weeklyId || value.questId || value.id || "").trim();
  const baseQuest = findBaseWeeklyQuest(weeklyId);
  if (!baseQuest) return null;
  const weeklyWeight = WEEKLY_WEIGHT_IDS.includes(value.weeklyWeight || value.weight)
    ? value.weeklyWeight || value.weight
    : baseQuest.weeklyWeight || "medium";
  const title = String(value.title || baseQuest.title).trim() || baseQuest.title;
  const detail = String(value.detail || baseQuest.detail).trim() || baseQuest.detail;
  const note = String(value.note || value.memo || "").trim();
  const reason = String(value.reason || "Codexから週クエスト調整").trim();
  return {
    id: `weekly-tune-${weeklyId}`,
    weeklyId,
    title,
    weeklyWeight,
    detail,
    note,
    reason,
    createdAt: value.createdAt || new Date().toISOString(),
    updatedAt: value.updatedAt || value.createdAt || new Date().toISOString(),
  };
}

function normalizeWeeklyReview(value) {
  if (!value || typeof value !== "object") return null;
  const weekKey = String(value.weekKey || "").trim();
  const answer = String(value.answer || "").trim();
  if (!weekKey || !answer) return null;
  return {
    id: String(value.id || `review-${weekKey}`),
    weekKey,
    question: String(value.question || getWeeklyQuestion(weekKey)).trim(),
    answer,
    updatedAt: value.updatedAt || value.createdAt || new Date().toISOString(),
  };
}

function normalizeCustomQuest(value) {
  if (!value || typeof value !== "object") return null;
  const title = String(value.title || "").trim();
  if (!title) return null;
  const categories = normalizeCategoryList(value.categories);
  const dayFit = normalizeDayFit(value.dayFit);
  const weight = WEIGHT_IDS.includes(value.weight) ? value.weight : "light";
  const frequency = FREQUENCY_IDS.includes(value.frequency) ? value.frequency : "medium";
  const minutes = clampNumber(Number(value.minutes) || 10, 1, 180);
  const id = normalizeCustomId(value.id, title);
  return {
    id,
    title,
    categories,
    weight,
    minutes,
    frequency,
    dayFit,
    detail: String(value.detail || "追加したクエスト候補。").trim(),
    source: value.source === "codex" ? "codex" : "app",
    sourceNote: String(value.sourceNote || "").trim(),
    createdAt: value.createdAt || new Date().toISOString(),
  };
}

function normalizeCategoryList(categories) {
  const ids = Array.isArray(categories) ? categories : [categories];
  const normalized = ids
    .map((id) => String(id || "").trim())
    .filter((id) => RULES.categoryLabels[id]);
  return normalized.length ? [...new Set(normalized)] : ["pokemon"];
}

function normalizeDayFit(dayFit) {
  const ids = Array.isArray(dayFit) ? dayFit : Object.keys(RULES.dayTypes);
  const normalized = ids
    .map((id) => String(id || "").trim())
    .filter((id) => RULES.dayTypes[id]);
  return normalized.length ? [...new Set(normalized)] : Object.keys(RULES.dayTypes);
}

function normalizeCustomId(id, title) {
  const raw = String(id || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!raw || RULES.quests.some((quest) => quest.id === raw)) return createCustomQuestId(title);
  if (raw.startsWith("custom-") || raw.startsWith("codex-")) return raw;
  return `custom-${raw}`;
}

function createCustomQuestId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function upsertCustomQuest(quest, list) {
  const next = list.filter((item) => item.id !== quest.id);
  next.unshift(quest);
  return next;
}

function showForgeMessage(message) {
  selectors.forgeMessage.textContent = message;
}

function checkedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function slimQuestForExport(quest) {
  return {
    id: quest.id,
    title: quest.title,
    categories: quest.categories,
    weight: quest.weight,
    minutes: quest.minutes,
    frequency: quest.frequency,
    source: quest.source || "rules",
    tuning: quest.tuningId ? {
      reason: quest.tuningReason,
      tunedAt: quest.tunedAt,
    } : null,
  };
}

function slimWeeklyQuestForExport(quest) {
  return {
    id: quest.id,
    title: quest.title,
    detail: quest.detail,
    weeklyWeight: quest.weeklyWeight || "medium",
    xp: WEEKLY_QUEST_XP,
    tuning: quest.tuningId ? {
      reason: quest.tuningReason,
      note: quest.tuningNote,
      tunedAt: quest.tunedAt,
    } : null,
  };
}

function ensureDailyPlan(dateKey) {
  const existing = progress.dailyPlans[dateKey];
  if (existing) {
    if (shouldRebuildDailyPlan(existing, dateKey)) {
      delete progress.dailyPlans[dateKey];
      const questIds = fillQuestIds(dateKey, [], []);
      progress.dailyPlans[dateKey] = {
        dateKey,
        questIds,
        rerolledIds: [],
        ruleVersion: DAILY_PLAN_RULE_VERSION,
        createdAt: existing.createdAt || new Date().toISOString(),
        rebuiltAt: new Date().toISOString(),
      };
      saveProgress();
      return progress.dailyPlans[dateKey];
    }
    const validIds = existing.questIds.filter((questId) => findQuest(questId));
    existing.questIds = fillQuestIds(dateKey, validIds, existing.rerolledIds || []);
    existing.rerolledIds = existing.rerolledIds || [];
    existing.ruleVersion = existing.ruleVersion || 1;
    saveProgress();
    return existing;
  }

  const questIds = fillQuestIds(dateKey, [], []);
  progress.dailyPlans[dateKey] = {
    dateKey,
    questIds,
    rerolledIds: [],
    ruleVersion: DAILY_PLAN_RULE_VERSION,
    createdAt: new Date().toISOString(),
  };
  saveProgress();
  return progress.dailyPlans[dateKey];
}

function shouldRebuildDailyPlan(plan, dateKey) {
  if ((plan.ruleVersion || 1) >= DAILY_PLAN_RULE_VERSION) return false;
  if (getDateEvents(dateKey).length) return false;
  const quests = (plan.questIds || []).map(findQuest).filter(Boolean);
  if (!quests.length) return true;
  const hasPokemon = quests.some((quest) => quest.categories.includes("pokemon"));
  const hasYoutube = quests.some((quest) => quest.categories.includes("youtube"));
  const hasSupport = quests.some((quest) => quest.categories.some((category) => ["diet", "ai", "recovery"].includes(category)));
  return !hasPokemon || !hasYoutube || !hasSupport;
}

function fillQuestIds(dateKey, currentIds, blockedIds) {
  const dayType = RULES.dayTypes[getDayType(dateKey)];
  const ids = [...new Set(currentIds)].slice(0, RULES.dailyQuestCount);
  const slots = dayType.slots || ["pokemon", "youtube", "support"];
  let slotIndex = 0;
  while (ids.length < RULES.dailyQuestCount) {
    const slot = slots[slotIndex % slots.length];
    const candidate = chooseQuest(dateKey, slot, [...ids, ...blockedIds]);
    if (!candidate) break;
    ids.push(candidate.id);
    slotIndex += 1;
  }
  return ids;
}

function chooseQuest(dateKey, slot, excludeIds, randomize = false) {
  const pool = getQuestPool()
    .filter((quest) => !excludeIds.includes(quest.id))
    .filter((quest) => isQuestAllowed(quest, dateKey, excludeIds));
  let candidates = pool
    .filter((quest) => matchesSlot(quest, slot))
    .map((quest) => ({ quest, score: scoreQuest(quest, dateKey, slot) }))
    .sort((a, b) => b.score - a.score);
  if (!candidates.length && slot !== "reroll") {
    candidates = pool
      .map((quest) => ({ quest, score: scoreQuest(quest, dateKey, "fallback") }))
      .sort((a, b) => b.score - a.score);
  }
  if (!candidates.length) return null;
  if (!randomize) return candidates[0].quest;
  const top = candidates.slice(0, Math.min(5, candidates.length));
  return top[Math.floor(Math.random() * top.length)].quest;
}

function matchesSlot(quest, slot) {
  if (slot === "support") {
    return quest.categories.some((category) => ["diet", "ai", "recovery"].includes(category));
  }
  if (slot === "pokemon" || slot === "youtube") {
    return quest.categories.includes(slot);
  }
  return true;
}

function isQuestAllowed(quest, dateKey, currentIds = []) {
  const dayTypeId = getDayType(dateKey);
  if (!quest.dayFit.includes(dayTypeId)) return false;
  if (isQuestDone(dateKey, quest.id)) return false;
  if (getDateEvents(dateKey, "reroll").some((event) => event.questId === quest.id)) return false;

  const dayType = RULES.dayTypes[dayTypeId];
  const plan = progress.dailyPlans[dateKey];
  const currentHeavy = [...new Set([...(plan?.questIds || []), ...currentIds])]
    .map(findQuest)
    .filter((item) => item?.weight === "heavy").length;
  if (quest.weight === "heavy" && currentHeavy >= dayType.heavyLimit) return false;

  if (quest.cooldownDays) {
    const lastDone = lastEventForQuest(quest.id, "done", dateKey);
    if (lastDone && daysBetween(lastDone.dateKey, dateKey) < quest.cooldownDays) return false;
    const lastShown = lastShownDate(quest.id, dateKey);
    if (lastShown && daysBetween(lastShown, dateKey) < Math.min(quest.cooldownDays, 2)) return false;
  }

  if (quest.id === "youtube-stream") {
    const weekDates = getWeekDates(dateKey);
    const streamDoneThisWeek = progress.events.filter((event) => {
      return event.type === "done" && event.questId === quest.id && weekDates.includes(event.dateKey);
    });
    if (streamDoneThisWeek.length >= quest.weeklyDoneLimit) return false;
    if (dayTypeId === "work") {
      const workdayStreams = streamDoneThisWeek.filter((event) => getDayType(event.dateKey) === "work");
      if (workdayStreams.length >= quest.workdayLimitPerWeek) return false;
    }
  }
  return true;
}

function scoreQuest(quest, dateKey, slot) {
  const dayTypeId = getDayType(dateKey);
  const priorityScore = Math.max(...quest.categories.map((category) => {
    return RULES.priorities.find((item) => item.id === category)?.weight || 0;
  }));
  let score = priorityScore;
  if (slot === "support" && quest.categories.some((category) => ["diet", "ai", "recovery"].includes(category))) {
    score += 70;
    const focusCategory = supportFocusCategory(dateKey);
    if (quest.categories.includes(focusCategory)) score += 42;
  }
  if (slot !== "support" && quest.categories.includes(slot)) score += 50;
  if (slot === "youtube" && quest.categories.includes("youtube")) score += 35;
  if (slot === "pokemon" && quest.categories.includes("pokemon")) score += 35;

  if (quest.frequency === "high") score += 18;
  if (quest.frequency === "medium") score += 8;
  if (quest.frequency === "low") score -= 8;

  if (quest.weight === "heavy") {
    if (dayTypeId === "mondayRest" || dayTypeId === "specialRest") score += 34;
    if (dayTypeId === "childcareRest") score += 8;
    if (dayTypeId === "work") score -= 18;
  }

  if (quest.id === "youtube-stream") {
    const streamCount = progress.events.filter((event) => {
      return event.type === "done" && event.questId === quest.id && getWeekDates(dateKey).includes(event.dateKey);
    }).length;
    score += (2 - streamCount) * 25;
    if (dayTypeId === "mondayRest") score += 20;
  }

  const recentCategoryDone = countRecentCategoryDone(quest.categories, dateKey, 7);
  score -= recentCategoryDone * 4;
  const recentCategoryShown = countRecentCategoryShown(quest.categories, dateKey, 6);
  score -= recentCategoryShown * 8;
  const lastShown = lastShownDate(quest.id, dateKey);
  if (lastShown && daysBetween(lastShown, dateKey) <= 1 && quest.frequency !== "high") score -= 24;
  score += seededJitter(`${quest.id}-${slot}`, dateKey);
  return score;
}

function supportFocusCategory(dateKey) {
  const dayIndex = Math.abs(daysBetween("2026-01-06", dateKey));
  const rotation = ["diet", "ai", "diet", "ai", "diet", "recovery"];
  return rotation[dayIndex % rotation.length];
}

function rerollQuest(dateKey, quest) {
  const plan = ensureDailyPlan(dateKey);
  const replacement = chooseQuest(
    dateKey,
    "reroll",
    [...plan.questIds, ...(plan.rerolledIds || [])],
    true
  );
  recordEvent("reroll", dateKey, quest);
  plan.rerolledIds = [...new Set([...(plan.rerolledIds || []), quest.id])];
  if (replacement) {
    plan.questIds = plan.questIds.map((questId) => questId === quest.id ? replacement.id : questId);
  }
  saveProgress();
}

function markDone(dateKey, quest) {
  if (isQuestDone(dateKey, quest.id)) return;
  recordEvent("done", dateKey, quest);
  saveProgress();
}

function recordEvent(type, dateKey, quest) {
  progress.events.push({
    id: `${type}-${dateKey}-${quest.id}-${Date.now()}`,
    type,
    dateKey,
    questId: quest.id,
    title: quest.title,
    categories: quest.categories,
    weight: quest.weight,
    createdAt: new Date().toISOString(),
  });
}

function markWeeklyDone(weekKey, quest) {
  if (!progress.weeklyChecks[weekKey]) progress.weeklyChecks[weekKey] = {};
  progress.weeklyChecks[weekKey][quest.id] = {
    title: quest.title,
    doneAt: new Date().toISOString(),
  };
  saveProgress();
}

function isWeeklyDone(weekKey, questId) {
  return Boolean(progress.weeklyChecks[weekKey]?.[questId]);
}

function buildWeeklyQuests(dateKey) {
  return buildBaseWeeklyQuests(dateKey).map(applyWeeklyTuning);
}

function buildBaseWeeklyQuests(dateKey) {
  const planType = getYouTubeWeeklyPlan(dateKey);
  const third = getWeeklyReflectionQuest(dateKey);
  return [
    {
      id: `weekly-youtube-${planType.id}`,
      title: planType.title,
      detail: planType.detail,
      weeklyWeight: "heavy",
    },
    {
      id: "weekly-pokemon",
      title: "今週の軸ポケモンを1体決める",
      detail: "気になった理由、強そうな点、試したい型のどれかを一言で残す。デイリーで達成できていればチェックしてOK。",
      weeklyWeight: "medium",
    },
    third,
  ];
}

function getWeeklyReflectionQuest(dateKey) {
  const reflectionQuests = getWeeklyReflectionPool();
  const index = (getWeekNumberInMonth(dateKey) - 1) % reflectionQuests.length;
  return reflectionQuests[index];
}

function getBaseWeeklyQuestPool() {
  return [
    {
      id: "weekly-youtube-stream-focus",
      title: "ポケモン配信2回を達成する",
      detail: "配信集中週。ショートは不要。週末に1回だけ達成チェックすればOK。",
      weeklyWeight: "heavy",
    },
    {
      id: "weekly-youtube-stream-short",
      title: "配信1回+ショート1本を達成する",
      detail: "月1回のショート週。配信2回は狙わず、配信1回とショート/切り抜き1本で達成。",
      weeklyWeight: "heavy",
    },
    {
      id: "weekly-pokemon",
      title: "今週の軸ポケモンを1体決める",
      detail: "気になった理由、強そうな点、試したい型のどれかを一言で残す。デイリーで達成できていればチェックしてOK。",
      weeklyWeight: "medium",
    },
    ...getWeeklyReflectionPool(),
  ];
}

function getWeeklyReflectionPool() {
  return [
    {
      id: "weekly-diet-review",
      title: "体づくりの1週間を振り返る",
      detail: "筋トレ、動画、体重記録のどれかを見て、続いた要因か詰まった要因を1行で残す。",
      weeklyWeight: "medium",
    },
    {
      id: "weekly-ai-review",
      title: "AI活用の1週間を振り返る",
      detail: "Codex/ChatGPTに相談した内容や見た動画から、次に使えそうなことを1行で残す。",
      weeklyWeight: "light",
    },
    {
      id: "weekly-pokemon-review",
      title: "ポケモン活動の1週間を振り返る",
      detail: "今週触れたポケモン、構築、対戦、記事の中から、来週に残したいことを1行で残す。",
      weeklyWeight: "medium",
    },
    {
      id: "weekly-youtube-review",
      title: "YouTube活動の1週間を振り返る",
      detail: "配信できた・できなかった理由、次に軽くする工夫、ショート候補のどれかを1行で残す。",
      weeklyWeight: "medium",
    },
  ];
}

function findBaseWeeklyQuest(weeklyId) {
  return getBaseWeeklyQuestPool().find((quest) => quest.id === weeklyId) || null;
}

function applyWeeklyTuning(quest) {
  const tuning = getWeeklyTuning(quest.id);
  if (!tuning) return quest;
  return {
    ...quest,
    title: tuning.title || quest.title,
    detail: tuning.detail || quest.detail,
    weeklyWeight: tuning.weeklyWeight || quest.weeklyWeight || "medium",
    tuningId: tuning.id,
    tuningReason: tuning.reason,
    tuningNote: tuning.note,
    tunedAt: tuning.updatedAt || tuning.createdAt,
  };
}

function getWeeklyTuning(weeklyId) {
  return weeklyTuning.find((tuning) => tuning.weeklyId === weeklyId) || null;
}

function getWeeklyQuestion(dateKey) {
  const questions = weeklyQuestionPool();
  const weekKey = getWeekKey(dateKey);
  const index = Math.abs(seededJitter("weekly-review", weekKey)) % questions.length;
  return questions[index];
}

function getWeeklyReview(weekKey) {
  return weeklyReviews.find((review) => review.weekKey === weekKey) || null;
}

function weeklyQuestionPool() {
  return [
    "今週、ポケモン活動で一番残したい成果は何ですか？",
    "YouTube活動は、配信・ショート・休むのどれを優先したいですか？",
    "今週の生活事情で、重くしすぎないために先に決めておく条件はありますか？",
    "最近出てきたクエストで、出ると気が重いものはありますか？理由も一言で教えてください。",
    "ダイエットやAIは、今週どのくらいの軽さなら自然に触れられそうですか？",
    "今のご褒美や休み方で、嬉しいもの・冷めるものはありますか？",
  ];
}

function getYouTubeWeeklyPlan(dateKey) {
  const weekNumber = getWeekNumberInMonth(dateKey);
  if (weekNumber === 4) {
    return {
      id: "stream-short",
      title: "配信1回+ショート1本を達成する",
      detail: "月1回のショート週。配信2回は狙わず、配信1回とショート/切り抜き1本で達成。",
    };
  }
  return {
    id: "stream-focus",
    title: "ポケモン配信2回を達成する",
    detail: "配信集中週。ショートは不要。週末に1回だけ達成チェックすればOK。",
  };
}

function getDayType(dateKey) {
  return schedule.overrides[dateKey] || defaultDayType(dateKey);
}

function setDayType(dateKey, type) {
  if (type === defaultDayType(dateKey)) {
    delete schedule.overrides[dateKey];
  } else {
    schedule.overrides[dateKey] = type;
  }
  saveSchedule();
}

function defaultDayType(dateKey) {
  const day = parseDate(dateKey).getDay();
  if (day === 1) return "mondayRest";
  if (day >= 2 && day <= 5) return "work";
  if (day === 6) return "work";
  return "childcareRest";
}

function resetDailyPlan(dateKey) {
  delete progress.dailyPlans[dateKey];
  saveProgress();
}

function resetDateProgress(dateKey) {
  progress.events = progress.events.filter((event) => event.dateKey !== dateKey);
  delete progress.dailyPlans[dateKey];
  saveProgress();
}

function getQuestPool() {
  const suppressed = suppressedQuestIds();
  return getRawQuestPool().filter((quest) => !suppressed.includes(quest.id));
}

function getRawQuestPool() {
  return getBaseQuestPool().map(applyQuestTuning);
}

function getBaseQuestPool() {
  return [...RULES.quests, ...customQuests];
}

function findQuest(questId) {
  return getQuestPool().find((quest) => quest.id === questId);
}

function findAnyQuest(questId) {
  return getRawQuestPool().find((quest) => quest.id === questId);
}

function findBaseQuest(questId) {
  return getBaseQuestPool().find((quest) => quest.id === questId);
}

function applyQuestTuning(quest) {
  const tuning = getQuestTuning(quest.id);
  if (!tuning) return quest;
  return {
    ...quest,
    weight: tuning.weight,
    minutes: tuning.minutes,
    frequency: tuning.frequency,
    detail: tuning.detail || quest.detail,
    tuningId: tuning.id,
    tuningReason: tuning.reason,
    tunedAt: tuning.updatedAt || tuning.createdAt,
  };
}

function getQuestTuning(questId) {
  return questTuning.find((tuning) => tuning.questId === questId) || null;
}

function activeQuestFeedback() {
  return questFeedback.filter((feedback) => feedback.action === "remove" && feedback.active);
}

function suppressedQuestIds() {
  return activeQuestFeedback().map((feedback) => feedback.questId);
}

function isQuestDone(dateKey, questId) {
  return progress.events.some((event) => {
    return event.type === "done" && event.dateKey === dateKey && event.questId === questId;
  });
}

function getDateEvents(dateKey, type) {
  return progress.events.filter((event) => {
    return event.dateKey === dateKey && (!type || event.type === type);
  });
}

function lastEventForQuest(questId, type, beforeDateKey) {
  return progress.events
    .filter((event) => event.questId === questId && event.type === type && event.dateKey < beforeDateKey)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0] || null;
}

function lastShownDate(questId, beforeDateKey) {
  return Object.entries(progress.dailyPlans)
    .filter(([dateKey, plan]) => dateKey < beforeDateKey && plan.questIds.includes(questId))
    .map(([dateKey]) => dateKey)
    .sort()
    .pop() || "";
}

function countRecentCategoryDone(categories, dateKey, days) {
  const dates = getPreviousDates(dateKey, days);
  return progress.events.filter((event) => {
    return event.type === "done"
      && dates.includes(event.dateKey)
      && event.categories.some((category) => categories.includes(category));
  }).length;
}

function countRecentCategoryShown(categories, dateKey, days) {
  const dates = getPreviousDates(dateKey, days);
  return Object.entries(progress.dailyPlans).filter(([planDate, plan]) => {
    if (!dates.includes(planDate)) return false;
    return (plan.questIds || []).some((questId) => {
      const quest = findQuest(questId);
      return quest?.categories.some((category) => categories.includes(category));
    });
  }).length;
}

function explainQuest(quest, dateKey) {
  if (quest.source === "codex") {
    return "Codexから取り込んだ候補。分類・重さ・頻度を見て通常候補と同じように選択。";
  }
  if (quest.source === "app") {
    return "アプリで追加した候補。分類・重さ・頻度を見て通常候補と同じように選択。";
  }
  if (quest.id === "youtube-stream") {
    return "週2回配信を現実ラインにしつつ、直近配信から間隔を空けるため。";
  }
  if (quest.categories.includes("pokemon") && quest.categories.includes("youtube")) {
    return "ポケモン活動と配信活動の両方に効く境界タスクとして選択。";
  }
  if (quest.categories.includes("diet")) {
    return "毎日大事だが3枠を埋めないよう、適度にローテーション。";
  }
  if (quest.categories.includes("ai")) {
    return "AIは低ウェイトなので、短時間で触れる日にだけ提示。";
  }
  if (quest.categories.includes("pokemon")) {
    return "最優先のポケモン活動を今週途切れさせないため。";
  }
  if (quest.categories.includes("youtube")) {
    return "YouTube活動の頻度を落としすぎないため。";
  }
  return "全体の偏りを避けるための補助クエスト。";
}

function dominantCategory(quest) {
  return quest.categories[0] || "pokemon";
}

function sourceLabel(quest) {
  if (quest.tuningId) return "調整済み";
  if (quest.source === "codex") return "Codex追加";
  if (quest.source === "app") return "アプリ追加";
  return "";
}

function formatCategories(categories) {
  return categories.map((category) => RULES.categoryLabels[category] || category).join(" / ");
}

function compactCategorySummary(categories) {
  const unique = [...new Set(categories)];
  return unique.map((category) => RULES.categoryLabels[category] || category).join(" / ");
}

function getWeekKey(dateKey) {
  return getWeekDates(dateKey)[0];
}

function formatWeekStatus(dateKey) {
  return `${formatWeekRange(dateKey)} / ${formatRemainingDays(dateKey)}`;
}

function formatWeekRange(dateKey) {
  const dates = getWeekDates(dateKey);
  const start = parseDate(dates[0]);
  const end = parseDate(dates[6]);
  return `${formatMonthDay(start)}(${DAY_NAMES[start.getDay()]})-${formatMonthDay(end)}(${DAY_NAMES[end.getDay()]})`;
}

function formatRemainingDays(dateKey) {
  const endDateKey = getWeekDates(dateKey)[6];
  const remaining = Math.max(1, daysBetween(dateKey, endDateKey) + 1);
  return `あと${remaining}日`;
}

function getWeekDates(dateKey) {
  const weekStart = getWeekStartDate(dateKey);
  return Array.from({ length: 7 }, (_, index) => formatDate(addDays(weekStart, index)));
}

function getPreviousDates(dateKey, count) {
  const date = parseDate(dateKey);
  return Array.from({ length: count }, (_, index) => formatDate(addDays(date, -index - 1)));
}

function getWeekNumberInMonth(dateKey) {
  const date = parseDate(dateKey);
  const weekStart = getWeekStartDate(dateKey);
  const firstWeekStart = getWeekStartDate(formatDate(new Date(date.getFullYear(), date.getMonth(), 1)));
  return Math.floor(daysBetween(formatDate(firstWeekStart), formatDate(weekStart)) / 7) + 1;
}

function getWeekStartDate(dateKey) {
  const date = parseDate(dateKey);
  const offset = (date.getDay() - WEEK_START_DAY + 7) % 7;
  return addDays(date, -offset);
}

function daysBetween(fromDateKey, toDateKey) {
  return Math.round((parseDate(toDateKey) - parseDate(fromDateKey)) / 86400000);
}

function todayKey() {
  return formatDate(new Date());
}

function parseDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateLabel(dateKey) {
  const date = parseDate(dateKey);
  return `${formatMonthDay(date)}(${DAY_NAMES[date.getDay()]})`;
}

function seededJitter(text, dateKey) {
  let hash = 0;
  const input = `${text}-${dateKey}`;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 9973;
  }
  return (hash % 17) - 8;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function emptyState(title, body) {
  const clone = selectors.emptyTemplate.content.cloneNode(true);
  clone.querySelector("strong").textContent = title;
  clone.querySelector("span").textContent = body;
  return clone;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
