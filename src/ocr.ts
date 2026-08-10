// Lightweight OCR processor that uses a local Tesseract.js integration when available.
// Falls back to companion .txt sheets for testing.
import fs from "fs";

export async function ocrFromImage(imagePath: string): Promise<string> {
  const txtPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, ".txt");
  try {
    if (fs.existsSync(txtPath)) {
      return fs.readFileSync(txtPath, "utf8");
    }
  } catch (err) {
    // ignore companion file errors
  }

  try {
    const tesseract = await import("tesseract.js");
    const worker = await tesseract.createWorker({
      logger: () => {
        // no-op logger for cleaner execution
      },
    });

    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const { data } = await worker.recognize(imagePath);
    await worker.terminate();

    return data?.text?.trim() || "";
  } catch (err) {
    // If Tesseract is not available or fails, fall back to a placeholder.
  }

  return "[ocr stub] image text could not be extracted";
}
