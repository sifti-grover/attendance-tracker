import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import QrScanner from "qr-scanner";
import toast from "react-hot-toast";

export default function Scanner() {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("Point camera at QR code");
  const [error, setError] = useState("");
  const [lastScanned, setLastScanned] = useState("");
  const processingRef = useRef(false);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        setScanning(true);
        const scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            if (!active || processingRef.current) return;
            const data = result?.data || result;
            console.log("QR Scanned:", data);
            
            // Prevent duplicate scans
            if (data === lastScanned) return;
            setLastScanned(data);
            
            processingRef.current = true;
            await handleResult(data);
            
            // Reset after 3 seconds to allow re-scanning
            setTimeout(() => {
              processingRef.current = false;
              setLastScanned("");
            }, 3000);
          },
          { 
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );
        scannerRef.current = scanner;
        await scanner.start();
      } catch (e) {
        console.error("Scanner init error:", e);
        setError(e.message || "Camera access denied");
        setScanning(false);
      }
    }
    init();
    return () => {
      active = false;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
    };
  }, []);

  async function handleResult(data) {
    try {
      setError("");
      setMessage("QR detected. Processing...");

      let studentId, qr, sessionId;

      // Try to parse as URL first
      try {
        // Handle both full URLs and relative paths
        let url;
        if (data.startsWith('http://') || data.startsWith('https://')) {
          url = new URL(data);
        } else if (data.startsWith('/scan?')) {
          // Handle relative URLs like /scan?student_id=...
          url = new URL('http://dummy.com' + data);
        } else if (data.includes('student_id=')) {
          // Handle query strings without path
          url = new URL('http://dummy.com/scan?' + data);
        } else {
          throw new Error("Invalid QR format");
        }

        studentId = url.searchParams.get("student_id");
        qr = url.searchParams.get("qr");
        sessionId = url.searchParams.get("session_id");
        
        console.log("Parsed params:", { studentId, qr, sessionId });
      } catch (urlError) {
        console.error("URL parse error:", urlError);
        throw new Error("Invalid QR code format. Expected URL with student_id, qr, and session_id parameters.");
      }

      if (!studentId || !qr || !sessionId) {
        throw new Error("Missing required parameters in QR code");
      }

      const { data: auth } = await supabase.auth.getUser();
      const teacherId = auth?.user?.id;
      if (!teacherId) throw new Error("Not authenticated. Please log in.");

      // Check session active
      const { data: sessionRows, error: sessionErr } = await supabase
        .from("sessions")
        .select("is_active, session_name")
        .eq("id", sessionId)
        .single();
      
      if (sessionErr) {
        console.error("Session error:", sessionErr);
        throw new Error("Session not found");
      }
      
      if (!sessionRows?.is_active) {
        throw new Error(`Session "${sessionRows?.session_name}" is not active`);
      }

      // Validate student's qr_code_data matches
      const { data: student, error: studentErr } = await supabase
        .from("students")
        .select("qr_code_data, student_name")
        .eq("id", studentId)
        .single();
      
      if (studentErr) {
        console.error("Student error:", studentErr);
        throw new Error("Student not found");
      }
      
      if (student?.qr_code_data !== qr) {
        throw new Error("QR code validation failed. This QR code is invalid or has been tampered with.");
      }

      // Update existing row to 'present' if exists, else insert new
      const now = new Date().toISOString();
      const { data: existing, error: existingErr } = await supabase
        .from("attendance")
        .select("id, attendance_status")
        .eq("student_id", studentId)
        .eq("session_id", sessionId)
        .limit(1);
      
      if (existingErr) {
        console.error("Existing attendance error:", existingErr);
        throw existingErr;
      }
      
      if (existing && existing.length > 0) {
        if (existing[0].attendance_status !== 'present') {
          const { error: updErr } = await supabase
            .from("attendance")
            .update({ attendance_status: 'present', scanned_at: now })
            .eq("id", existing[0].id);
          if (updErr) {
            console.error("Update error:", updErr);
            throw updErr;
          }
          setMessage(`✅ ${student.student_name} - Attendance updated to Present`);
          toast.success(`${student.student_name} - Marked Present`);
        } else {
          setMessage(`✅ ${student.student_name} - Already marked present`);
          toast.success(`${student.student_name} - Already present`);
        }
      } else {
        const { error: insertErr } = await supabase.from("attendance").insert({
          student_id: studentId,
          teacher_id: teacherId,
          session_id: sessionId,
          attendance_status: "present",
          scanned_at: now,
        });
        if (insertErr) {
          console.error("Insert error:", insertErr);
          throw insertErr;
        }
        setMessage(`✅ ${student.student_name} - Attendance marked Present`);
        toast.success(`${student.student_name} - Marked Present`);
      }
    } catch (e) {
      console.error("Handle result error:", e);
      setError(e.message || "Scan failed");
      toast.error(e.message || 'Scan failed');
      setTimeout(() => {
        setMessage("Point camera at QR code");
        setError("");
      }, 3000);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow p-4 space-y-3">
        <h1 className="text-xl font-semibold">QR Scanner</h1>
        <div className="aspect-video bg-black rounded overflow-hidden relative">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <p className="text-white">Starting camera...</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <p className={`text-sm font-medium ${message.includes('✅') ? 'text-green-600' : 'text-gray-700'}`}>
            {message}
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Make sure the QR code is well-lit and in focus</p>
          <p>• Hold steady for 1-2 seconds</p>
          <p>• Session must be active to mark attendance</p>
        </div>
      </div>
    </div>
  );
}