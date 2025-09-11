import type { NextApiRequest, NextApiResponse } from "next";
// import * as record from "node-record-lpcm16";
import record from "node-record-lpcm16";
import fs from "fs";

export async function GET(req: NextApiRequest, res: NextApiResponse) {
  const file = fs.createWriteStream("output.wav", { encoding: "binary" });

  const recording = record.start({
    sampleRate: 16000,
    threshold: 0,
    verbose: true,
    recordProgram: "rec", // "rec", "arecord", "sox"
  });

  recording.pipe(file);

  setTimeout(() => {
    record.stop();
    res.status(200).json({ message: "Recording saved to output.wav" });
  }, 5000); // record for 5 seconds
}