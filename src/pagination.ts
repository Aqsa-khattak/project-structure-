export interface PaginationOptions {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
  
  siblings?: number;
}

export function buildPageList(current: number, total: number, siblings = 1): (number | "gap")[] {
  if (total <= 1) return total === 1 ? [1] : [];

  const pages = new Set<number>([1, total]);
  for (let p = current - siblings; p <= current + siblings; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];

  sorted.forEach((page, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && page - prev > 1) out.push("gap");
    out.push(page);
  });

  return out;
}

export function renderPagination(container: HTMLElement, opts: PaginationOptions): void {
  const { currentPage, totalPages, onChange, siblings = 1 } = opts;

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const items = buildPageList(currentPage, totalPages, siblings)
    .map((item) =>
      item === "gap"
        ? `<span class="page-gap">…</span>`
        : `<button class="page-btn${item === currentPage ? " active" : ""}"
             data-page="${item}"
             ${item === currentPage ? 'aria-current="page"' : ""}>${item}</button>`
    )
    .join("");

  container.innerHTML = `
    <nav class="pagination" aria-label="Pagination">
      <button class="page-btn page-arrow" data-page="${currentPage - 1}" ${
        currentPage === 1 ? "disabled" : ""
      } aria-label="Previous page">‹</button>
      ${items}
      <button class="page-btn page-arrow" data-page="${currentPage + 1}" ${
        currentPage === totalPages ? "disabled" : ""
      } aria-label="Next page">›</button>
    </nav>
    <p class="page-status">Page ${currentPage} of ${totalPages}</p>
  `;

  container.querySelectorAll<HTMLButtonElement>(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = Number(btn.dataset.page);
      if (!page || page === currentPage || page < 1 || page > totalPages) return;
      onChange(page);
    });
  });
}
