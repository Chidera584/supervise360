# CHAPTER FOUR: IMPLEMENTATION AND DESIGN

## 4.1 Introduction

This chapter presents the implementation and design of the Supervise360 system. It discusses the design decisions adopted during development, the tools and technologies used to build the platform, and the manner in which the various components of the system were realised. The chapter is organised to cover the front-end implementation and user interface design, the backend implementation including server-side logic and database design, and the integration of Answer Set Programming (ASP) for GPA-based grouping and supervisor allocation. The aim is to provide a clear, technical account of how the system was constructed and how it fulfils the functional and non-functional requirements specified in Chapter Three.

---

## 4.2 Design and Development Tools

The Supervise360 system was developed using a set of well-established technologies chosen for their suitability for web-based applications, maintainability, and alignment with the project’s requirements. This section describes each category of tools and their role in the development process.

### 4.2.1 Programming Languages

- **TypeScript** was used for both the backend and the frontend application code. TypeScript extends JavaScript with static typing, which improves code quality, enables better tool support, and reduces runtime errors. The backend is written entirely in TypeScript and compiled to JavaScript for execution under Node.js. The frontend is also implemented in TypeScript and compiled by Vite for deployment in the browser.

- **JavaScript** is the runtime language for the backend (Node.js) and the target language for the frontend after compilation. SQL was used for all database schema definitions and queries.

### 4.2.2 Backend Framework: Node.js and Express

The server-side application is built on **Node.js**, a JavaScript runtime that allows the use of a single language across the stack and supports non-blocking I/O for handling concurrent requests. The **Express** framework runs on top of Node.js and provides routing, middleware, and request handling. Express was chosen for its simplicity, wide adoption, and the ease with which RESTful API endpoints can be defined. The backend exposes a set of API routes under the `/api` prefix for authentication, users, groups, supervisors, projects, reports, evaluations, messages, notifications, defense scheduling, and administrative operations. Middleware is used for cross-origin resource sharing (CORS), request body parsing, rate limiting, and security headers (Helmet). Authentication is implemented using **JSON Web Tokens (JWT)** with the **jsonwebtoken** library; the **bcryptjs** library is used for secure password hashing. Request validation is performed using **Joi** before processing. File uploads for project reports are handled using **Multer**.

### 4.2.3 Database: MySQL

**MySQL** was selected as the relational database management system for storing all persistent data. The **mysql2** driver (with Promise support) is used from the Node.js backend to execute queries and manage connections. MySQL supports the transactional and relational structure required for users, departments, groups, group members, supervisors, projects, reports, evaluations, messages, notifications, and defense allocations. The schema uses primary keys, foreign keys, and indexes to enforce referential integrity and to support efficient querying.

### 4.2.4 Frontend Technologies

The client-side application is a single-page application (SPA) built with **React 18**. The build tool **Vite** is used for fast development and for bundling the application for production. **React Router** (v7) handles client-side routing and role-based access to pages. The user interface is styled using **Tailwind CSS**, a utility-first CSS framework that allows rapid, consistent styling and responsive layouts. **Lucide React** provides the icon set used across the application. The frontend communicates with the backend through a central **API client** module that uses the **Fetch** API; all requests include the JWT in the `Authorization` header when the user is authenticated. **Axios** is available for HTTP requests where needed. For export functionality (e.g. reports or allocation tables), **jsPDF** and **jspdf-autotable** are used to generate PDF documents.

### 4.2.5 Development Tools and Libraries

- **dotenv** is used to load environment variables (e.g. database credentials, JWT secret, API URL) from a `.env` file in development.
- **nodemon** (development) restarts the backend server when source files change.
- **ESLint** and **TypeScript** compilers enforce code quality and type correctness.
- **Nodemailer** is integrated for sending email notifications (e.g. group formation, supervisor assignment, defense scheduling) when configured.
- **express-rate-limit** limits the number of requests per IP to reduce the risk of abuse.
- **UUID** is used where unique identifiers are required (e.g. tokens or references).

### 4.2.6 ASP Tools for Grouping Logic

