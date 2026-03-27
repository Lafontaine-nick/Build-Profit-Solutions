/**
 * pdfkit / @react-pdf/renderer use Buffer with "ascii" encoding.
 * Hermes + RN often expose a minimal Buffer without full Node encodings.
 */
import { Buffer } from "buffer";

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
g.Buffer = Buffer;

type TextDecoderInput = ArrayBuffer | ArrayBufferView | undefined;

const NativeTextDecoder = globalThis.TextDecoder;

const normalizeBytes = (input: TextDecoderInput) => {
  if (!input) {
    return new Uint8Array(0);
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
};

const bytesToString = (bytes: Uint8Array) => {
  let result = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    result += String.fromCharCode(...Array.from(chunk));
  }
  return result;
};

/**
 * Expo's TextDecoder only supports UTF-8, but fontkit asks for legacy encodings
 * such as "ascii" at module load time. That crashes React PDF initialization.
 * For unsupported encodings, fall back to a byte-to-codepoint decoder instead of
 * throwing; this is sufficient for font metadata and standard built-in fonts.
 */
class LegacyCompatibleTextDecoder {
  encoding: string;
  fatal: boolean;
  ignoreBOM: boolean;
  private delegate?: TextDecoder;

  constructor(label = "utf-8", options?: TextDecoderOptions) {
    this.encoding = String(label || "utf-8").trim().toLowerCase();
    this.fatal = !!options?.fatal;
    this.ignoreBOM = !!options?.ignoreBOM;

    if (NativeTextDecoder) {
      try {
        this.delegate = new NativeTextDecoder(label, options);
        this.encoding = this.delegate.encoding || this.encoding;
      } catch {
        this.delegate = undefined;
      }
    }
  }

  decode(input?: TextDecoderInput, _options?: TextDecodeOptions) {
    if (this.delegate) {
      return this.delegate.decode(input, _options);
    }
    return bytesToString(normalizeBytes(input));
  }
}

(globalThis as typeof globalThis & { TextDecoder?: typeof TextDecoder }).TextDecoder =
  LegacyCompatibleTextDecoder as unknown as typeof TextDecoder;
