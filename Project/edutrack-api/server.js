const express = require('express');
const path = require('path');
const cors = require('cors'); 
const db = require('./db'); // Connects to your ieti_edutrack_db via Railway MySQL

const app = express();
// --- START: CHANGES FOR RAILWAY DEPLOYMENT ---
const PORT = process.env.PORT || 3000; // Use Railway's port or default to 3000
// --- END: CHANGES FOR RAILWAY DEPLOYMENT ---

// ===================================================================
//  Static File Serving 
// ===================================================================
app.use('/static', express.static(path.join(__dirname, '..', 'static')));
app.use(express.static(path.join(__dirname, '..'))); 


// ===================================================================
//  Middleware
// ===================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ===================================================================
//  Routes (Registration & Login)
// ===================================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// -------------------------------------------------------------------
// 1. TEACHER REGISTRATION - LIVE DB INSERTION (Plain Password)
// -------------------------------------------------------------------
app.post('/api/register/teacher', async (req, res) => {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const [existingTeacher] = await db.execute(
            'SELECT email FROM teachers WHERE email = ?', 
            [email]
        );

        if (existingTeacher.length > 0) {
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        }

        await db.execute(
            'INSERT INTO teachers (full_name, email, password, status) VALUES (?, ?, ?, ?)',
            [full_name, email, password, 'pending']
        );
        
        console.log(`DB Insert: Teacher ${email} registered.`);
        
        res.json({ success: true, message: 'Registration received. Account pending admin approval.' });

    } catch (error) {
        console.error('Teacher Registration DB Error:', error);
        res.status(500).json({ success: false, message: 'Server failed to process registration.' });
    }
});

// -------------------------------------------------------------------
// 2. STUDENT REGISTRATION - LIVE DB INSERTION (Plain Password)
// -------------------------------------------------------------------
app.post('/api/register/student', async (req, res) => {
    const { name: full_name, email, password, course, year_level } = req.body;
    
    if (!full_name || !email || !password || !course || !year_level) {
        return res.status(400).json({ success: false, message: 'Missing required fields (Name, Email, Password, Course, Year).' });
    }

    try {
        const [existingStudent] = await db.execute(
            'SELECT email FROM students WHERE email = ?', 
            [email]
        );

        if (existingStudent.length > 0) { 
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        }
        
        await db.execute(
            'INSERT INTO students (full_name, email, password, course, year_level) VALUES (?, ?, ?, ?, ?)',
            [full_name, email, password, course, year_level]
        );
        
        console.log(`DB Insert: Student ${email} registered.`);
        
        res.json({ success: true, message: 'Registration successful. You may now log in.' });

    } catch (error) {
        console.error('Student Registration DB Error:', error);
        res.status(500).json({ success: false, message: 'Server failed to process registration.' });
    }
});


// -------------------------------------------------------------------
// 3. UNIFIED LOGIN - LIVE DB AUTHENTICATION (Plain Password Comparison)
// -------------------------------------------------------------------
app.post('/api/login', async (req, res) => {
    const { identifier, password, role } = req.body;
    
    if (!identifier || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing credentials.' });
    }

    try {
        let tableName = (role === 'student') ? 'students' : 'teachers';
        
        const [userRows] = await db.execute(
            `SELECT * FROM ${tableName} WHERE email = ?`, 
            [identifier]
        );
        
        if (userRows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials or account not found.' });
        }
        
        const userData = userRows[0];
        
        if (password !== userData.password) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        
        if (role === 'teacher' && userData.status === 'pending') {
            return res.status(403).json({ success: false, message: 'Account pending admin approval.' });
        }
        
        let redirectPath = '';
        if (role === 'teacher' && userData.email === 'admin@ieti.edu.ph') {
            redirectPath = '/static/admin-dashboard.html'; 
        } else if (role === 'teacher') {
            redirectPath = 'teacher/dashboard.html';
        } else { // Student
            redirectPath = 'student/student-dashboard.html';
        }
        
        return res.json({
            success: true,
            message: 'Login successful',
            full_name: userData.full_name,
            redirect: redirectPath
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Server failed during login process.' });
    }
});


// ===================================================================
//  Admin Dashboard Data Routes
// ===================================================================

/**
 * Endpoint to fetch all registered teachers (active and pending).
 */
app.get('/api/admin/teachers', async (req, res) => {
    try {
        const [teachers] = await db.execute(
            'SELECT id, full_name, email, status, created_at FROM teachers ORDER BY created_at DESC'
        );
        res.json({ success: true, teachers });
    } catch (error) {
        console.error('Fetch Teachers Error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve teacher list.' });
    }
});

/**
 * Endpoint to fetch all registered students.
 */
app.get('/api/admin/students', async (req, res) => {
    try {
        const [students] = await db.execute(
            'SELECT id, full_name, email, course, year_level, created_at FROM students ORDER BY created_at DESC'
        );
        res.json({ success: true, students });
    } catch (error) {
        console.error('Fetch Students Error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve student list.' });
    }
});

