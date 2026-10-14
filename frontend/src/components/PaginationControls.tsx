type PaginationControlsProps = {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
};

export const DEFAULT_TABLE_PAGE_SIZE = 50;

export function PaginationControls({
  currentPage,
  totalItems,
  onPageChange,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) {
    return null;
  }

  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const firstItem = (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  const startPage = Math.max(1, Math.min(safePage - 2, totalPages - 4));
  const endPage = Math.min(totalPages, Math.max(5, safePage + 2));
  const pages = Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage + index,
  );

  return (
    <div className="table-pagination" aria-label="Table pagination">
      <span className="table-pagination-summary">
        Showing {firstItem}–{lastItem} of {totalItems}
      </span>

      <div className="table-pagination-actions">
        <button
          type="button"
          className="table-pagination-button"
          disabled={safePage === 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Previous
        </button>

        {pages.map((page) => (
          <button
            key={page}
            type="button"
            className={`table-pagination-button ${page === safePage ? "active" : ""}`}
            aria-current={page === safePage ? "page" : undefined}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          className="table-pagination-button"
          disabled={safePage === totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
