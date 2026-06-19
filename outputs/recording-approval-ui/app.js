const STORAGE_KEY = "recording-approval-ui-table-v2";
const DEFAULT_SAVE_FILENAME = "approvals.json";
const DEFAULT_SAVE_HINT = "outputs/recording-approval-ui/data/approvals.json";
const HANDLE_DB_NAME = "recording-approval-ui";
const HANDLE_STORE_NAME = "handles";

const state = {
  data: null,
  decisions: {},
  filters: {
    search: "",
    destination: "",
    status: "",
    shortOnly: false,
    sortBy: "destination",
    copyScope: "pending-mp4",
    vtt: "",
  },
  saveHandle: null,
  autosaveTimer: null,
  fillDrag: null,
};

const statsEl = document.getElementById("stats");
const tableBodyEl = document.getElementById("recordingTableBody");
const searchInput = document.getElementById("searchInput");
const destinationFilter = document.getElementById("destinationFilter");
const sortBy = document.getElementById("sortBy");
const statusFilter = document.getElementById("statusFilter");
const copyScope = document.getElementById("copyScope");
const vttFilter = document.getElementById("vttFilter");
const shortOnly = document.getElementById("shortOnly");
const connectBtn = document.getElementById("connectBtn");
const saveStatus = document.getElementById("saveStatus");

const SAVE_MESSAGES = {
  setupNeeded: "Auto-save is not set up yet. Click Set Up Auto-Save once, then your changes will save automatically.",
  permissionDenied: "Auto-save permission was not granted. Your changes still stay in the page for now.",
  saveFailed: "Auto-save failed. Set up auto-save again if needed.",
  cancelled: "Auto-save setup was cancelled. Nothing was lost in the page.",
};

async function init() {
  state.data = window.RECORDINGS_PAYLOAD;
  if (!state.data) throw new Error("Missing recordings payload");
  hydrateState();
  state.saveHandle = await loadSavedHandle();
  populateDestinationFilter();
  bindEvents();
  render();
  updateSaveStatus();
}

function hydrateState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    state.decisions = saved.decisions || {};
  } catch (error) {
    console.warn("Could not load local state", error);
  }
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      decisions: state.decisions,
    }),
  );
}

function populateDestinationFilter() {
  for (const destination of sortedDestinations()) {
    const option = document.createElement("option");
    option.value = destination.id;
    option.textContent = destinationDisplayLabel(destination);
    destinationFilter.append(option);
  }
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });

  destinationFilter.addEventListener("change", (event) => {
    state.filters.destination = event.target.value;
    render();
  });

  sortBy.addEventListener("change", (event) => {
    state.filters.sortBy = event.target.value;
    render();
  });

  statusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    render();
  });

  copyScope.addEventListener("change", (event) => {
    state.filters.copyScope = event.target.value;
    render();
  });

  vttFilter.addEventListener("change", (event) => {
    state.filters.vtt = event.target.value;
    render();
  });

  shortOnly.addEventListener("change", (event) => {
    state.filters.shortOnly = event.target.checked;
    render();
  });

  connectBtn.addEventListener("click", connectApprovalFile);
}

function getDecision(recording) {
  return (
    state.decisions[recording.name] || {
      destinationId: recording.suggestedDestinationId || "",
      approved: true,
      skipCopy: false,
      notes: "",
    }
  );
}

function setDecision(name, partial) {
  const current = state.decisions[name] || {};
  state.decisions[name] = { ...current, ...partial };
  persistState();
  renderStats();
  scheduleAutosave();
}

function decisionStatus(decision) {
  if (decision.skipCopy) return "skip";
  if (decision.approved) return "approved";
  return "pending";
}

function matchesFilters(recording) {
  const decision = getDecision(recording);
  const status = decisionStatus(decision);

  if (state.filters.search && !recording.name.toLowerCase().includes(state.filters.search)) {
    return false;
  }
  if (state.filters.destination && decision.destinationId !== state.filters.destination) {
    return false;
  }
  if (state.filters.status && status !== state.filters.status) {
    return false;
  }
  if (state.filters.copyScope === "pending-mp4" && recording.alreadyCopied) {
    return false;
  }
  if (state.filters.copyScope === "copied-mp4" && !recording.alreadyCopied) {
    return false;
  }
  if (state.filters.vtt === "missing" && recording.vttFound) {
    return false;
  }
  if (state.filters.vtt === "found" && !recording.vttFound) {
    return false;
  }
  if (state.filters.shortOnly && !recording.suspectShort) {
    return false;
  }
  return true;
}

function render() {
  renderStats();
  renderTable();
}

