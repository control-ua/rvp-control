/// <reference types="expo/types" />

import type { ExpoConfig } from 'expo/config';

declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
  };
};