The grouping and supervisor allocation logic in Supervise360 is based on **Answer Set Programming (ASP)** principles. Rather than using an external ASP solver such as Clingo, the constraints and optimisation criteria were encoded and implemented directly in **TypeScript** within the backend. The **GroupFormationService** implements the ASP-style grouping algorithm: students are classified into GPA tiers (HIGH, MEDIUM, LOW) using configurable thresholds stored in the database; the algorithm then forms groups by combining one student from each tier where possible (ideal groups of three), and applies fallback strategies for remaining students so that no student is left unassigned. The **SupervisorAssignmentService** implements an ASP-style assignment algorithm that assigns supervisors to groups by department and distributes workload evenly (by current group count) without a fixed per-supervisor capacity limit. This approach keeps the logic maintainable, testable, and integrated with the existing Node.js and MySQL stack while preserving the declarative, constraint-based reasoning associated with ASP.

---

## 4.3 Front-End Implementation

The front-end of Supervise360 is implemented as a React single-page application that provides separate experiences for administrators, supervisors, and students. The application is structured around a main layout that includes a sidebar for navigation and a content area that renders the active page based on the current route and the authenticated user’s role.

Routing is handled by React Router. After the user selects a role on the landing page (Administrator, Supervisor, or Student), they are directed to the appropriate login form. Upon successful authentication, the backend returns a JWT, which is stored (e.g. in local storage) and attached to subsequent API requests via the API client. The client checks the token and user role to determine which routes and sidebar menu items are available. Protected routes redirect unauthenticated users to the login screen.

The frontend is organised into pages, components, and contexts. **Contexts** (e.g. AuthContext, GroupsContext, DepartmentContext) hold global state such as the current user, groups data, and department filters, and expose it to components. **Pages** correspond to the main screens (dashboards, Groups, Users, Reports, etc.) and are composed of reusable **UI components** (e.g. Card, Button, Input, ConfirmationModal) and layout components (MainLayout, Sidebar, Header). Forms collect user input and call the API client methods; success and error responses are shown to the user and, where appropriate, local state or context is updated. List and table views typically fetch data on mount and support search or filter where relevant. The interface is responsive: the sidebar collapses to a mobile-friendly drawer on smaller screens.

Communication with the backend is centralised in an API client module that defines methods for each logical operation (e.g. `login`, `getGroups`, `formGroups`, `getSupervisorWorkload`, `uploadReport`, `getMyDefenseSchedule`). The base URL is configurable via environment variable (`VITE_API_URL`). Each method builds the request (method, headers, body), sends it using the Fetch API, and returns the parsed JSON response. The client attaches the stored JWT to the `Authorization` header for all requests except login and registration. This design keeps the rest of the frontend free of HTTP details and ensures consistent authentication and error handling across the application.

---

## 4.4 User Interface Design

The following subsections describe the purpose and main functionality of each major page in the system. Pages are grouped by portal (Admin, Student, Supervisor). Where a page type is shared across portals (e.g. Profile), it is described once with any role-specific behaviour noted.

### 4.4.1 Admin Portal Pages

**Dashboard Page**  
The admin dashboard presents an overview of system activity. It displays aggregate statistics such as total groups, total students (derived from group members), and supervisor assignment status. The figures are obtained from the backend using institutional data (e.g. from `project_groups` and `group_members`) and give the administrator a quick view of the current state of grouping and allocation. Links or shortcuts to key actions (e.g. Groups, Supervisor Assignment) are provided.

**Departments Page**  
This page allows administrators to manage the list of departments in the system. The admin can add new departments (with a name and optional code) and remove existing ones, subject to checks that no dependent data (e.g. groups, users, or supervisor workload) remains. The department list is used elsewhere in the system (e.g. group formation, supervisor assignment, defense scheduling) to scope operations and filter data. Administrators with restricted access see only the departments they are assigned to.

**Users Page**  
The Users page provides user account management. The administrator can view a list of users (optionally filtered by role or department), and create or edit user accounts. User attributes include name, email, role (admin, supervisor, student), and department. For students, matric number can be set. The page communicates with the user and authentication APIs to perform CRUD operations and to ensure consistency with the roles and departments used in the rest of the system.

**Groups Page**  
The Groups page is the main interface for forming student groups. The administrator selects a department, uploads a CSV file containing student data (e.g. name, matric number, GPA), and triggers group formation. The system uses the ASP-style grouping logic to produce balanced groups (typically 1 HIGH, 1 MEDIUM, 1 LOW per group) and displays the resulting groups with member details and GPA tier information. The page shows summary statistics (number of groups, total students, department, and current GPA thresholds). The administrator can refresh data from the database, clear groups (with confirmation), and navigate to Supervisor Assignment for the selected department.