function renderStats() {
  const recordings = state.data.recordings;
  const visibleBase = recordings.filter((item) => {
    if (state.filters.copyScope === "pending-mp4") return !item.alreadyCopied;
    if (state.filters.copyScope === "copied-mp4") return item.alreadyCopied;
    return true;
  });
  const approved = visibleBase.filter((item) => getDecision(item).approved).length;
  const skipped = visibleBase.filter((item) => getDecision(item).skipCopy).length;
  const pending = visibleBase.length - approved - skipped;
  const shortCount = recordings.filter((item) => item.suspectShort).length;
  const copiedMp4 = recordings.filter((item) => item.alreadyCopied).length;
  const vttFound = recordings.filter((item) => item.vttFound).length;

  statsEl.innerHTML = "";
  [
    { label: "In scope", value: visibleBase.length },
    { label: "All recordings", value: recordings.length },
    { label: "MP4 copied", value: copiedMp4 },
    { label: "VTT found", value: vttFound },
    { label: "Approved", value: approved },
    { label: "Pending", value: pending },
    { label: "Skip", value: skipped },
    { label: "Short", value: shortCount },
  ].forEach((stat) => {
    const item = document.createElement("div");
    item.className = "stat";
    item.innerHTML = `<strong>${stat.value}</strong><span>${stat.label}</span>`;
    statsEl.append(item);
  });
}

function renderTable() {
  const visible = state.data.recordings.filter(matchesFilters).sort(compareRecordings);
  tableBodyEl.innerHTML = "";

  if (!visible.length) {
    tableBodyEl.innerHTML = `<tr class="empty-row"><td colspan="11">No recordings match the current filters.</td></tr>`;
    return;
  }

  for (const recording of visible) {
    const decision = getDecision(recording);
    const tr = document.createElement("tr");
    const status = decisionStatus(decision);
    const destinationOptions = sortedDestinations()
      .map((destination) => {
        const selected = decision.destinationId === destination.id ? "selected" : "";
        return `<option value="${destination.id}" ${selected}>${escapeHtml(destinationDisplayLabel(destination))}</option>`;
      })
      .join("");

    tr.innerHTML = `
      <td>
        <div class="status-stack">
          ${statusPill(status)}
          <div class="status-note">Review decision</div>
        </div>
      </td>
      <td>
        <div>${escapeHtml(recording.durationText || "Unknown")}</div>
        ${recording.suspectShort ? '<div class="pill pill-short">Short clip</div>' : ""}
      </td>
      <td>
        <div class="recording-name">${escapeHtml(recording.name)}</div>
      </td>
      <td>
        <a class="open-link" href="${escapeAttr(recording.sourceUrl || "#")}" target="_blank" rel="noreferrer">Open</a>
      </td>
      <td>
        <div class="status-stack">
          ${mp4Pill(recording)}
          <div class="status-note">File check</div>
        </div>
      </td>
      <td>
        <div class="status-stack">
          ${vttPill(recording)}
          <div class="status-note">Transcript check</div>
        </div>
      </td>
      <td class="fill-cell" data-row-name="${escapeAttr(recording.name)}" data-fill-field="destinationId">
        <select data-name="${escapeAttr(recording.name)}" data-field="destinationId">
          <option value="">Choose folder</option>
          ${destinationOptions}
        </select>
        <button type="button" class="fill-handle" data-name="${escapeAttr(recording.name)}" data-field="destinationId" title="Drag to fill down"></button>
      </td>
      <td>
        <div class="filename-preview">${escapeHtml(recording.suggestedNewName)}</div>
      </td>
      <td class="fill-cell" data-row-name="${escapeAttr(recording.name)}" data-fill-field="notes">
        <textarea data-name="${escapeAttr(recording.name)}" data-field="notes" placeholder="Optional note">${escapeHtml(decision.notes || "")}</textarea>
        <button type="button" class="fill-handle" data-name="${escapeAttr(recording.name)}" data-field="notes" title="Drag to fill down"></button>
      </td>
      <td class="cell-checkbox fill-cell" data-row-name="${escapeAttr(recording.name)}" data-fill-field="approved">
        <input type="checkbox" data-name="${escapeAttr(recording.name)}" data-field="approved" ${decision.approved ? "checked" : ""}>
        <button type="button" class="fill-handle" data-name="${escapeAttr(recording.name)}" data-field="approved" title="Drag to fill down"></button>
      </td>
      <td class="cell-checkbox fill-cell" data-row-name="${escapeAttr(recording.name)}" data-fill-field="skipCopy">
        <input type="checkbox" data-name="${escapeAttr(recording.name)}" data-field="skipCopy" ${decision.skipCopy ? "checked" : ""}>
        <button type="button" class="fill-handle" data-name="${escapeAttr(recording.name)}" data-field="skipCopy" title="Drag to fill down"></button>
      </td>
    `;

    tableBodyEl.append(tr);
  }

  tableBodyEl.querySelectorAll("[data-field]").forEach((element) => {
    const eventName = element.tagName === "TEXTAREA" ? "input" : "change";
    element.addEventListener(eventName, handleDecisionChange);
  });
  tableBodyEl.querySelectorAll(".fill-handle").forEach((element) => {
    element.addEventListener("pointerdown", beginFillDrag);
  });
}

