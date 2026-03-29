import { useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';

type CelebrationTier = 'big' | 'medium' | 'small' | null;

export function getWinTier(multiplier: number): CelebrationTier {
  if (multiplier >= 5) return 'big';
  if (multiplier >= 2) return 'medium';
  if (multiplier >= 1.5) return 'small';
  return null;
}

export function useCelebration() {
  const flashRef = useRef<HTMLDivElement | null>(null);

  const setFlashRef = useCallback((el: HTMLDivElement | null) => {
    flashRef.current = el;
  }, []);

  const celebrate = useCallback((multiplier: number) => {
    const tier = getWinTier(multiplier);
    if (!tier) return;

    // Screen flash
    if (flashRef.current) {
      const el = flashRef.current;
      const color = tier === 'big' ? 'hsl(45,100%,55%)' : tier === 'medium' ? 'hsl(165,80%,45%)' : 'hsl(165,60%,35%)';
      const opacity = tier === 'big' ? '0.25' : tier === 'medium' ? '0.15' : '0.08';
      el.style.background = color;
      el.style.opacity = opacity;
      el.style.transition = 'opacity 0.1s ease-in';
      requestAnimationFrame(() => {
        setTimeout(() => {
          el.style.transition = 'opacity 0.6s ease-out';
          el.style.opacity = '0';
        }, 100);
      });
    }

    // Confetti
    if (tier === 'big') {
      // Big celebration — multiple bursts
      const end = Date.now() + 1500;
      const colors = ['#fbbf24', '#22d3ee', '#a855f7', '#f43f5e', '#10b981'];
      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors,
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();

      // Center burst
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.6 },
        colors,
        scalar: 1.2,
      });
    } else if (tier === 'medium') {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#2dd4bf', '#22d3ee', '#fbbf24'],
      });
    } else {
      // Small — subtle burst
      confetti({
        particleCount: 15,
        spread: 50,
        origin: { y: 0.65 },
        colors: ['#2dd4bf', '#94a3b8'],
        scalar: 0.8,
        gravity: 1.2,
      });
    }
  }, []);

  return { celebrate, setFlashRef };
}
