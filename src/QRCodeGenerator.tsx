import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeGeneratorProps {
  value?: string;
  size?: number;
  className?: string;
}

export default function QRCodeGenerator({ 
  value = "https://linktr.ee/Nabil_elsareaa?utm_source=qr_code", 
  size = 130, 
  className = "" 
}: QRCodeGeneratorProps) {
  const [qrSrc, setQrSrc] = useState<string>("");
  const [errorCode, setErrorCode] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(
      value,
      {
        width: size,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "H", // High error correction to support central logo
      },
      (err, url) => {
        if (err) {
          console.error("Failed to generate QR Code:", err);
          if (active) setErrorCode(true);
          return;
        }
        if (active) {
          setQrSrc(url);
          setErrorCode(false);
        }
      }
    );

    return () => {
      active = false;
    };
  }, [value, size]);

  if (errorCode) {
    return (
      <div className="flex items-center justify-center border border-dashed border-rose-200 text-rose-500 rounded-xl p-4 text-[11px] font-bold">
        فشل توليد رمز الاستجابة السريعة (QR)
      </div>
    );
  }

  if (!qrSrc) {
    return (
      <div className="flex flex-col items-center justify-center p-4 animate-pulse" style={{ width: size, height: size }}>
        <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-[9px] text-slate-400 mt-1 font-mono">جاري التوليد...</span>
      </div>
    );
  }

  // Calculate proportional size for the center logo box
  const logoBoxSize = Math.max(34, Math.floor(size * 0.28));

  return (
    <div className={`p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm inline-block relative ${className}`} style={{ width: size, height: size }}>
      <img 
        src={qrSrc} 
        alt="Scan QR Code" 
        className="object-contain w-full h-full"
        referrerPolicy="no-referrer"
      />
      {/* HIGH-FIDELITY CHIPPED LOGO PLACED EXACTLY IN THE MIDDLE OF THE QR CODE */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="bg-white p-[3px] rounded-lg border border-slate-200 shadow-md flex items-center justify-center"
          style={{ width: logoBoxSize, height: logoBoxSize }}
        >
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-slate-950">
            {/* 5-pointed crown star radiating branches */}
            {/* Top vertical branch */}
            <line x1="50" y1="40" x2="50" y2="15" stroke="currentColor" strokeWidth="9.5" strokeLinecap="round" />
            {/* Top-Right branch */}
            <line x1="50" y1="40" x2="74" y2="28" stroke="currentColor" strokeWidth="9.5" strokeLinecap="round" />
            {/* Top-Left branch */}
            <line x1="50" y1="40" x2="26" y2="28" stroke="currentColor" strokeWidth="9.5" strokeLinecap="round" />
            {/* Bottom-Right branch */}
            <line x1="50" y1="40" x2="66" y2="58" stroke="currentColor" strokeWidth="9.5" strokeLinecap="round" />
            {/* Bottom-Left branch */}
            <line x1="50" y1="40" x2="34" y2="58" stroke="currentColor" strokeWidth="9.5" strokeLinecap="round" />
            
            {/* Center meeting point anchor */}
            <circle cx="50" cy="40" r="4" fill="currentColor" />

            {/* Bottom trunk bar separated by a neat balanced gap */}
            <line x1="50" y1="67" x2="50" y2="92" stroke="currentColor" strokeWidth="10.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
