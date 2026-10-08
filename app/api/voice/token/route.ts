import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const apiKey = process.env.TELNYX_API_KEY || process.env.NEXT_PUBLIC_TELNYX_API_KEY;
        const connectionId = process.env.TELNYX_CREDENTIAL_CONNECTION_ID || process.env.NEXT_PUBLIC_TELNYX_CREDENTIAL_CONNECTION_ID;

        if (!apiKey) {
            return NextResponse.json(
                { error: "Telnyx API key not configured on server" },
                { status: 500 }
            );
        }

        // 1. Create a telephony credential with connection_id
        const credRes = await fetch("https://api.telnyx.com/v2/telephony_credentials", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                connection_id: connectionId || "3054388666689389802"
            })
        });

        if (!credRes.ok) {
            const errData = await credRes.json().catch(() => ({}));
            return NextResponse.json(
                { error: errData.errors?.[0]?.detail || "Failed to create telephony credential" },
                { status: credRes.status }
            );
        }

        const credData = await credRes.json();
        const credId = credData.data?.id;

        if (!credId) {
            return NextResponse.json(
                { error: "No credential ID returned from Telnyx" },
                { status: 500 }
            );
        }

        // 2. Generate a WebRTC login token for this credential
        const tokenRes = await fetch(`https://api.telnyx.com/v2/telephony_credentials/${credId}/token`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            }
        });

        if (!tokenRes.ok) {
            const errData = await tokenRes.json().catch(() => ({}));
            return NextResponse.json(
                { error: errData.errors?.[0]?.detail || "Failed to generate WebRTC token" },
                { status: tokenRes.status }
            );
        }

        const tokenText = await tokenRes.text();
        // Clean up token text if wrapped in quotes or JSON
        let token = tokenText.trim();
        try {
            const parsed = JSON.parse(tokenText);
            if (typeof parsed === "string") token = parsed;
            else if (parsed.token) token = parsed.token;
        } catch (e) {}

        return NextResponse.json({
            token,
            credential_id: credId,
            sip_username: credData.data?.sip_username
        });

    } catch (error: any) {
        console.error("Telnyx token generation error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
