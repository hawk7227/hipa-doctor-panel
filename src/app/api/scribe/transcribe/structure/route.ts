// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { NextRequest, NextResponse } from 'next/server'
import { requireDoctor } from '@/lib/api-auth'
export async function POST(req: NextRequest) {
  const auth = await requireDoctor(req); if (auth instanceof NextResponse) return auth;
  try {

    const { text } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No transcript provided." },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5-medical-mini",
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: `
Convert the following raw dictation into a structured clinical note.

Return ONLY:

HPI:
ROS:
PE:
Assessment:
Plan:

Transcript:
${text}
            `,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const data = await response.json();

    return NextResponse.json({
      structured: data.choices?.[0]?.message?.content || "",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error processing request" },
      { status: 500 }
    );
  }
}
