declare module "node-record-lpcm16" {
  interface RecordingOptions {
    sampleRate?: number;
    threshold?: number;
    verbose?: boolean;
    recordProgram?: "rec" | "arecord" | "sox";
    device?: string;
  }

  interface Recorder {
    start: (options?: RecordingOptions) => NodeJS.ReadableStream;
    stop: () => void;
  }

  const record: {
    start: (options?: RecordingOptions) => NodeJS.ReadableStream;
    stop: () => void;
  };

  export = record;
}
