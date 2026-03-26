import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onScanError }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      aspectRatio: 1.777778,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION
      ]
    };

    const scanner = new Html5QrcodeScanner("reader", config, false);
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        onScanSuccess(decodedText);
      },
      (errorMessage) => {
        // Filter out the "No MultiFormat Readers" noise which happens every frame 
        // when no barcode is detected. It's not a real error.
        if (errorMessage.includes("No MultiFormat Readers") || errorMessage.includes("NotFoundException")) {
          return;
        }
        if (onScanError) onScanError(errorMessage);
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner", error);
        });
      }
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-surface">
      <div id="reader" className="w-full"></div>
      <div className="p-4 text-center">
        <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">
          Align the book's barcode within the frame
        </p>
      </div>
    </div>
  );
};

export default BarcodeScanner;
