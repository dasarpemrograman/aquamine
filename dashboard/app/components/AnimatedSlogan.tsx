"use client";
import { useEffect, useState } from "react";

const slogans = ["Smart", "Clean", "Guard"];
const defaultText = "AI";
const typingSpeed = 80; // ms per character
const displayTime = 1800; // ms to show full word before next

export default function AnimatedSlogan() {
  const [display, setDisplay] = useState(defaultText);
  const [phase, setPhase] = useState("typing");
  const [index, setIndex] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDefault, setIsDefault] = useState(true);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (phase === "typing") {
      const word = isDefault ? defaultText : slogans[index];
      if (charIdx < word.length) {
        timeout = setTimeout(() => {
          setDisplay(word.slice(0, charIdx + 1));
          setCharIdx(charIdx + 1);
        }, typingSpeed);
      } else {
        timeout = setTimeout(() => setPhase("waiting"), displayTime);
      }
    } else if (phase === "waiting") {
      timeout = setTimeout(() => {
        if (isDefault) {
          setIsDefault(false);
          setCharIdx(0);
          setIndex(0);
        } else if (index < slogans.length - 1) {
          setIndex(index + 1);
          setCharIdx(0);
        } else {
          setIsDefault(true);
          setCharIdx(0);
        }
        setPhase("typing");
      }, 500);
    }
    return () => clearTimeout(timeout);
  }, [phase, charIdx, index, isDefault]);

  return (
    <span className="text-blue-600 dark:text-blue-400 min-w-[3ch] inline-block text-left align-middle">{display}</span>
  );
}
