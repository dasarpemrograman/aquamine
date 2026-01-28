"use client";

import React from "react";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface CVDetectionOverlayProps {
  bboxes: BoundingBox[];
  severity: "none" | "mild" | "moderate" | "severe" | "default" | string;
  containerSize: {
    width: number;
    height: number;
  };
  originalSize: {
    width: number;
    height: number;
  };
}

export default function CVDetectionOverlay({
  bboxes,
  severity,
  containerSize,
  originalSize,
}: CVDetectionOverlayProps) {
  if (
    !containerSize.width ||
    !containerSize.height ||
    !originalSize.width ||
    !originalSize.height
  ) {
    return null;
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "none":
        return {
          bg: "bg-emerald-500",
          text: "text-emerald-500",
          border: "border-emerald-500",
          badge:
            "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "mild":
        return {
          bg: "bg-yellow-500",
          text: "text-yellow-500",
          border: "border-yellow-500",
          badge:
            "bg-yellow-50 text-yellow-700 border-yellow-200",
        };
      case "moderate":
        return {
          bg: "bg-orange-500",
          text: "text-orange-500",
          border: "border-orange-500",
          badge:
            "bg-orange-50 text-orange-700 border-orange-200",
        };
      case "severe":
        return {
          bg: "bg-rose-500",
          text: "text-rose-500",
          border: "border-rose-500",
          badge:
            "bg-rose-50 text-rose-700 border-rose-200",
        };
      default:
        return {
          bg: "bg-slate-500",
          text: "text-slate-500",
          border: "border-slate-500",
          badge:
            "bg-slate-100 text-slate-700 border-slate-200",
        };
    }
  };

  const styles = getSeverityStyles(severity);
  const scaleX = containerSize.width / originalSize.width;
  const scaleY = containerSize.height / originalSize.height;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {bboxes.map((bbox, i) => (
        <div
          key={i}
          className={`absolute border-2 ${styles.border} transition-opacity duration-500`}
          style={{
            left: `${bbox.x * scaleX}px`,
            top: `${bbox.y * scaleY}px`,
            width: `${bbox.width * scaleX}px`,
            height: `${bbox.height * scaleY}px`,
            boxShadow: "0 0 20px rgba(0,0,0,0.1)",
          }}
        >
          <div
            className={`absolute -top-7 left-0 px-2 py-0.5 text-xs font-bold text-white ${styles.bg} rounded-sm shadow-sm whitespace-nowrap`}
          >
            {(bbox.confidence * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}