function handleDecisionChange(event) {
  const element = event.target;
  const name = element.dataset.name;
  const field = element.dataset.field;
  const current = getDecision({ name });
  const value = element.type === "checkbox" ? element.checked : element.value;
  const next = { ...current, [field]: value };

  if (field === "approved" && value) next.skipCopy = false;
  if (field === "skipCopy" && value) next.approved = false;

  setDecision(name, next);
  if (field === "approved" || field === "skipCopy") {
    renderTable();
  }
}

async function saveApprovals() {
  const payload = buildApprovalPayload();
  const serialized = JSON.stringify(payload, null, 2);

  try {
    if (!state.saveHandle) {
      updateSaveStatus(SAVE_MESSAGES.setupNeeded, "warn");
      return false;
    }

    const permission = await state.saveHandle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      const requested = await state.saveHandle.requestPermission({ mode: "readwrite" });
      if (requested !== "granted") {
        updateSaveStatus(SAVE_MESSAGES.permissionDenied, "warn");
        return false;
      }
    }

    const writable = await state.saveHandle.createWritable();
    await writable.write(serialized);
    await writable.close();
    updateSaveStatus(`Auto-saved to ${state.saveHandle.name}.`);
    return true;
  } catch (error) {
    console.warn("Save failed", error);
    updateSaveStatus(SAVE_MESSAGES.saveFailed, "warn");
    return false;
  }
}