**Supervisors Page (Supervisor Assignment)**  
This page supports the assignment of supervisors to student groups. The administrator can view supervisor workload (by department), view unassigned groups, and either assign supervisors manually to individual groups or use the automatic allocation feature, which applies the ASP-style assignment algorithm to assign supervisors to all unassigned groups in a department while balancing workload. The page also supports uploading a CSV of supervisors to populate the `supervisor_workload` table and syncing workload with actual assignments. Options to clear all assignments (with confirmation) and to swap group members (within the same GPA tier) are available where applicable.

**Defense Scheduling Page**  
The Defense Scheduling page allows the administrator to configure defense sessions by defining venues and group ranges (department and group number range). Staff (assessors) can be uploaded or entered, and the system allocates assessors to venue–range combinations (e.g. by excluding certain roles such as HOD/Dean from assessor teams where configured). The resulting allocations (venue, department, group range, assessors) are saved to the database. Once published, students and supervisors can view their defense venue and assessor information. The page may also support export of the schedule (e.g. PDF or document).

**Reports & Analytics Page**  
This page provides an administrative view of project reports and related analytics. The administrator can see report submission and review status across groups or departments, and access aggregate information useful for monitoring progress and compliance. It complements the supervisor-facing report review and student-facing report submission features.

**Settings Page**  
The Settings page is used to configure system-wide and department-specific parameters. Global and per-department GPA tier thresholds (HIGH, MEDIUM, LOW minimum values) can be viewed and updated. These thresholds drive the classification of students during group formation. The page may also expose other configuration options (e.g. notification settings) where implemented.

**Profile Page (Admin)**  
The admin profile page allows the administrator to view and update their own account details (e.g. name, email) and, where applicable, change password. It is the same in purpose as the profile pages in the other portals but is tailored to the admin role and any admin-specific fields.

### 4.4.2 Student Portal Pages

**Dashboard**  
The student dashboard shows a summary of the student’s activity: their assigned group (if any), supervisor, and quick links to reports, messages, and defense information. It provides a single entry point to the main student functions.

**My Group**  
This page displays the student’s current group: group name, list of members with names and GPA tiers, and assigned supervisor. If the student is not yet assigned to a group, an appropriate message is shown. Data is loaded from the groups API (e.g. `/api/groups/my-group`) using the authenticated user’s identity (resolved via matric number or user account).

**Reports**  
Students use this page to submit project reports. They can upload a file (e.g. PDF or Word), specify report type (e.g. proposal, progress, final), and add a title. The list of previously submitted reports and their review status (e.g. pending, reviewed, with comments) is displayed. Submission and listing use the reports API and are scoped to the student’s group and project.

**Messages**  
The Messages page provides an inbox and sent view. Students can select a recipient (e.g. supervisor or group), compose a message with subject and body, and send it. They can also reply to received messages. Messages are stored and retrieved via the messages API; the interface supports read status and basic threading where implemented.

**Defense & Evaluation**  
This page shows the student’s defense schedule (venue and assessors) when the administrator has published defense allocations. It may also display evaluation results (scores or grades) from supervisors after defense, where that feature is implemented and exposed to students.

**Profile (Student)**  
The student profile page allows the student to view and edit their profile (e.g. name, email) and to change their password. It is the same in concept as the admin and supervisor profile pages.

### 4.4.3 Supervisor Portal Pages

**Dashboard**  
The supervisor dashboard presents an overview of the groups assigned to the logged-in supervisor, with quick access to evaluations, report reviews, and messages.

**My Groups**  
This page lists all groups assigned to the supervisor. For each group, it shows group name, members, project status, and report counts (e.g. total, reviewed, pending). The supervisor can drill down into project and report details and access actions such as approving or rejecting project proposals and reviewing reports.

**Evaluations**  
Supervisors use this page to submit defense or project evaluations. They can see pending evaluations (groups or projects requiring assessment), enter scores (e.g. documentation, implementation, presentation, innovation) and feedback, and submit. Completed evaluations are listed. Data is sent and retrieved via the evaluations API.

**Report Reviews**  
Here the supervisor sees reports submitted by students in their groups that are pending review. They can open each report, add comments, and mark it as approved or rejected. The report review API is used to submit the review and update the report status.

