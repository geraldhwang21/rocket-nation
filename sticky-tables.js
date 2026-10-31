/* Keep column labels visible while the document scrolls past a table.
   Tables retain their existing horizontal scrolling on narrow screens. */
(() => {
  const bar = document.createElement("div");
  bar.id = "sticky-table-header";
  bar.setAttribute("aria-hidden", "true");
  bar.inert = true;
  Object.assign(bar.style, {
    position: "fixed",
    zIndex: "9",
    overflow: "hidden",
    pointerEvents: "none",
    display: "none",
    boxShadow: "0 5px 12px rgba(23, 26, 32, .16)",
  });
  document.body.append(bar);

  let activeTable = null;
  let frame = 0;

  function topClearance() {
    let top = 0;
    for (const element of document.querySelectorAll(".document-header, .topbar, .controls")) {
      const position = getComputedStyle(element).position;
      const rect = element.getBoundingClientRect();
      if ((position === "sticky" || position === "fixed") &&
          rect.top <= top + 32 && rect.bottom > top) {
        top = rect.bottom;
      }
    }
    return Math.max(0, top);
  }

  function horizontalScroller(table) {
    for (let node = table.parentElement; node && node !== document.body; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowX;
      if (overflow === "auto" || overflow === "scroll") return node;
    }
    return table;
  }

  function copyAppearance(from, to) {
    const style = getComputedStyle(from);
    for (const property of [
      "background-color", "color", "font-family", "font-size", "font-weight",
      "line-height", "letter-spacing", "text-align", "vertical-align",
      "white-space", "padding", "border", "box-sizing",
    ]) {
      to.style.setProperty(property, style.getPropertyValue(property));
    }
  }

  function buildHeader(table) {
    bar.replaceChildren();
    const originalHead = table.tHead;
    const clone = table.cloneNode(false);
    const copiedHead = originalHead.cloneNode(true);
    clone.append(copiedHead);
    clone.style.width = `${table.getBoundingClientRect().width}px`;
    clone.style.tableLayout = "fixed";
    clone.style.borderCollapse = getComputedStyle(table).borderCollapse;
    clone.style.borderSpacing = getComputedStyle(table).borderSpacing;
    clone.style.margin = "0";
    const originalCells = originalHead.querySelectorAll("th, td");
    const copiedCells = copiedHead.querySelectorAll("th, td");
    originalCells.forEach((cell, index) => {
      const copy = copiedCells[index];
      copyAppearance(cell, copy);
      copy.style.width = `${cell.getBoundingClientRect().width}px`;
      copy.style.minWidth = copy.style.width;
      copy.style.maxWidth = copy.style.width;
    });
    bar.append(clone);
  }

  function update() {
    frame = 0;
    const top = topClearance();
    let candidate = null;
    for (const table of document.querySelectorAll("table")) {
      if (!table.tHead || !table.tHead.querySelector("th")) continue;
      const head = table.tHead.getBoundingClientRect();
      const body = table.getBoundingClientRect();
      if (head.height && head.top < top && body.bottom > top + head.height) {
        candidate = table;
      }
    }
    if (!candidate) {
      activeTable = null;
      bar.style.display = "none";
      return;
    }
    const scroller = horizontalScroller(candidate);
    const viewport = scroller.getBoundingClientRect();
    const left = Math.max(0, viewport.left);
    const width = Math.min(window.innerWidth - left, viewport.right - left);
    if (width <= 0) {
      bar.style.display = "none";
      return;
    }
    if (candidate !== activeTable ||
        bar.firstElementChild?.getBoundingClientRect().width !== candidate.getBoundingClientRect().width) {
      buildHeader(candidate);
      activeTable = candidate;
    }
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
    bar.style.width = `${width}px`;
    bar.style.height = `${candidate.tHead.getBoundingClientRect().height}px`;
    bar.firstElementChild.style.marginLeft = `${scroller === candidate ? 0 : -scroller.scrollLeft}px`;
    bar.style.display = "block";
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  document.addEventListener("scroll", schedule, true);
  document.addEventListener("click", schedule);
  window.addEventListener("resize", () => {
    activeTable = null;
    schedule();
  });
  window.addEventListener("hashchange", schedule);
  document.fonts?.ready.then(() => {
    activeTable = null;
    schedule();
  });
  schedule();
})();
