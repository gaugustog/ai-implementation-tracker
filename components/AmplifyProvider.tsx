'use client';

import { useEffect } from 'react';
import '@/lib/amplify-config';

export default function AmplifyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Amplify is configured in amplify-config.ts
  }, []);

  return <>{children}</>;
}
