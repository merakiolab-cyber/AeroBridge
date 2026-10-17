/**
 * Global ECMAScript polyfills for modern TypedArray proposals (toHex, setFromHex, toBase64)
 * required by pdfjs-dist v6+ in WebView2 and browser environments.
 */

declare global {
  interface Uint8Array {
    toHex?(): string;
    setFromHex?(hex: string): { read: number; written: number };
    toBase64?(): string;
  }
}

if (typeof Uint8Array !== 'undefined') {
  if (!Uint8Array.prototype.toHex) {
    Uint8Array.prototype.toHex = function (): string {
      let hex = '';
      const len = this.length;
      for (let i = 0; i < len; i++) {
        hex += this[i].toString(16).padStart(2, '0');
      }
      return hex;
    };
  }

  if (!Uint8Array.prototype.setFromHex) {
    Uint8Array.prototype.setFromHex = function (hex: string): { read: number; written: number } {
      const match = hex.match(/.{1,2}/g) || [];
      let written = 0;
      for (let i = 0; i < Math.min(this.length, match.length); i++) {
        this[i] = parseInt(match[i], 16);
        written++;
      }
      return { read: written * 2, written };
    };
  }

  if (!Uint8Array.prototype.toBase64) {
    Uint8Array.prototype.toBase64 = function (): string {
      let binary = '';
      const len = this.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(this[i]);
      }
      return btoa(binary);
    };
  }
}

export {};
