import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Resend } from "https://esm.sh/resend@3.2.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface Student {
  id: string
  student_name: string
  student_email: string
  roll_no: string
  qr_code_data: string
}

interface SessionStudent {
  students: Student
}

serve(async (req) => {
  // Handle preflight CORS requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("Function invoked - New Version v3.0")
    
    // Parse request body
    const body = await req.json()
    console.log("Request body:", body)
    
    const { session_id, origin } = body

    if (!session_id || !origin) {
      console.error("Missing required fields:", { session_id, origin })
      throw new Error("Missing session_id or origin")
    }

    // Initialize Supabase client - use SUPABASE_URL which is auto-provided
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    console.log("Supabase URL exists:", !!supabaseUrl)
    console.log("Service key exists:", !!supabaseServiceKey)
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables")
    }
    
    // Use service role key for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Resend
    const resendKey = Deno.env.get("RESEND_API_KEY")
    if (!resendKey) {
      throw new Error("Missing RESEND_API_KEY")
    }
    const resend = new Resend(resendKey)

    console.log("Fetching session:", session_id)
    
    // Fetch session details
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("session_name, teacher_id")
      .eq("id", session_id)
      .single()
    
    if (sessionError) {
      console.error("Session error:", sessionError)
      throw new Error(`Session error: ${sessionError.message}`)
    }
    if (!session) throw new Error("Session not found")

    console.log("Session found:", session.session_name)

    // Fetch assigned students
    const { data: assignments, error: assignmentsError } = await supabase
      .from("session_students")
      .select(`
        students:student_id (
          id,
          student_name,
          student_email,
          roll_no,
          qr_code_data
        )
      `)
      .eq("session_id", session_id)
    
    if (assignmentsError) {
      console.error("Assignments error:", assignmentsError)
      throw new Error(`Failed to fetch students: ${assignmentsError.message}`)
    }
    
    if (!assignments || assignments.length === 0) {
      console.log("No students assigned to this session")
      return new Response(
        JSON.stringify({
          success: true,
          message: "No students assigned to this session",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    console.log(`Found ${assignments.length} assigned students`)

    // Fetch teacher details
    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .select("name, email")
      .eq("id", session.teacher_id)
      .single()
    
    if (teacherError) {
      console.error("Teacher error:", teacherError)
      throw new Error(`Teacher error: ${teacherError.message}`)
    }
    if (!teacher) throw new Error("Teacher not found")

    console.log("Teacher found:", teacher.name)

    // Prepare email sending promises
    const emailPromises = (assignments as SessionStudent[]).map(async (assignment) => {
      const student = assignment.students
      const qrUrl = `${origin}/scan?student_id=${student.id}&qr=${encodeURIComponent(
        student.qr_code_data
      )}&session_id=${session_id}`

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Attendance QR Code</h2>
          <p>Hello <strong>${student.student_name}</strong>,</p>
          <p>Here is your QR code for the session: <strong>${session.session_name}</strong></p>
          <p><strong>Roll Number:</strong> ${student.roll_no}</p>
          <p><strong>Teacher:</strong> ${teacher.name}</p>
          <br>
          <p>Please click the link below to access your QR code:</p>
          <p><a href="${qrUrl}" target="_blank" style="color: #0066cc;">Open QR Code</a></p>
          <br>
          <p>Best regards,<br>${teacher.name}</p>
        </div>
      `

      console.log(`Sending email to ${student.student_email}`)

      return resend.emails.send({
        from: "Attendance System <onboarding@resend.dev>",
        reply_to: teacher.email,
        to: student.student_email,
        subject: `QR Code for ${session.session_name}`,
        html: htmlContent,
      })
    })

    // Wait for all emails to be sent
    const results = await Promise.allSettled(emailPromises)
    const successCount = results.filter((r) => r.status === "fulfilled").length
    const failedCount = results.length - successCount

    console.log(`Email results: ${successCount} success, ${failedCount} failed`)

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Email ${index} failed:`, result.reason)
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Emails sent successfully: ${successCount}, Failed: ${failedCount}`,
        total: results.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Function error:", error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    )
  }
})