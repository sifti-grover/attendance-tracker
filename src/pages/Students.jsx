import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import Papa from "papaparse";
import QRCode from "react-qr-code";

export default function Students() {
  const [students, setStudents] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roll, setRoll] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessions, setSessions] = useState([]);
  // Remove assignment controls from Students page; only add/list here
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStudents();
    fetchSessions();
  }, []);

  async function fetchStudents() {
    const { data, error } = await supabase
      .from("students")
      .select("id, student_name, student_email, roll_no, qr_code_data")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setStudents(data || []);
  }

  async function fetchSessions() {
    const { data: auth } = await supabase.auth.getUser();
    const teacherId = auth?.user?.id;

    if (!teacherId) {
      console.error("Not authenticated");
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .select("id, session_name")
      .eq("teacher_id", teacherId) // Add this filter
      .order("created_at", { ascending: false });

    if (!error) setSessions(data || []);
  }

  async function addStudent(e) {
    e.preventDefault();
    setError("");
    try {
      const qrData = crypto.randomUUID();
      const { error } = await supabase.from("students").insert({
        student_name: name,
        student_email: email,
        roll_no: roll,
        qr_code_data: qrData,
      });
      if (error) throw error;
      setName("");
      setEmail("");
      setRoll("");
      await fetchStudents();
      import("react-hot-toast").then(({ default: toast }) =>
        toast.success("Student added successfully")
      );
    } catch (err) {
      setError(err.message);
      import("react-hot-toast").then(({ default: toast }) =>
        toast.error("Failed to add student")
      );
    }
  }

  function handleCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data;
          const payload = rows.map((r) => ({
            student_name: r.student_name || r.name,
            student_email: r.student_email || r.email,
            roll_no: r.roll_no || r.roll,
            qr_code_data: crypto.randomUUID(),
          }));
          const { error } = await supabase.from("students").insert(payload);
          if (error) throw error;
          await fetchStudents();
          import("react-hot-toast").then(({ default: toast }) =>
            toast.success(`${payload.length} students imported successfully`)
          );
        } catch (err) {
          import("react-hot-toast").then(({ default: toast }) =>
            toast.error("Failed to import CSV")
          );
          setError(err.message);
        }
      },
      error: () => {
        import("react-hot-toast").then(({ default: toast }) =>
          toast.error("Invalid CSV file")
        );
        setError("Invalid CSV file");
      },
    });
  }

  const appOrigin = useMemo(() => window.location.origin, []);

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-4">
        <h2 className="font-semibold mb-3">Generate QR Codes</h2>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm">Select Session:</label>
          <select
            className="border rounded px-3 py-2"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
          >
            <option value="">Choose a session for QR codes</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.session_name}
              </option>
            ))}
          </select>
        </div>
        {selectedSessionId && (
          <p className="text-sm text-gray-600 mb-4">
            QR codes below will work for session:{" "}
            {sessions.find((s) => s.id === selectedSessionId)?.session_name}
          </p>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add Student</h2>
        <form
          onSubmit={addStudent}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <input
            className="border rounded px-3 py-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            className="border rounded px-3 py-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Roll No"
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
            required
          />
          <button className="bg-blue-600 text-white rounded px-4 py-2">
            Add
          </button>
        </form>
        <div className="mt-3">
          <label className="text-sm mr-2">Import CSV</label>
          <input type="file" accept=".csv" onChange={handleCSV} />
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <h2 className="font-semibold mb-3">Students</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((st) => {
            const qrUrl = selectedSessionId
              ? `${appOrigin}/scan?student_id=${st.id}&qr=${encodeURIComponent(
                  st.qr_code_data
                )}&session_id=${selectedSessionId}`
              : `${appOrigin}/scan?student_id=${st.id}&qr=${encodeURIComponent(
                  st.qr_code_data
                )}`;
            return (
              <div key={st.id} className="border rounded p-3">
                <div className="font-medium">{st.student_name}</div>
                <div className="text-xs text-gray-500">
                  {st.student_email} • {st.roll_no}
                </div>
                {selectedSessionId && (
                  <div className="mt-3 bg-white p-2 inline-block">
                    <QRCode value={qrUrl} size={128} />
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <a
                    className="text-sm text-blue-600"
                    href={qrUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selectedSessionId
                      ? "Open QR Link"
                      : "Select session first"}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
