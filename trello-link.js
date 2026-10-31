// Runtime board identity only. Never put Trello credentials in this file or its JSON.
const link = document.querySelector("#trello-board-link");
const status = document.querySelector("#trello-board-status");
const cardLink = document.querySelector("#kanban-card-trello");
let binding = null;
let selectedId = null;
function trelloUrl(value, kind) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.hostname !== "trello.com" ||
      url.port || url.username || url.password ||
      !new RegExp(`^/${kind}/[A-Za-z0-9]+(?:/|$)`).test(url.pathname)
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}
function updateCardLink() {
  const href = binding && selectedId &&
    trelloUrl(binding.cards?.[selectedId], "c");
  cardLink.hidden = !href;
  if (href) cardLink.href = href;
  else cardLink.removeAttribute("href");
}
document.addEventListener("rocket-nation:card-opened", (event) => {
  selectedId = event.detail.id;
  updateCardLink();
});
try {
  const response = await fetch("./trello-binding.json", { cache: "no-store" });
  if (!response.ok) throw new Error("No board binding.");
  const candidate = await response.json();
  const boardUrl = trelloUrl(candidate?.boardUrl, "b");
  if (boardUrl) {
    binding = candidate;
    link.href = boardUrl;
    link.hidden = false;
    status.textContent =
      "Use Trello for shared execution. This local planning view does not synchronize card changes.";
    updateCardLink();
  }
} catch {
  // The local plan remains readable when the external board is not linked.
}
