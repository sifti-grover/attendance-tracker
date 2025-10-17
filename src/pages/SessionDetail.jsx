/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import QRCode from "react-qr-code";
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = 'service_1rlkqj2';
const EMAILJS_TEMPLATE_ID = 'template_zpyzacw';
const EMAILJS_PUBLIC_KEY = 'xuxkf_2tin8K6cTiP';

export default function SessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [assignedIds, setAssignedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [{ data: s }, { data: studs }, { data: joins }] = await Promise.all([
        supabase.from("sessions").select("id, session_name, is_active, teacher_id").eq("id", id).single(),
        supabase.from("students").select("id, student_name, student_email, roll_no, qr_code_data"),
        supabase.from("session_students").select("student_id").eq("session_id", id),
      ]);
      setSession(s || null);
      setStudents(studs || []);
      setAssignedIds(new Set((joins || []).map((j) => j.student_id)));
    } catch (e) {
      setError(e.message || "Failed to load session");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAssign(studentId, checked) {
    try {
      if (checked) {
        const { error } = await supabase.from("session_students").insert({ session_id: id, student_id: studentId });
        if (error) throw error;
        setAssignedIds((prev) => new Set(prev).add(studentId));
        import('react-hot-toast').then(({ default: toast }) => toast.success('Student assigned to session'));
      } else {
        const { error } = await supabase.from("session_students").delete().eq("session_id", id).eq("student_id", studentId);
        if (error) throw error;
        setAssignedIds((prev) => { const n = new Set(prev); n.delete(studentId); return n; });
        import('react-hot-toast').then(({ default: toast }) => toast.success('Student removed from session'));
      }
    } catch (err) {
      import('react-hot-toast').then(({ default: toast }) => toast.error('Failed to update assignment'));
    }
  }

  const appOrigin = useMemo(() => window.location.origin, []);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    return students.filter(student => 
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.roll_no.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const handleSelectAll = async (checked) => {
    setSelectAll(checked);
    if (checked) {
      const payload = filteredStudents
        .filter(st => !assignedIds.has(st.id))
        .map(st => ({ session_id: id, student_id: st.id }));
      
      if (payload.length > 0) {
        try {
          const { error } = await supabase.from("session_students").insert(payload);
          if (error) throw error;
          setAssignedIds(prev => new Set([...prev, ...payload.map(p => p.student_id)]));
          import('react-hot-toast').then(({ default: toast }) => toast.success(`Assigned ${payload.length} students`));
        } catch (err) {
          import('react-hot-toast').then(({ default: toast }) => toast.error('Failed to assign students'));
        }
      }
    } else {
      const studentIds = filteredStudents.map(st => st.id);
      try {
        const { error } = await supabase
          .from("session_students")
          .delete()
          .eq("session_id", id)
          .in("student_id", studentIds);
        if (error) throw error;
        setAssignedIds(prev => {
          const newSet = new Set(prev);
          studentIds.forEach(id => newSet.delete(id));
          return newSet;
        });
        import('react-hot-toast').then(({ default: toast }) => toast.success(`Removed ${studentIds.length} students`));
      } catch (err) {
        import('react-hot-toast').then(({ default: toast }) => toast.error('Failed to remove students'));
      }
    }
  };

  async function emailAll() {
    setSending(true);
    try {
      // Get teacher info
      const { data: teacher, error: teacherError } = await supabase
        .from("teachers")
        .select("name, email")
        .eq("id", session.teacher_id)
        .single();
      
      if (teacherError) throw teacherError;

      // Get assigned students
      const assignedStudents = students.filter(st => assignedIds.has(st.id));
      
      if (assignedStudents.length === 0) {
        import('react-hot-toast').then(({ default: toast }) => 
          toast.error('No students assigned to this session')
        );
        return;
      }

      let successCount = 0;
      let failCount = 0;

      // Send emails one by one
      for (const student of assignedStudents) {
        const qrUrl = `${appOrigin}/scan?student_id=${student.id}&qr=${encodeURIComponent(student.qr_code_data)}&session_id=${id}`;
        
        // Use QR API to generate image URL
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;
        
        try {
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
              to_email: student.student_email,
              student_name: student.student_name,
              session_name: session.session_name,
              roll_no: student.roll_no,
              teacher_name: teacher.name,
              qr_url: qrUrl,
              qr_image_url: qrImageUrl, // Send QR as URL
            },
            EMAILJS_PUBLIC_KEY
          );
          successCount++;
          console.log(`Sent to ${student.student_email}`);
        } catch (error) {
          failCount++;
          console.error(`Failed to send to ${student.student_email}:`, error);
        }
        
        // Small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      import('react-hot-toast').then(({ default: toast }) => 
        toast.success(`Emails sent: ${successCount} successful, ${failCount} failed`)
      );
    } catch (e) {
      console.error('Email error:', e);
      import('react-hot-toast').then(({ default: toast }) => 
        toast.error('Failed to send emails: ' + e.message)
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!session) return <div>Not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{session.session_name}</h1>
        <button 
          className="border rounded px-3 py-2 disabled:opacity-50" 
          onClick={emailAll}
          disabled={sending}
        >
          {sending ? 'Sending...' : 'Email QR codes to assigned'}
        </button>
      </div>

      <div className="bg-white shadow rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Assign Students</h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-1 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
              Select All ({filteredStudents.length})
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((st) => {
            const assigned = assignedIds.has(st.id);
            const qrUrl = `${appOrigin}/scan?student_id=${st.id}&qr=${encodeURIComponent(st.qr_code_data)}&session_id=${id}`;
            return (
              <label key={st.id} className={`border rounded p-3 block ${assigned ? "ring-1 ring-blue-500" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{st.student_name}</div>
                  <input type="checkbox" checked={assigned} onChange={(e) => toggleAssign(st.id, e.target.checked)} />
                </div>
                <div className="text-xs text-gray-500">{st.student_email} • {st.roll_no}</div>
                <div className="mt-3 bg-white p-2 inline-block">
                  <QRCode value={qrUrl} size={112} />
                </div>
              </label>
            );
          })}
        </div>
        {filteredStudents.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? `No students found matching "${searchTerm}"` : "No students available"}
          </div>
        )}
      </div>
    </div>
  );
}