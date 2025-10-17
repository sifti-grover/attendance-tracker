import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";

export default function Dashboard() {
  const navigate = useNavigate();
  const [sessionName, setSessionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        navigate("/login");
      }
    });
    fetchSessions();
    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  async function fetchSessions() {
    const { data: auth } = await supabase.auth.getUser();
    const teacherId = auth?.user?.id;

    if (!teacherId) {
      setError("Not authenticated");
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .select("id, session_name, is_active, start_time, end_time")
      .eq("teacher_id", teacherId) // Add this filter
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setSessions(data || []);
  }

  async function handleCreateSession(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const teacherId = auth?.user?.id; // assuming auth user id maps to teachers.id
      if (!teacherId) throw new Error("Not authenticated");

      const { error: insertError } = await supabase.from("sessions").insert({
        teacher_id: teacherId,
        session_name: sessionName,
        is_active: false,
      });
      if (insertError) throw insertError;
      import("react-hot-toast").then(({ default: toast }) =>
        toast.success("Session created")
      );
      setSessionName("");
      await fetchSessions();
    } catch (err) {
      setError(err.message || "Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  async function startSession(sessionId) {
    const now = new Date().toISOString();
    // Mark session active and set start_time only if not already started
    const { data: updated, error } = await supabase
      .from("sessions")
      .update({ is_active: true, start_time: now, end_time: null })
      .eq("id", sessionId)
      .is("start_time", null)
      .select("id")
      .single();
    if (error || !updated) {
      import("react-hot-toast").then(({ default: toast }) =>
        toast.error("Session already started or failed to start")
      );
      return;
    }

    // Prefill attendance as 'absent' for all assigned students
    const { data: assigned } = await supabase
      .from("session_students")
      .select("student_id")
      .eq("session_id", sessionId);
    const { data: auth } = await supabase.auth.getUser();
    const teacherId = auth?.user?.id;
    if (!teacherId) {
      import("react-hot-toast").then(({ default: toast }) =>
        toast.error("Not authenticated")
      );
      return;
    }

    // Build inserts for those not already in attendance
    const studentIds = assigned?.map((a) => a.student_id) || [];
    if (studentIds.length === 0) {
      import("react-hot-toast").then(({ default: toast }) =>
        toast.warning("No students assigned to this session")
      );
      await fetchSessions();
      return;
    }

    // Fetch existing attendance rows to avoid duplicates
    const { data: existing } = await supabase
      .from("attendance")
      .select("student_id")
      .eq("session_id", sessionId);
    const existingIds = new Set((existing || []).map((r) => r.student_id));
    const payload = studentIds
      .filter((id) => !existingIds.has(id))
      .map((sid) => ({
        student_id: sid,
        teacher_id: teacherId,
        session_id: sessionId,
        attendance_status: "absent",
      }));

    if (payload.length > 0) {
      const { error: insertError } = await supabase
        .from("attendance")
        .insert(payload);
      if (insertError) {
        import("react-hot-toast").then(({ default: toast }) =>
          toast.error("Failed to create attendance records")
        );
        return;
      }
    }

    import("react-hot-toast").then(({ default: toast }) =>
      toast.success(`Session started with ${payload.length} attendance records`)
    );
    await fetchSessions();
  }

  async function stopSession(sessionId) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("sessions")
      .update({ is_active: false, end_time: now })
      .eq("id", sessionId)
      .is("end_time", null);
    if (!error) {
      import("react-hot-toast").then(({ default: toast }) =>
        toast.success("Session stopped")
      );
      await fetchSessions();
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow rounded-lg p-4 md:col-span-2">
          <h2 className="font-semibold mb-3">Create New Session</h2>
          <form onSubmit={handleCreateSession} className="flex gap-2">
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Math 101 - 2025-10-16"
              required
              className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </form>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="font-semibold mb-3">Quick Links</h2>
          <div className="space-y-2 text-sm">
            <Link className="block text-blue-600" to="/students">
              Manage Students →
            </Link>
            <Link className="block text-blue-600" to="/scan">
              Open Scanner →
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <h2 className="font-semibold mb-3">Your Sessions</h2>
        <ul className="divide-y">
          {sessions.map((s) => (
            <li key={s.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  <Link
                    className="text-blue-600 hover:underline"
                    to={`/sessions/${s.id}`}
                  >
                    {s.session_name}
                  </Link>
                </p>
                <p className="text-xs text-gray-500">
                  {s.is_active ? "Active" : "Inactive"}
                  {s.start_time
                    ? ` • Started: ${new Date(s.start_time).toLocaleString()}`
                    : ""}
                  {s.end_time
                    ? ` • Ended: ${new Date(s.end_time).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-sm px-3 py-1 rounded border disabled:opacity-60"
                  disabled={!!s.start_time}
                  onClick={() => startSession(s.id)}
                >
                  Start
                </button>
                <button
                  className="text-sm px-3 py-1 rounded border disabled:opacity-60"
                  disabled={!s.start_time || !!s.end_time}
                  onClick={() => stopSession(s.id)}
                >
                  Stop
                </button>
              </div>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="py-6 text-sm text-gray-500">No sessions yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
