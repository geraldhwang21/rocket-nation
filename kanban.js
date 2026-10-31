import { cards, columns } from "./kanban-data.js";
const storageKey = "rocket-nation-workboard-v1";
const allowed = new Set(columns.map((column) => column.id));
const defaults = () =>
  Object.fromEntries(
    cards.map((card) => [
      card.id,
      { status: card.depends.length ? "backlog" : "ready", note: "" },
    ]),
  );
let state = defaults();
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (saved && typeof saved === "object")
    for (const card of cards) {
      const value = saved[card.id];
      if (value && allowed.has(value.status) && typeof value.note === "string")
        state[card.id] = {
          status: value.status,
          note: value.note.slice(0, 5000),
        };
    }
} catch {
  /* The board works in memory when storage is unavailable. */
}
const board = document.querySelector("#kanban-board");
const dialog = document.querySelector("#kanban-dialog");
const form = document.querySelector("#kanban-card-form");
const message = document.querySelector("#kanban-message");
let selected = null;
function unmet(card) {
  return card.depends.filter((id) => state[id]?.status !== "done");
}
function reconcileDependencies() {
  let changed = true;
  while (changed) {
    changed = false;
    for (const card of cards) {
      const pending = unmet(card).length > 0;
      if (pending && state[card.id].status !== "backlog") {
        state[card.id].status = "backlog";
        changed = true;
      } else if (!pending && state[card.id].status === "backlog") {
        state[card.id].status = "ready";
        changed = true;
      }
      if (state[card.id].status === "done" && !state[card.id].note.trim()) {
        state[card.id].status = pending ? "backlog" : "ready";
        changed = true;
      }
    }
  }
}
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}
function render() {
  board.replaceChildren();
  for (const column of columns) {
    const items = cards.filter((card) => state[card.id].status === column.id);
    const section = document.createElement("section");
    section.className = "kanban-column";
    section.dataset.column = column.id;
    const heading = text("h3", column.label);
    heading.append(text("span", String(items.length), "kanban-count"));
    section.append(heading);
    const list = document.createElement("div");
    list.className = "kanban-card-list";
    list.setAttribute("aria-label", column.label);
    if (!items.length)
      list.append(text("p", "No cards in this column.", "kanban-empty"));
    for (const card of items) {
      const button = document.createElement("button");
      button.className = "kanban-card";
      button.type = "button";
      button.draggable = true;
      button.dataset.card = card.id;
      button.setAttribute(
        "aria-label",
        `${card.title}. Responsible: ${card.owner}. ${column.label}. Open card.`,
      );
      button.append(
        text("strong", card.title),
        text("span", card.owner, "kanban-owner"),
        text("span", card.source, "kanban-source"),
      );
      const pending = unmet(card);
      if (pending.length)
        button.append(
          text(
            "span",
            `${pending.length} ${pending.length === 1 ? "dependency" : "dependencies"} pending`,
            "kanban-dependency",
          ),
        );
      button.addEventListener("click", () => openCard(card));
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
      });
      list.append(button);
    }
    section.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      section.classList.add("drag-over");
    });
    section.addEventListener("dragleave", () =>
      section.classList.remove("drag-over"),
    );
    section.addEventListener("drop", (event) => {
      event.preventDefault();
      section.classList.remove("drag-over");
      const card = cards.find(
        (item) => item.id === event.dataTransfer.getData("text/plain"),
      );
      if (!card) return;
      openCard(card);
      form.elements.status.value = column.id;
      document.querySelector("#kanban-card-error").textContent =
        "Review the state and record evidence, then save.";
    });
    section.append(list);
    board.append(section);
    watchListScroll(list);
  }
}
// A long column scrolls; fade its bottom edge until the last card is shown,
// so a cut-off card reads as "more below" rather than as a clipped card.
function watchListScroll(list) {
  const update = () => {
    const scrollable = list.scrollHeight > list.clientHeight + 1;
    const atEnd =
      list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
    list.classList.toggle("has-more", scrollable && !atEnd);
  };
  list.addEventListener("scroll", update, { passive: true });
  requestAnimationFrame(update);
}
function openCard(card) {
  selected = card;
  document.querySelector("#kanban-card-title").textContent = card.title;
  document.querySelector("#kanban-card-owner").textContent = card.owner;
  document.querySelector("#kanban-card-evidence").textContent = card.evidence;
  const source = document.querySelector("#kanban-card-source");
  source.textContent = card.source + " in the business plan";
  source.href =
    "plan/implementation.html#9-phased-implementation-and-first-30-day-action-plan";
  const dependencies = document.querySelector("#kanban-card-dependencies");
  dependencies.replaceChildren();
  if (!card.depends.length)
    dependencies.append(text("p", "No prerequisite card."));
  for (const id of card.depends) {
    const dependency = cards.find((item) => item.id === id);
    dependencies.append(
      text(
        "p",
        `${dependency.title}: ${state[id].status === "done" ? "evidence recorded" : "pending"}`,
      ),
    );
  }
  form.elements.status.value = state[card.id].status;
  form.elements.evidence.value = state[card.id].note;
  document.querySelector("#kanban-card-error").textContent = "";
  dialog.showModal();
  document.dispatchEvent(
    new CustomEvent("rocket-nation:card-opened", { detail: { id: card.id } }),
  );
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selected) return;
  const status = form.elements.status.value,
    note = form.elements.evidence.value.trim(),
    error = document.querySelector("#kanban-card-error");
  if (!allowed.has(status)) {
    error.textContent = "Choose a listed state.";
    return;
  }
  const pending = unmet(selected);
  if (status !== "backlog" && pending.length) {
    error.textContent =
      "Record the prerequisite cards first, or keep this card pending.";
    return;
  }
  if (status === "done" && !note) {
    error.textContent =
      "Record the evidence before marking this card complete.";
    return;
  }
  state[selected.id] = { status, note };
  // Reopening a prerequisite also reopens its dependent chain.
  reconcileDependencies();
  const persisted = save();
  render();
  dialog.close();
  board
    .querySelector(`[data-card="${selected.id}"]`)
    ?.focus({ preventScroll: true });
  message.textContent = persisted
    ? "Card saved in this browser. We still need to review the evidence."
    : "Card updated for this visit. Browser storage is unavailable.";
});
document
  .querySelector("#kanban-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const controls = [
    ...dialog.querySelectorAll("a[href],button,select,textarea,input"),
  ].filter((control) => !control.disabled);
  const first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
document.querySelector("#kanban-reset").addEventListener("click", () => {
  if (!confirm("Reset this browser’s card states and evidence notes?")) return;
  state = defaults();
  save();
  render();
  message.textContent = "Board reset. No business work is marked complete.";
});
reconcileDependencies();
render();
