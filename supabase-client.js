
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://tfzcnsyfaofmmiekuwsb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmemNuc3lmYW9mbW1pZWt1d3NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDQyNjgsImV4cCI6MjA4NzA4MDI2OH0.yc7P6wMDQ1BrVJhZ3xSNu9q12bN5xetGWQKG7yCv3q0';

// TODO: Replace these with your actual Supabase project URL and Anon Key
if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.error('Supabase URL and Key are missing. Please update supabase-client.js');
    alert('Supabase Configuration Missing! Please update supabase-client.js with your project details.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