async function connectApprovalFile() {
  const previousHandle = state.saveHandle;
  try {
    if (!window.showSaveFilePicker) {
      const serialized = JSON.stringify(buildApprovalPayload(), null, 2);
      downloadFallback(serialized);
      updateSaveStatus(`This browser cannot save directly here, so a JSON file was downloaded instead. Move it to ${DEFAULT_SAVE_HINT} if you want me to read it later.`, "warn");
      return;
    }

    state.saveHandle = await window.showSaveFilePicker({
      suggestedName: DEFAULT_SAVE_FILENAME,
      types: [
        {
          description: "JSON files",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    await saveHandleToDb(state.saveHandle);
    updateSaveStatus(`Auto-save is on. Changes will be saved to ${state.saveHandle.name}.`);
    await saveApprovals();
  } catch (error) {
    console.warn("Connect cancelled or failed", error);
    state.saveHandle = previousHandle;
    if (state.saveHandle) {
      updateSaveStatus(`Auto-save is on. Changes will be saved to ${state.saveHandle.name}.`);
      return;
    }
    updateSaveStatus(SAVE_MESSAGES.cancelled, "warn");
  }
}

function buildApprovalPayload() {
  return {
    savedAt: new Date().toISOString(),
    approvals: state.data.recordings.map((recording) => {
      const decision = getDecision(recording);
      return {
        name: recording.name,
        durationText: recording.durationText,
        durationSeconds: recording.durationSeconds,
        suspectShort: recording.suspectShort,
        alreadyCopied: Boolean(recording.alreadyCopied),
        suggestedDestinationId: recording.suggestedDestinationId,
        datePrefix: recording.datePrefix,
        dateToken: recording.dateToken,
        suggestedNewName: recording.suggestedNewName,
        destinationId: decision.destinationId || "",
        approved: Boolean(decision.approved),
        skipCopy: Boolean(decision.skipCopy),
        notes: decision.notes || "",
      };
    }),
  };
}

function scheduleAutosave() {
  if (!state.saveHandle) return;
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(() => {
    void saveApprovals();
  }, 250);
}

function beginFillDrag(event) {
  event.preventDefault();
  event.stopPropagation();

  const handle = event.currentTarget;
  const rowName = handle.dataset.name;
  const field = handle.dataset.field;
  const visible = state.data.recordings.filter(matchesFilters).sort(compareRecordings);
  const startIndex = visible.findIndex((item) => item.name === rowName);
  if (startIndex === -1) return;

  state.fillDrag = {
    field,
    rowName,
    startIndex,
    endIndex: startIndex,
    rows: visible,
  };

  highlightFillRange();
  window.addEventListener("pointermove", onFillDragMove);
  window.addEventListener("pointerup", endFillDrag);
}

function onFillDragMove(event) {
  if (!state.fillDrag) return;
  const cell = event.target.closest("[data-row-name][data-fill-field]");
  if (!cell || cell.dataset.fillField !== state.fillDrag.field) return;
  const targetIndex = state.fillDrag.rows.findIndex((item) => item.name === cell.dataset.rowName);
  if (targetIndex === -1) return;
  state.fillDrag.endIndex = targetIndex;
  highlightFillRange();
}

function endFillDrag() {
  if (!state.fillDrag) return;
  const { field, rowName, startIndex, endIndex, rows } = state.fillDrag;
  const source = rows[startIndex];
  const sourceDecision = getDecision(source);
  const sourceValue = sourceDecision[field];
  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);

  for (let index = from; index <= to; index += 1) {
    const recording = rows[index];
    const current = getDecision(recording);
    const next = { ...current, [field]: sourceValue };
    if (field === "approved" && sourceValue) next.skipCopy = false;
    if (field === "skipCopy" && sourceValue) next.approved = false;
    setDecision(recording.name, next);
  }

  state.fillDrag = null;
  clearFillHighlights();
  window.removeEventListener("pointermove", onFillDragMove);
  window.removeEventListener("pointerup", endFillDrag);
  renderTable();
}

function highlightFillRange() {
  clearFillHighlights();
  if (!state.fillDrag) return;
  const { field, startIndex, endIndex, rows } = state.fillDrag;
  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);

  for (let index = from; index <= to; index += 1) {
    const recording = rows[index];
    const cell = tableBodyEl.querySelector(
      `[data-row-name="${cssEscape(recording.name)}"][data-fill-field="${field}"]`,
    );
    if (!cell) continue;
    cell.classList.add(index === startIndex ? "is-source" : "is-target");
  }
}

function clearFillHighlights() {
  tableBodyEl.querySelectorAll(".fill-cell").forEach((cell) => {
    cell.classList.remove("is-source", "is-target");
  });
}

function downloadFallback(serialized) {
  const blob = new Blob([serialized], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = DEFAULT_SAVE_FILENAME;
  anchor.click();
  URL.revokeObjectURL(url);
}

function statusPill(status) {
  if (status === "approved") {
    return '<span class="pill pill-approved">Approved</span>';
  }
  if (status === "skip") {
    return '<span class="pill pill-skip">Skip</span>';
  }
  return '<span class="pill pill-pending">Pending</span>';
}

function compareRecordings(left, right) {
  const sortMode = state.filters.sortBy;
  if (sortMode === "name") {
    return left.name.localeCompare(right.name);
  }
  if (sortMode === "duration") {
    return (left.durationSeconds || 0) - (right.durationSeconds || 0);
  }

  const leftDestination = destinationLabel(getDecision(left).destinationId);
  const rightDestination = destinationLabel(getDecision(right).destinationId);
  const destinationCompare = leftDestination.localeCompare(rightDestination);
  if (destinationCompare !== 0) return destinationCompare;
  return left.name.localeCompare(right.name);
}

function destinationLabel(destinationId) {
  const destination = state.data.destinations.find((item) => item.id === destinationId);
  return destination ? destinationDisplayLabel(destination) : "zzz";
}

function destinationDisplayLabel(destination) {
  return destination.uiLabel || destination.label;
}

function sortedDestinations() {
  return [...state.data.destinations].sort((left, right) =>
    destinationDisplayLabel(left).localeCompare(destinationDisplayLabel(right)),
  );
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replaceAll('"', '\\"');
}

function updateSaveStatus(message = "", mode = "ok") {
  saveStatus.textContent = message || "Ready.";
  saveStatus.classList.remove("ok", "warn");
  saveStatus.classList.add(mode);
  connectBtn.textContent = state.saveHandle ? "Auto-Save Is On" : "Set Up Auto-Save";
}

async function loadSavedHandle() {
  if (!("indexedDB" in window)) return null;
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readonly");
    const store = tx.objectStore(HANDLE_STORE_NAME);
    const request = store.get("approval-file");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveHandleToDb(handle) {
  if (!("indexedDB" in window)) return;
  const db = await openHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readwrite");
    const store = tx.objectStore(HANDLE_STORE_NAME);
    const request = store.put(handle, "approval-file");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        db.createObjectStore(HANDLE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

init().catch(() => {
  tableBodyEl.innerHTML = '<tr class="empty-row"><td colspan="11">Could not load recording data.</td></tr>';
});

function mp4Pill(recording) {
  if (recording.alreadyCopied && recording.copiedMp4) {
    return `<span class="pill pill-info">Already in target</span>`;
  }
  return '<span class="pill pill-pending">Not in target</span>';
}

function vttPill(recording) {
  if (recording.vttFound && recording.copiedVtt) {
    return '<span class="pill pill-info">VTT in target</span>';
  }
  return '<span class="pill pill-pending">No VTT</span>';
}
