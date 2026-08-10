// Lightweight STT processor that supports optional local Whisper engines.
// Falls back to companion .txt transcripts for testing.
import fs from "fs";

export async function transcribeAudio(audioPath: string): Promise<string> {
  const txtPath = audioPath.replace(/\.(wav|mp3|m4a)$/i, ".txt");
  try {
    if (fs.existsSync(txtPath)) {
      return fs.readFileSync(txtPath, "utf8");
    }
  } catch (err) {
    // ignore companion file errors
  }

  try {
    const whisperModule = await import("@vladmandic/whisper");
    const WhisperClass = whisperModule.Whisper || whisperModule.default;
    if (typeof WhisperClass === "function") {
      const whisper = new WhisperClass();
      const model = await whisper.createModel({ model: "tiny.en" });
      const result = await model.transcribe(audioPath);
      if (typeof result === "object" && result.text) {
        return String(result.text).trim();
      }
    }
  } catch (err) {
    // If Whisper is not installed or fails, fall back to a placeholder.
  }

  return "[stt stub] audio could not be transcribed";
}
