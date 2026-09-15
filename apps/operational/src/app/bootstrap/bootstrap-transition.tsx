import { useEffect, useState, type ReactNode } from 'react';

import { AppBootScreen } from './app-boot-screen';

export function BootstrapTransition({ children }: { children: ReactNode }) {
  const [isLeaving, setLeaving] = useState(false);
  const [isVisible, setVisible] = useState(true);

  useEffect(() => {
    const beginExit = window.setTimeout(() => setLeaving(true), 24);
    const completeExit = window.setTimeout(() => setVisible(false), 168);
    return () => {
      window.clearTimeout(beginExit);
      window.clearTimeout(completeExit);
    };
  }, []);

  return (
    <>
      {children}
      {isVisible ? (
        <div
          aria-hidden="true"
          className={`fixed inset-0 z-[100] transition-[opacity,transform] duration-150 ease-out ${
            isLeaving ? 'pointer-events-none scale-[1.005] opacity-0' : 'opacity-100'
          }`}
        >
          <AppBootScreen />
        </div>
      ) : null}
    </>
  );
}
