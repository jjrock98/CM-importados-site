'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ProgressBar() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible,  setVisible]  = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // On route change: start progress
    setVisible(true);
    setProgress(15);

    const t1 = setTimeout(() => setProgress(40),  150);
    const t2 = setTimeout(() => setProgress(65),  400);
    const t3 = setTimeout(() => setProgress(85),  700);

    // Complete after the page likely rendered
    const t4 = setTimeout(() => {
      setProgress(100);
      timer.current = setTimeout(() => setVisible(false), 300);
    }, 1000);

    return () => {
      clearTimeout(t1); clearTimeout(t2);
      clearTimeout(t3); clearTimeout(t4);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-0.5 bg-brand-500 transition-all duration-300 ease-out shadow-sm shadow-brand-400"
      style={{
        width: `${progress}%`,
        opacity: progress === 100 ? 0 : 1,
        transition: progress === 100
          ? 'width 200ms ease, opacity 300ms ease 200ms'
          : 'width 400ms ease',
      }}
    />
  );
}

export function PageProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
