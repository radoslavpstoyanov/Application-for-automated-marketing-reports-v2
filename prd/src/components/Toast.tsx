"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  duration?: number;
  type?: "error" | "success";
  onClose: () => void;
}

export function Toast({ message, duration = 3000, type = "error", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast ${type}`}>
      {type === "error" && <span style={{ marginRight: "0.5rem", fontWeight: "bold" }}>!</span>}
      {type === "success" && <span style={{ marginRight: "0.5rem", fontWeight: "bold" }}>✓</span>}
      {message}
    </div>
  );
}
