
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        },
        body: JSON.stringify(body)
    };
}

export function readBody(event) {
    try {
        return JSON.parse(event.body || "{}");
    } catch {
        return {};
    }
}

export function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function supabaseRequest(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Supabase server environment variables are missing.");
    }

    const response = await fetch(
        `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`,
        {
            ...options,
            headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        }
    );

    const responseText = await response.text();
    let data = null;

    try {
        data = responseText ? JSON.parse(responseText) : null;
    } catch {
        data = responseText;
    }

    if (!response.ok) {
        console.error("Supabase request failed:", response.status, data);
        throw new Error("A secure database operation failed.");
    }

    return data;
}

export async function sendEmail({
    to,
    subject,
    html,
    idempotencyKey
}) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.ACADEMY_FROM_EMAIL;

    if (!apiKey || !from) {
        throw new Error("Email environment variables are missing.");
    }

    const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    };

    if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({ from, to, subject, html })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("Email delivery failed:", response.status, error);
        throw new Error("We could not send the email. Please try again.");
    }

    return response.json();
}

export async function hashCode(code) {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(code)
    );

    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

export function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

export function methodNotAllowed(event, expected = "POST") {
    if (event.httpMethod === "OPTIONS") {
        return json(204, {});
    }

    if (event.httpMethod !== expected) {
        return json(405, { error: "Method not allowed." });
    }

    return null;
}

/*
 * TIKTOK EVENTS API
 *
 * Server-side event sender.
 * The access token must remain in Netlify environment variables.
 */

export async function sendTikTokEvent({
    event,
    eventId,
    email = "",
    pageUrl = "https://nextbranch.com.ng/academy/",
    referrer = "",
    ip = "",
    userAgent = "",
    ttclid = "",
    ttp = "",
    value = 1500
}) {
    const pixelId = process.env.TIKTOK_PIXEL_ID;
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
        console.warn("TikTok is not configured. Event skipped:", event);
        return false;
    }

    if (!event || !eventId) {
        console.warn("TikTok event missing event name or event ID.");
        return false;
    }

    const user = {};

    // TikTok requires SHA-256 hashed email.
    if (email) {
        const normalizedEmail = String(email).trim().toLowerCase();

        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(normalizedEmail)
        );

        user.email = Array.from(new Uint8Array(digest))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    if (ip) {
        user.ip = String(ip).split(",")[0].trim();
    }

    if (userAgent) {
        user.user_agent = userAgent;
    }

    if (ttclid) {
        user.ttclid = String(ttclid);
    }

    if (ttp) {
        user.ttp = String(ttp);
    }

    const testEventCode = process.env.TIKTOK_TEST_EVENT_CODE;

    const payload = {
        event_source: "web",
        event_source_id: pixelId,
        ...(testEventCode ? { test_event_code: testEventCode } : {}),
        data: [
            {
                event,
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                user,
                properties: {
                    currency: "NGN",
                    value,
                    content_type: "product",
                    content_id: "nextbranch_academy_first_website_ai",
                    content_name: "Build Your First Website Using AI"
                },
                page: {
                    url: pageUrl,
                    ...(referrer ? { referrer } : {})
                }
            }
        ]
    };

    try {
        const response = await fetch(
            "https://business-api.tiktok.com/open_api/v1.3/event/track/",
            {
                method: "POST",
                headers: {
                    "Access-Token": accessToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.code !== 0) {
            console.error(
                "TikTok Events API rejected event:",
                event,
                response.status,
                result
            );

            return false;
        }

        console.info("TikTok event accepted:", event, eventId);

        return true;

    } catch (error) {
        console.error("TikTok Events API request failed:", event, error);
        return false;
    }
}

/*
 * Extract tracking information from the Netlify request.
 */

export function getTikTokRequestData(event, body = {}) {
    const headers = event.headers || {};

    const getHeader = name => {
        const key = Object.keys(headers).find(
            item => item.toLowerCase() === name.toLowerCase()
        );

        return key ? headers[key] : "";
    };

    const pageUrl =
        typeof body.page_url === "string" &&
            body.page_url.startsWith("https://nextbranch.com.ng/")
            ? body.page_url
            : "https://nextbranch.com.ng/academy/";

    const referrer =
        typeof body.referrer === "string" &&
            body.referrer.startsWith("https://")
            ? body.referrer
            : "";

    return {
        ip: getHeader("x-nf-client-connection-ip") ||
            getHeader("x-forwarded-for") ||
            "",

        userAgent: getHeader("user-agent") || "",

        ttclid: typeof body.ttclid === "string"
            ? body.ttclid
            : "",

        ttp: typeof body.ttp === "string"
            ? body.ttp
            : "",

        pageUrl,
        referrer
    };
}
