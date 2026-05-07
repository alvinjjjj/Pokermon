import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vudqydqzrlgetcdegfvc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1ZHF5ZHF6cmxnZXRjZGVnZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzcwNDAsImV4cCI6MjA5MzcxMzA0MH0.bW8RcrcZnJiQwmJE65a4V4zDfxHKtLFc-UkdgiGUARg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);