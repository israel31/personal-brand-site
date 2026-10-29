
import {
    json,
    readBody,
    normalizeEmail,
    validEmail,
    supabaseRequest,
    hashCode,
    methodNotAllowed
} from "./academy-utils.js";

const PRODUCT_CODE = "nextbranch_academy_first_website_ai";

export async function handler(event) {
    const methodError = methodNotAllowed(event);
    if (methodError) return methodError;

    try {
        const { email: rawEmail, code } = readBody(event);
        const email = normalizeEmail(rawEmail);
        const submittedCode = String(code || "");

        if (!validEmail(email) || !/^\d{6}$/.test(submittedCode)) {
            return json(400, {
                success: false,
                error: "Enter your email and the six-digit code."
            });
        }

        const baseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const pdfPath = process.env.ACADEMY_PDF_PATH || "first-website-ai.pdf";
        const videoId = process.env.ACADEMY_VIDEO_ID;

        if (
            !baseUrl ||
            !serviceKey ||
            !videoId ||
            !/^[A-Za-z0-9_-]{11}$/.test(videoId)
        ) {
            console.error("Academy PDF or video environment variables are not configured.");

            return json(503, {
                success: false,
                error: "Course materials are not configured yet. Please contact support."
            });
        }

        // Confirm that this email has a paid course purchase.
        const purchases = await supabaseRequest(
            `academy_purchases?email=eq.${encodeURIComponent(email)}&status=eq.paid&product_code=eq.${PRODUCT_CODE}&select=reference&limit=1`
        );

        if (!purchases?.length) {
            return json(401, {
                success: false,
                error: "The code is invalid or has expired."
            });
        }

        const now = new Date().toISOString();

        const codes = await supabaseRequest(
            `academy_access_codes?email=eq.${encodeURIComponent(email)}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}&select=id,code_hash,attempts&order=created_at.desc&limit=1`
        );

        if (!codes?.length || Number(codes[0].attempts) >= 5) {
            return json(401, {
                success: false,
                error: "The code is invalid or has expired. Request a new one."
            });
        }

        const savedCode = codes[0];
        const submittedHash = await hashCode(submittedCode);

        if (submittedHash !== savedCode.code_hash) {
            await supabaseRequest(
                `academy_access_codes?id=eq.${encodeURIComponent(savedCode.id)}&used_at=is.null`,
                {
                    method: "PATCH",
                    headers: {
                        Prefer: "return=minimal"
                    },
                    body: JSON.stringify({
                        attempts: Number(savedCode.attempts || 0) + 1
                    })
                }
            );

            return json(401, {
                success: false,
                error: "The code is invalid or has expired."
            });
        }

        // Prepare the private, temporary PDF URL before consuming the code.
        const storageResponse = await fetch(
            `${baseUrl.replace(/\/$/, "")}/storage/v1/object/sign/academy-assets/${pdfPath
                .split("/")
                .map(encodeURIComponent)
                .join("/")}`,
            {
                method: "POST",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    expiresIn: 600
                })
            }
        );

        const storageData = await storageResponse.json();

        if (!storageResponse.ok || !storageData.signedURL) {
            console.error("Could not sign PDF URL:", storageData);

            return json(500, {
                success: false,
                error: "Could not prepare the PDF. Please try again."
            });
        }

        const signedUrl = storageData.signedURL.startsWith("http")
            ? storageData.signedURL
            : `${baseUrl.replace(/\/$/, "")}/storage/v1${storageData.signedURL.startsWith("/")
                ? storageData.signedURL
                : `/${storageData.signedURL}`}`;

        // Consume the code only after the course materials are prepared.
        // The filter prevents reuse of a code already consumed by another request.
        const consumed = await supabaseRequest(
            `academy_access_codes?id=eq.${encodeURIComponent(savedCode.id)}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}&select=id`,
            {
                method: "PATCH",
                headers: {
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    used_at: new Date().toISOString()
                })
            }
        );

        if (!consumed?.length) {
            return json(401, {
                success: false,
                error: "This code has already been used or has expired. Request a new one."
            });
        }

        return json(200, {
            success: true,
            video_id: videoId,
            pdf_url: signedUrl
        });
    } catch (error) {
        console.error("Verify academy access error:", error);

        return json(500, {
            success: false,
            error: "Unable to verify access right now. Please try again."
        });
    }
}
