# Campus Connect — Angular + Spring Boot + MySQL

A full-stack campus portal with a student dashboard, dynamic academic branches/subjects, admin-managed PDF resources, SEE/CIE question papers, and Lost & Found.

## Prerequisites
- Java 21, Maven 3.9+
- Node.js 20+ and npm
- MySQL Server 8+ and MySQL Workbench (Workbench is the GUI, MySQL Server runs the database)

## 1. Database setup in MySQL Workbench
Connect to your local MySQL Server, open a SQL tab, run:
```sql
CREATE DATABASE IF NOT EXISTS campus_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Tables are created/updated automatically by Spring Data JPA when the backend starts.

## 2. Run the backend
In a terminal from `backend/`:

Linux/macOS:
```bash
export DB_USER=root
export DB_PASSWORD='your-mysql-password'
export ADMIN_EMAIL='admin@campus.local'
export ADMIN_PASSWORD='choose-a-strong-password'
mvn spring-boot:run
```
Windows PowerShell:
```powershell
$env:DB_USER='root'
$env:DB_PASSWORD='your-mysql-password'
$env:ADMIN_EMAIL='admin@campus.local'
$env:ADMIN_PASSWORD='choose-a-strong-password'
mvn spring-boot:run
```
Backend runs at http://localhost:8080. Test http://localhost:8080/api/health. On first start it creates an admin user with your configured credentials. **Set ADMIN_PASSWORD before first launch and do not commit passwords.**

## 3. Run Angular
In another terminal from `frontend/`:
```bash
npm install
npm start
```
Visit http://localhost:4200.

## 4. Try the app
1. Sign in using `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Open **Manage Campus** and add a branch (e.g. AIML).
3. Add a subject to a branch and semester.
4. Upload a study PDF or SEE/CIE question paper.
5. Open Study Resources / Question Papers and filter by branch, semester, subject, exam.
6. Register a student account and post a Lost & Found item.

## REST endpoints
- `POST /api/auth/register`, `GET /api/auth/me`
- `GET/POST /api/branches`, `DELETE /api/branches/{id}`
- `GET/POST /api/subjects`, `DELETE /api/subjects/{id}`
- `GET/POST /api/documents`, `GET /api/documents/{id}/file`, `DELETE /api/documents/{id}`
- `GET/POST /api/items`, `PUT /api/items/{id}/close`

All POST/DELETE operations for academic management require ADMIN role. Lost & Found posting requires login. Authentication uses HTTP Basic with bcrypt-hashed passwords and sessionStorage for the local development demo. For a production deployment, use HTTPS and a more robust session/token strategy, configure rate limits and audit logs, enforce PDF scanning and MIME checks, add pagination, improve upload streaming, use schema migrations, and move PDFs to object storage. This is a functional local development starter, **not a production-hardened service**.

## Design notes
- `subjects` references `branches`, with a semester number on each subject. This allows branches and subjects to be added without code changes. Semesters 1–8 are UI options; change this if your college requires other values.
- `academic_documents` stores metadata and random storage filenames; PDFs live in `backend/uploads` by default.
- Deleting a branch/subject with dependent records may be blocked by foreign-key constraints; remove dependencies first.
- The frontend currently expects the backend at `http://localhost:8080/api` and allows the Angular dev server at `http://localhost:4200`.
