import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onScanError }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "reader";

  const startScanner = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerId);
      }

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.0, // Square aspect ratio is often better for mobile focus
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
        ]
      };

      await html5QrCodeRef.current.start(
        { facingMode: "environment" }, // Prioritize back camera
        config,
        (decodedText) => {
          // Success! Stop scanning and return result
          stopScanner().then(() => {
            onScanSuccess(decodedText);
          });
        },
        (errorMessage) => {
          // Filter common "not found" noise
          if (errorMessage.includes("No MultiFormat Readers") || errorMessage.includes("NotFoundException")) {
            return;
          }
          // We don't set error state here to avoid flickering, 
          // but we can log it or call the prop
          if (onScanError) onScanError(errorMessage);
        }
      );
      
      setIsScanning(true);
    } catch (err: any) {
      console.error("Camera start error:", err);
      setError("Could not access camera. Please ensure you've granted permissions.");
    } finally {
      setIsLoading(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  const switchCamera = async () => {
    await stopScanner();
    // In a real app, we might want to cycle through available cameras,
    // but for now, just restarting with environment mode is the best bet for mobile.
    startScanner();
  };

  useEffect(() => {
    // Auto-start on mount if possible, but mobile often requires user interaction
    // So we'll provide a button instead for better reliability
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="w-full space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border bg-surface shadow-inner">
        <div id={scannerId} className="w-full h-full"></div>
        
        {!isScanning && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-bg/40 backdrop-blur-sm">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Camera className="w-8 h-8 text-accent" />
            </div>
            <div className="space-y-2">
              <h4 className="font-serif text-lg font-bold text-white">Ready to Scan</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Tap the button below to activate your camera and scan a book's barcode.
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg/60 backdrop-blur-md">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
            <p className="mt-4 text-[10px] uppercase tracking-widest font-bold text-accent">Initializing Camera...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-red-500/10 backdrop-blur-md border border-red-500/20">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-sm text-red-400 font-medium">{error}</p>
            <button 
              onClick={startScanner}
              className="px-6 py-2 bg-red-500 text-white rounded-full text-xs font-bold uppercase tracking-widest"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {!isScanning ? (
          <button 
            onClick={startScanner}
            disabled={isLoading}
            className="flex-1 btn-primary flex items-center justify-center gap-3 py-4"
          >
            <Camera className="w-5 h-5" />
            <span>Start Camera</span>
          </button>
        ) : (
          <>
            <button 
              onClick={stopScanner}
              className="flex-1 btn-secondary flex items-center justify-center gap-3 py-4"
            >
              <span>Stop Camera</span>
            </button>
            <button 
              onClick={switchCamera}
              className="p-4 bg-surface border border-border rounded-2xl text-text-muted hover:text-white transition-colors"
              title="Switch Camera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">
          {isScanning ? "Align barcode within the frame" : "Camera access required"}
        </p>
      </div>
    </div>
  );
};

export default BarcodeScanner;
