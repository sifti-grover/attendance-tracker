import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";

export default function RequireAuth() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let unsub = false;
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!unsub) {
        setAuthed(!!data?.session?.user);
        setLoading(false);
      }
    }
    check();
    const sub = supabase.auth.onAuthStateChange((_e, s) => {
      if (!unsub) setAuthed(!!s?.user);
    });
    return () => {
      unsub = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;
  return authed ? <Outlet /> : <Navigate to="/login" replace />;
}


