
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

    const text = await response.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!response.ok) {
        console.error("Supabase request failed:", response.status, data);
        throw new Error("A secure database operation failed.");
    }

    return data;
}

export async function sendEmail({ to, subject, html }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.ACADEMY_FROM_EMAIL;

    if (!apiKey || !from) {
        throw new Error("Email environment variables are missing.");
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
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
