'use client';

import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

// Configure Amplify with the backend outputs
Amplify.configure(outputs, {
  ssr: false, // Disable SSR for client-side only usage
});

export default Amplify;
