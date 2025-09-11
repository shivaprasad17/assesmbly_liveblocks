import { NextResponse } from "next/server";
import record from "node-record-lpcm16";
import fs from "fs";

export async function GET(request: Request) {
  const file = fs.createWriteStream("output.wav", { encoding: "binary" });

  const recording = record.start({
    sampleRate: 16000,
    threshold: 0,
    verbose: true,
    recordProgram: "rec", // "rec", "arecord", "sox"
  });

  recording.pipe(file);

  // Stop after 5 seconds
  setTimeout(() => {
    record.stop();
  }, 5000);

  return NextResponse.json({ message: "Recording started, will stop after 5s" });
}
