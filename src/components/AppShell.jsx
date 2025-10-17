import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export default function AppShell() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);

  useEffect(() => {
    let unsub = false;
    async function load() {
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;
      if (!userId || unsub) return;
      const { data: t } = await supabase.from("teachers").select("name,email").eq("id", userId).single();
      if (!unsub) setTeacher(t || null);
    }
    load();
    const sub = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s?.user) setTeacher(null);
      else load();
    });
    return () => {
      unsub = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="font-semibold">QR Attendance</Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
            <NavLink to="/students" className={navLinkClass}>Students</NavLink>
            <NavLink to="/scan" className={navLinkClass}>Scanner</NavLink>
            <NavLink to="/reports" className={navLinkClass}>Reports</NavLink>
            {teacher && (
              <span className="ml-2 text-sm text-gray-600">{teacher.name || teacher.email}</span>
            )}
            <button onClick={handleSignOut} className="ml-2 px-3 py-2 text-sm rounded-md border">Sign out</button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}


