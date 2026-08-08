import { useEffect, useState } from "react";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ??
    "http://localhost:8000/api";

const browserInfo = {
    current_url: window.location.href,
    document_referrer: document.referrer,
    ancestor_origins: Array.from(window.location.ancestorOrigins ?? []),
};

type DebugResponse = {
    authenticated: boolean;
    user: {
        id: number | null;
        username: string | null;
        email: string | null;
    };
    query_params: Record<string, unknown>;
    headers: {
        referer: string | null;
        origin: string | null;
        user_agent: string | null;
    };
};

export function LmsDebugPage() {
    const [data, setData] = useState<DebugResponse | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadDebugInfo() {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/lms/debug/request/`,
                    {
                        method: "GET",
                        credentials: "include",
                    },
                );

                if (!response.ok) {
                    throw new Error("Unable to load LMS debug information.");
                }

                const result = (await response.json()) as DebugResponse;
                setData(result);
            } catch (caughtError) {
                console.error("LMS debug fetch failed:", caughtError);

                setError(
                    caughtError instanceof Error
                        ? caughtError.message
                        : "Unable to load debug information.",
                );
            }
        }

        void loadDebugInfo();
    }, []);


    return (
        <main style={{ padding: "24px", fontFamily: "monospace" }}>
            <h1>LMS Request Debug</h1>

            {error && <p>{error}</p>}

            {data && (
                <pre
                    style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                    }}
                >
                    {JSON.stringify(
                        {
                            browser: browserInfo,
                            backend: data,
                        },
                        null,
                        2,
                    )}
                </pre>
            )}
        </main>
    );
}