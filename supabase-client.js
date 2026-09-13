/* ===========================================================
   Manglee — Supabase client config
   Uses the Supabase JS CDN build (loaded in <head> before this file)
=========================================================== */

const SUPABASE_URL = "https://hmotgnmvdnufufedrnxc.supabase.co";
const SUPABASE_KEY = "sb_publishable_H4snVRB0I4aHidsfGvZq4Q_TvOa11Er";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
