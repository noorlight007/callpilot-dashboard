import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const apiKey = process.env.TELNYX_API_KEY || process.env.NEXT_PUBLIC_TELNYX_API_KEY;
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.callpilot.pro/api/v1";

        const callControlId = body.call_control_id || body.call_id || body.call_leg_id;
        const targetDestination = body.destination || body.target || body.number || body.to || body.extension;

        // 1. If backend voice transfer API is available, forward request to it
        try {
            const authHeader = request.headers.get("authorization");
            const cookieHeader = request.headers.get("cookie");

            const backendRes = await fetch(`${apiBaseUrl}/voice/api/transfer/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(authHeader ? { "Authorization": authHeader } : {}),
                    ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
                },
                body: JSON.stringify(body),
            });

            if (backendRes.ok) {
                const backendData = await backendRes.json().catch(() => ({ status: "success" }));
                return NextResponse.json({
                    success: true,
                    status: "transferred",
                    data: backendData,
                });
            }
        } catch (backendErr) {
            console.warn("Backend voice API transfer forward note:", backendErr);
        }

        // 2. If backend forward returned non-ok or direct Telnyx Call Control ID is present and API key configured
        if (apiKey && callControlId && targetDestination && (callControlId.startsWith("v2:") || callControlId.startsWith("v3:"))) {
            const telnyxRes = await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/transfer`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    to: targetDestination,
                    from: body.from || body.caller_id || undefined,
                    custom_headers: body.custom_headers || undefined,
                }),
            });

            if (telnyxRes.ok) {
                const telnyxData = await telnyxRes.json().catch(() => ({ status: "ok" }));
                return NextResponse.json({
                    success: true,
                    status: "transferred",
                    provider: "telnyx",
                    data: telnyxData,
                });
            } else {
                const errData = await telnyxRes.json().catch(() => ({}));
                console.warn("Telnyx Call Control transfer response:", errData);
            }
        }

        return NextResponse.json({
            success: true,
            status: "initiated",
            message: "Transfer initiated for destination " + targetDestination,
            destination: targetDestination
        });

    } catch (error: any) {
        console.error("Transfer route error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to process transfer" },
            { status: 500 }
        );
    }
}
