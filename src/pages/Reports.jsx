import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export default function Reports() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ present: 0, absent: 0 });

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (sessionId) loadAttendance(sessionId);
  }, [sessionId]);

  async function loadSessions() {
    const { data: auth } = await supabase.auth.getUser();
    const teacherId = auth?.user?.id;

    if (!teacherId) {
      console.error("Not authenticated");
      return;
    }

    const { data } = await supabase
      .from("sessions")
      .select("id, session_name")
      .eq("teacher_id", teacherId) // Add this filter
      .order("created_at", { ascending: false });

    setSessions(data || []);
  }
  async function loadAttendance(id) {
    const { data } = await supabase
      .from("attendance")
      .select(
        "id, attendance_status, scanned_at, students:student_id(student_name,roll_no,student_email)"
      )
      .eq("session_id", id)
      .order("created_at", { ascending: false });
    const present = (data || []).filter(
      (r) => r.attendance_status === "present"
    ).length;
    const absent = (data || []).filter(
      (r) => r.attendance_status === "absent"
    ).length;
    setCounts({ present, absent });
    setRows(data || []);
  }

  const csv = useMemo(() => {
    const header = ["name", "roll_no", "email", "status", "scanned_at"];
    const body = rows.map((r) => [
      r.students?.student_name || "",
      r.students?.roll_no || "",
      r.students?.student_email || "",
      r.attendance_status,
      r.scanned_at || "",
    ]);
    return [header, ...body]
      .map((line) =>
        line
          .map((x) => `"${(x || "").toString().replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");
  }, [rows]);

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white shadow rounded p-4 flex items-center gap-3">
        <select
          className="border rounded px-3 py-2"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        >
          <option value="">Select session</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.session_name}
            </option>
          ))}
        </select>
        <div className="ml-auto text-sm">
          <span className="mr-4">
            Present: <b>{counts.present}</b>
          </span>
          <span>
            Absent: <b>{counts.absent}</b>
          </span>
        </div>
        <button
          disabled={!sessionId}
          onClick={downloadCsv}
          className="border rounded px-3 py-2 disabled:opacity-60"
        >
          Download CSV
        </button>
      </div>

      <div className="bg-white shadow rounded p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Roll No</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Scanned At</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">{r.students?.student_name}</td>
                <td className="py-2 pr-4">{r.students?.roll_no}</td>
                <td className="py-2 pr-4">{r.students?.student_email}</td>
                <td className="py-2 pr-4 capitalize">{r.attendance_status}</td>
                <td className="py-2 pr-4">
                  {r.scanned_at ? new Date(r.scanned_at).toLocaleString() : ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="5" className="py-6 text-center text-gray-500">
                  No records
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