**Messages**  
Supervisors use the same messaging system as students: they can view inbox and sent messages, reply, and send new messages to students or other contacts as permitted by the application logic.

**Profile (Supervisor)**  
The supervisor profile page allows viewing and updating personal details and password, consistent with the other portals.

---

## 4.5 Backend Implementation

### 4.5.1 Server-Side Implementation

The backend of Supervise360 is implemented as a Node.js application using the Express framework. The server is started only after a successful connection to the MySQL database; environment variables (via dotenv) supply the database configuration, JWT secret, port, and optional settings such as frontend URL and rate-limit parameters.

**Request handling and middleware**  
Incoming requests pass through a pipeline of middleware. CORS is configured to allow requests from the frontend origin (e.g. `http://localhost:5173` in development). Helmet adds security-related HTTP headers. A rate limiter restricts the number of requests per IP to the `/api` routes. The body parser accepts JSON and URL-encoded payloads (with a size limit). Static file serving is used for uploaded report files under `/uploads`. A health-check endpoint (e.g. `GET /health`) is provided for monitoring. After these stages, requests are routed to the appropriate handler based on path and HTTP method.

**API endpoints and routing**  
The API is organised into modules (auth, users, groups, supervisors, settings, admin, projects, reports, evaluations, messages, notifications, defense panels). Each module defines a router that is mounted under `/api` (e.g. `/api/auth`, `/api/groups`, `/api/reports`). Authentication is enforced by the `authenticateToken` middleware, which reads the JWT from the `Authorization` header, verifies it, and attaches the decoded user (id, email, role) to the request. Role-based access is enforced with helpers such as `requireAdmin`, `requireSupervisor`, and `requireStudent`, which reject requests if the authenticated user’s role is not in the allowed set. Thus, only authorised users can access grouping, allocation, report, evaluation, and admin endpoints.

**Authentication**  
Login and registration are handled in the auth module. Passwords are hashed with bcrypt before storage. On successful login, the server issues a JWT containing user identifier, email, and role; the client stores this token and sends it with subsequent requests. The `GET /api/auth/me` endpoint returns the current user and role-specific data (e.g. student or supervisor record) when a valid token is present. Password change and password-reset flows use the same auth and user services.

**Group formation and supervisor allocation**  
Group formation is triggered by a POST request to the groups API (e.g. `/api/groups/form`) with an array of student records and the selected department. The backend invokes the GroupFormationService, which (1) loads GPA thresholds (global or department-specific) from the database, (2) classifies each student into a GPA tier (HIGH, MEDIUM, LOW), and (3) runs the ASP-style grouping algorithm to form groups of one student per tier where possible, with fallbacks for remainders. The resulting groups and their members are persisted in `project_groups` and `group_members`. Supervisor allocation is triggered from the supervisors API (e.g. `/api/supervisors/auto-assign`). The SupervisorAssignmentService loads unassigned groups and the current supervisor workload, then applies the assignment algorithm to assign one supervisor per group by department and to balance workload. Assignments are written to `project_groups` (supervisor_name) and `supervisor_workload` (current_groups). Notifications (in-app and optionally email) are sent when groups are formed or supervisors are assigned.

**Other operations**  
Projects are created or updated by students via the projects API; supervisors can approve or reject proposals. Report upload uses Multer for file storage and inserts metadata into the reports table; the review endpoint updates the report with reviewer, comments, and status. Evaluations are submitted via the evaluations API and stored with scores and grades. Messages and notifications are created and read through their respective APIs. Defense scheduling uses a dedicated allocation service that persists venue–range–assessor data and exposes it to students and supervisors via the defense-panels and allocation endpoints. All of these operations use the same database connection pool and transaction support where consistency is required.

### 4.5.2 Database Implementation

MySQL is used to store all persistent data for the Supervise360 system. The backend uses the mysql2 library with Promises to obtain a connection pool and execute queries. Database configuration (host, port, user, password, database name) is read from the environment. Schema fixes and migrations (e.g. ensuring `project_groups`, `group_members`, `supervisor_workload`, `defense_allocations`, `departments`, and `admin_departments` exist and that projects/reports reference `project_groups`) are run at server startup where applicable.

