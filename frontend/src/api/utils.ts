export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "/api";


export type PaginatedResponse<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export function extractResults<T>(
    data: T[] | PaginatedResponse<T>,
): T[] {
    if (Array.isArray(data)) {
        return data;
    }

    if (
        data &&
        typeof data === "object" &&
        "results" in data &&
        Array.isArray(data.results)
    ) {
        return data.results;
    }

    throw new Error("Invalid API response.");
}



export async function fetchAllPaginatedResults<T>(
    initialUrl: string,
    errorMessage: string,
): Promise<T[]> {
    const results: T[] = [];
    const apiBase = new URL(API_BASE_URL, window.location.origin);

    // DRF may emit an absolute `next` URL using the Docker/internal host.
    // Never ask the browser to follow that host directly. Keep every page
    // request on the same public API origin used for the first request.
    const normalisePageUrl = (url: string): string => {
        const parsed = new URL(url, window.location.origin);
        return `${apiBase.origin}${parsed.pathname}${parsed.search}`;
    };

    let nextUrl: string | null = normalisePageUrl(initialUrl);

    while (nextUrl) {
        let response: Response;

        try {
            response = await fetch(nextUrl, {
                method: "GET",
                credentials: "include",
            });
        } catch {
            throw new Error(errorMessage);
        }

        let data: unknown;
        try {
            data = await response.json();
        } catch {
            throw new Error(errorMessage);
        }

        if (!response.ok) {
            const detail =
                data &&
                typeof data === "object" &&
                "detail" in data &&
                typeof data.detail === "string"
                    ? data.detail
                    : errorMessage;
            throw new Error(detail);
        }

        if (Array.isArray(data)) {
            results.push(...(data as T[]));
            break;
        }

        if (
            data &&
            typeof data === "object" &&
            "results" in data &&
            Array.isArray(data.results)
        ) {
            results.push(...(data.results as T[]));

            const rawNext =
                "next" in data && typeof data.next === "string"
                    ? data.next
                    : null;

            nextUrl = rawNext ? normalisePageUrl(rawNext) : null;
            continue;
        }

        throw new Error("Invalid API response.");
    }

    return results;
}
