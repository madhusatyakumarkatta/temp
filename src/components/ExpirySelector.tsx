"use client";

import React, { useState } from "react";
import { Clock } from "lucide-react";

export interface ExpiryOption {
  id: string;
  label: string;
  description: string;
  seconds: number;
}

export const PRESETS: ExpiryOption[] = [
  { id: "10m", label: "10 min", description: "Quick handoff", seconds: 10 * 60 },
  { id: "1h", label: "1 hour", description: "Brief sharing", seconds: 60 * 60 },
  { id: "6h", label: "6 hours", description: "Work session", seconds: 6 * 60 * 60 },
  { id: "24h", label: "24 hours", description: "Recommended", seconds: 24 * 60 * 60 },
  { id: "3d", label: "3 days", description: "Extended review", seconds: 3 * 24 * 60 * 60 },
  { id: "7d", label: "7 days", description: "Maximum duration", seconds: 7 * 24 * 60 * 60 },
];

interface ExpirySelectorProps {
  selectedDuration: string | number;
  onChange: (duration: string | number) => void;
  disabled?: boolean;
}

export function ExpirySelector({
  selectedDuration,
  onChange,
  disabled = false,
}: ExpirySelectorProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState("12");
  const [customUnit, setCustomUnit] = useState<"hours" | "days">("hours");

  const handlePresetSelect = (presetId: string) => {
    setIsCustom(false);
    onChange(presetId);
  };

  const handleCustomChange = (val: string, unit: "hours" | "days") => {
    setCustomValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      const multiplier = unit === "hours" ? 3600 : 86400;
      const seconds = Math.min(Math.max(Math.floor(num * multiplier), 300), 604800);
      onChange(seconds);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-neutral-500" />
          Expiry Duration
        </label>
        <span className="text-xs text-neutral-600">Files delete automatically at expiry</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {PRESETS.map((preset) => {
          const isSelected = !isCustom && selectedDuration === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => handlePresetSelect(preset.id)}
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg border text-center transition-all ${
                isSelected
                  ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                  : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-800"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className="text-xs font-semibold">{preset.label}</span>
              <span
                className={`text-[10px] mt-0.5 ${
                  isSelected ? "text-neutral-300" : "text-neutral-600"
                }`}
              >
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => {
            setIsCustom(!isCustom);
            if (!isCustom) {
              handleCustomChange(customValue, customUnit);
            } else {
              onChange("24h");
            }
          }}
          className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2 transition-colors cursor-pointer"
        >
          {isCustom ? "← Use standard presets" : "Need a custom duration?"}
        </button>

        {isCustom && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max={customUnit === "hours" ? "168" : "7"}
              value={customValue}
              onChange={(e) => {
                setCustomValue(e.target.value);
                handleCustomChange(e.target.value, customUnit);
              }}
              className="w-16 px-2 py-1 text-xs border border-neutral-300 rounded bg-white text-center font-medium"
            />
            <select
              value={customUnit}
              onChange={(e) => {
                const unit = e.target.value as "hours" | "days";
                setCustomUnit(unit);
                handleCustomChange(customValue, unit);
              }}
              className="text-xs border border-neutral-300 rounded px-2 py-1 bg-white"
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
