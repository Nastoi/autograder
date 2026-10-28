export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8000/api";


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

export async function fetchPaginatedPage<T>(
    url: string,
    errorMessage: string,
): Promise<PaginatedResponse<T>> {
    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
    });

    const text = await response.text();

    let data: unknown;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        throw new Error(
            response.ok
                ? "The server returned an incomplete response."
                : errorMessage,
        );
    }

    if (!response.ok) {
        const detail =
            data &&
                typeof data === "object" &&
                "detail" in data &&
                typeof data.detail === "string"
                ? data.detail
                : null;

        throw new Error(detail || errorMessage);
    }

    // Support older endpoints that may still return a plain array.
    if (Array.isArray(data)) {
        return {
            count: data.length,
            next: null,
            previous: null,
            results: data as T[],
        };
    }

    if (
        data &&
        typeof data === "object" &&
        "results" in data &&
        Array.isArray(data.results) &&
        "count" in data &&
        typeof data.count === "number"
    ) {
        return data as PaginatedResponse<T>;
    }

    throw new Error("Invalid paginated API response.");
}

export async function fetchAllPaginatedResults<T>(
    initialUrl: string,
    errorMessage: string,
): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = initialUrl;

    while (nextUrl) {
        const response = await fetch(nextUrl, {
            method: "GET",
            credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                typeof data?.detail === "string"
                    ? data.detail
                    : errorMessage,
            );
        }

        if (Array.isArray(data)) {
            results.push(...data);
            break;
        }

        if (
            data &&
            typeof data === "object" &&
            Array.isArray(data.results)
        ) {
            results.push(...data.results);
            if (data.next) {
                const parsedNext = new URL(data.next);
                const apiBase = new URL(API_BASE_URL, window.location.origin);

                nextUrl =
                    `${apiBase.origin}${parsedNext.pathname}${parsedNext.search}`;
            } else {
                nextUrl = null;
            }
            continue;
        }

        throw new Error("Invalid API response.");
    }

    return results;
}


