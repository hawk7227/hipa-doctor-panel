import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Read audio from the request
    const form = await req.formData();
    const audio = form.get("audio") as Blob;

    if (!audio) {
      return NextResponse.json(
        { error: "No audio file received." },
        { status: 400 }
      );
    }

    // Send audio to OpenAI Whisper API
    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: (() => {
          const fd = new FormData();
          fd.append("file", audio, "recording.webm");
          fd.append("model", "whisper-1"); // Hosted Whisper model
          fd.append("temperature", "0");
          return fd;
        })(),
      }
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      return NextResponse.json(
        { error: `Whisper API failed: ${errorText}` },
        { status: 500 }
      );
    }

    const data = await whisperResponse.json();
    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
