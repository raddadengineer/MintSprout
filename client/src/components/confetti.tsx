import { useEffect, useRef } from "react";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

interface ConfettiProps {
    active: boolean;
    count?: number;
}

export function Confetti({ active, count = 60 }: ConfettiProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!active || !containerRef.current) return;

        const container = containerRef.current;
        container.innerHTML = "";

        for (let i = 0; i < count; i++) {
            const piece = document.createElement("div");
            piece.className = "confetti-piece";

            const color = COLORS[Math.floor(Math.random() * COLORS.length)];
            const left = Math.random() * 100;
            const delay = Math.random() * 0.8;
            const size = Math.random() * 8 + 6;
            const isCircle = Math.random() > 0.5;

            piece.style.cssText = `
        left: ${left}%;
        top: -20px;
        background-color: ${color};
        animation-delay: ${delay}s;
        animation-duration: ${2 + Math.random()}s;
        width: ${size}px;
        height: ${size}px;
        border-radius: ${isCircle ? "50%" : "2px"};
      `;

            container.appendChild(piece);
        }

        // Clean up after animation
        const timeout = setTimeout(() => {
            if (container) container.innerHTML = "";
        }, 4000);

        return () => clearTimeout(timeout);
    }, [active, count]);

    if (!active) return null;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden"
            aria-hidden="true"
        />
    );
}
