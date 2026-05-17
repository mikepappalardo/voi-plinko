import { useEffect, useRef, useState } from 'react';

interface Props {
  onDone: () => void;
}

/**
 * Plays the intro video full-screen, then morphs it into the top-left logo slot.
 * Uses sessionStorage so it only plays once per session.
 */
export default function IntroVideo({ onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // phases: 'big' → 'shrinking' → 'logo'
  const [phase, setPhase] = useState<'big' | 'shrinking' | 'logo'>('big');

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.volume = 0;
    vid.muted = true;
    vid.play().catch(() => {});

    const handleEnd = () => shrink();
    vid.addEventListener('ended', handleEnd);
    return () => vid.removeEventListener('ended', handleEnd);
  }, []);

  const shrink = () => {
    setPhase('shrinking');
    // After transition completes, notify parent
    setTimeout(() => {
      setPhase('logo');
      onDone();
    }, 700);
  };

  // Big phase: centered overlay
  if (phase === 'big') {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#060610',
        }}
        onClick={shrink}
      >
        <video
          ref={videoRef}
          src="/voi-plinko-intro.mp4"
          muted
          playsInline
          style={{
            maxWidth: '90vw',
            maxHeight: '80vh',
            borderRadius: 16,
            boxShadow: '0 0 60px #b44fff66, 0 0 120px #ff2d9b33',
          }}
        />
        <div style={{
          position: 'absolute', bottom: 40,
          color: '#6060a0', fontSize: '0.8rem', fontFamily: 'Poppins, sans-serif',
        }}>
          tap to skip
        </div>
      </div>
    );
  }

  // Shrinking phase: animates from center to top-left
  if (phase === 'shrinking') {
    return (
      <video
        src="/voi-plinko-intro.mp4"
        muted
        playsInline
        autoPlay
        loop
        style={{
          position: 'fixed',
          top: 8, left: 20,
          height: 80,
          width: 'auto',
          zIndex: 1000,
          borderRadius: 4,
          boxShadow: '0 0 12px #b44fff55, 0 0 24px #ff2d9b22',
          transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    );
  }

  return null; // logo phase — parent renders the static img
}
