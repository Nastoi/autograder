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
            nextUrl = data.next;
            continue;
        }

        throw new Error("Invalid API response.");
    }

    return results;
}


