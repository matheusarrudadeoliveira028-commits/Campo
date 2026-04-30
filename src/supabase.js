import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://jtviywfdrtgmxxshqbpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dml5d2ZkcnRnbXh4c2hxYnBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzUwODUwNiwiZXhwIjoyMDkzMDg0NTA2fQ.J_DDuvXcYePC_WObV81koX6MTu4GGmrEjPXui61rjSI';

// Configuração inteligente para não quebrar na Web
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
};

// Só usa o AsyncStorage se estiver rodando no Android ou iOS
if (Platform.OS !== 'web') {
  supabaseOptions.auth.storage = AsyncStorage;
}

export const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);