**Data stored in MySQL**  
- **Users and roles:** The `users` table holds account information (name, email, password hash, role, department). Role-specific data is stored in `students` (e.g. user_id, matric_number, gpa) and `supervisors` (e.g. user_id, department) where used.  
- **Departments:** The `departments` table stores the list of departments (name, code). The `admin_departments` table links administrators to the departments they manage.  
- **Groups and members:** `project_groups` stores each group (name, department, avg_gpa, status, supervisor_name, etc.). `group_members` stores each member of a group (group_id, student_name, student_gpa, gpa_tier, matric_number, member_order).  
- **Supervisors:** `supervisor_workload` holds the current list of supervisors used for allocation (supervisor_name, department, current_groups, is_available).  
- **Projects and reports:** `projects` stores one project per group (group_id, title, status, progress_percentage, etc.). `reports` stores submitted reports (project_id, group_id, report_type, title, file path, submitted_by, reviewed, reviewed_by, review_comments).  
- **Evaluations:** The `evaluations` table stores supervisor evaluations (project_id, supervisor_id, evaluation_type, scores, grade, feedback).  
- **Messages and notifications:** `messages` stores sender, recipient, group_id (optional), subject, content, and read status. `notifications` stores user_id, title, message, type, and read status.  
- **Defense scheduling:** `defense_allocations` stores venue_name, department, group_start, group_end, and assessors (e.g. as JSON).  
- **Configuration:** `department_settings` stores per-department GPA tier thresholds and related settings. Global or other system settings may be stored in tables such as `system_settings` where implemented.

All inserts, updates, and deletes are performed through parameterised queries to avoid SQL injection. Where multiple tables must be updated consistently (e.g. group formation, supervisor assignment), the code uses database transactions (begin, commit, rollback) to ensure atomicity.

### 4.5.3 Database Schema and Structure

The database schema is relational and normalised to support the operations described above. The main entities and their relationships are summarised here.

**Core tables**  
- **users:** Primary key `id`. Columns include first_name, last_name, email, password_hash, role, department. Referenced by students, supervisors, messages, notifications, and review/submission fields in reports.  
- **departments:** Primary key `id`; name and code (unique). Referenced by admin_departments and used logically to scope project_groups, group_members, and supervisor_workload by department name.  
- **admin_departments:** Links user_id (admin) to department_id; used to restrict which departments an admin can manage.  
- **project_groups:** Primary key `id`. Stores name, department, avg_gpa, status, supervisor_name, and timestamps. Referenced by group_members, projects, and reports (via group_id where applicable).  
- **group_members:** Primary key `id`; foreign key group_id → project_groups(id) ON DELETE CASCADE. Stores student_name, student_gpa, gpa_tier, matric_number, member_order.  
- **supervisor_workload:** Primary key `id`. Stores supervisor_name, department, current_groups, is_available. Unique on (supervisor_name, department). Used for allocation and workload display.  
- **projects:** Primary key `id`; foreign key group_id → project_groups(id). One project per group; stores title, status, progress_percentage, etc.  
- **reports:** Primary key `id`; foreign keys project_id → projects(id), group_id → project_groups(id), submitted_by → users(id), reviewed_by → users(id). Stores report metadata and review outcome.  
- **evaluations:** Primary key `id`; foreign keys project_id → projects(id), supervisor_id → supervisors(id). Stores evaluation type, scores, grade, and feedback.  
- **messages:** Primary key `id`; foreign keys sender_id, recipient_id → users(id); optional group_id → project_groups(id), parent_id → messages(id).  
- **notifications:** Primary key `id`; foreign key user_id → users(id).  
- **defense_allocations:** Primary key `id`. Columns include venue_name, department, group_start, group_end, assessors (JSON). Indexed for lookups by department and group number range.  
- **department_settings:** Stores department name and GPA tier thresholds (and related flags) for use during group formation.

**Relationships and constraints**  
- Each group has many group_members; each group_member belongs to one project_group.  
- Each project_group has at most one supervisor (stored by name) and is associated with one project.  
- Reports and evaluations are tied to projects and thus to groups.  
- Messages and notifications are tied to users; messages can optionally be associated with a group.  
- Defense allocations are matched to groups by department and by parsing group number from the group name to check membership in [group_start, group_end].

This schema supports the functional requirements of the system: user management, department management, GPA-based grouping, supervisor allocation, project and report lifecycle, evaluations, communication, and defense scheduling, while maintaining referential integrity and enabling efficient queries for dashboards, lists, and detail views.