/**
 * Endpoint to approve or deny a teacher.
 */
app.post('/api/admin/teacher-status', async (req, res) => {
    const { teacherId, status } = req.body;
    
    if (!teacherId || (status !== 'active' && status !== 'inactive')) {
        return res.status(400).json({ success: false, message: 'Invalid request parameters.' });
    }

    try {
        await db.execute(
            'UPDATE teachers SET status = ? WHERE id = ?',
            [status, teacherId]
        );
        res.json({ success: true, message: `Teacher ID ${teacherId} status updated to ${status}.` });
    } catch (error) {
        console.error('Update Teacher Status Error:', error);
        res.status(500).json({ success: false, message: 'Failed to update teacher status.' });
    }
});


// ===================================================================
//  NEW: Admin Update User Route (Edit Name, Email, Password)
// ===================================================================

/**
 * Endpoint to update user details (name, email, password, and student meta data).
 */
app.post('/api/admin/update-user', async (req, res) => {
    // Requires: id, role, full_name, email. Optional: password, meta1, meta2 (for students)
    const { id, role, full_name, email, password, meta1, meta2 } = req.body; 

    // Basic validation
    if (!id || !role || !full_name || !email) {
        return res.status(400).json({ success: false, message: 'Missing required user fields (ID, role, name, or email).' });
    }
    
    // Determine the table, base query, and parameters
    let tableName;
    let updateQuery;
    let queryParams = [full_name, email];

    if (role === 'student') {
        tableName = 'students';
        const course = meta1;
        const year_level = meta2;
        
        // Student query includes course and year_level
        updateQuery = 'UPDATE students SET full_name = ?, email = ?, course = ?, year_level = ?';
        queryParams.push(course, year_level);

    } else if (role === 'teacher' || role === 'admin') {
        tableName = 'teachers';
        // Teacher query only includes name and email
        updateQuery = 'UPDATE teachers SET full_name = ?, email = ?';
        
    } else {
        return res.status(400).json({ success: false, message: 'Invalid user role specified.' });
    }

    // Optional: Add password update if a new password is provided
    if (password) {
        // WARNING: Still using plain text password as per previous design
        updateQuery += ', password = ?'; 
        queryParams.push(password);
    }
    
    // Finalize the WHERE clause
    updateQuery += ` WHERE id = ?`;
    queryParams.push(id);

    try {
        const [result] = await db.execute(updateQuery, queryParams);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: `${role} with ID ${id} not found.` });
        }
        
        console.log(`DB Update: ${role} ID ${id} updated.`);
        res.json({ success: true, message: `${role} account updated successfully.` });

    } catch (error) {
        console.error('Update User DB Error:', error);
        // Check for specific MySQL duplicate entry error (e.g., trying to use an email already taken)
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ success: false, message: 'Update failed: That email is already in use by another account.' });
        }
        res.status(500).json({ success: false, message: 'Server failed to update user.' });
    }
});


// ===================================================================
//  Start Server
// ===================================================================
app.listen(PORT, () => {
    // Console log updated to show the dynamic port
    console.log(`Server is running on port ${PORT}`);
});
