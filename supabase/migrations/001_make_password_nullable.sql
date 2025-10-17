-- Migration: Make teachers.password nullable
-- This allows us to use Supabase Auth instead of storing plaintext passwords

-- Make password field nullable
ALTER TABLE teachers ALTER COLUMN password DROP NOT NULL;

-- Add comment to clarify the field usage
COMMENT ON COLUMN teachers.password IS 'Deprecated: Use Supabase Auth instead. This field is kept for backward compatibility.';

-- Optional: Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);

-- Optional: Create an index on teacher_id in sessions for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON sessions(teacher_id);

-- Optional: Create an index on session_id in session_students for faster queries
CREATE INDEX IF NOT EXISTS idx_session_students_session_id ON session_students(session_id);

-- Optional: Create an index on student_id in session_students for faster queries
CREATE INDEX IF NOT EXISTS idx_session_students_student_id ON session_students(student_id);

-- Optional: Create an index on session_id in attendance for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id);

-- Optional: Create an index on student_id in attendance for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
