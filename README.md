# AI Student Tone Rewriter

Kotlin Spring Boot backend and Next.js frontend for a full stack student writing assistant.

Prepared by: Amgain Keshab (M25W7495)

## Overview

AI Student Tone Rewriter helps students rewrite English text in a clear and natural student style while keeping the original meaning, facts, order, and important terms.

The project includes a real REST API, MySQL database, account system, rewrite history, admin controls, file upload, output download, Docker support, and Docker Hub images.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Kotlin, Spring Boot, Java 17, Maven |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Database | MySQL, Hibernate JPA |
| Security | Spring Security, Basic Auth |
| AI / Vocabulary | OpenAI API, Datamuse API |
| File Upload | Apache POI for DOCX, PDFBox for PDF |
| Deployment | Docker Compose, Docker Hub |

## Main Features

- Grammar, academic, simple, shorter, longer, and paraphrase rewrite modes.
- Student level modes from C1-C2 advanced to A1-A2 basic.
- Type, paste, or upload TXT, MD, DOCX, and PDF files.
- Custom prompt settings and avoid-word control.
- Changed-word highlights, vocabulary suggestions, checklist score, and final decision.
- Copy output or download as TXT/PDF.
- Guest history with browser localStorage.
- User registration, login, dashboard, profile, and saved history.
- History search, mode filter, sorting, edit, delete, and export.
- Contact form and admin management for prompts, users, messages, and audit logs.

## Project Structure

```text
Web-3/
├── backend/        Kotlin Spring Boot REST API
├── frontend/       Next.js React frontend
├── database/       MySQL schema
├── Final Docs/     Project documentation
└── docker-compose.yml
```

## Quick Start With Docker

Run the full project from the repository root:

```powershell
docker compose up -d --build
```

Open:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:8080
```

Check backend:

```powershell
Invoke-WebRequest http://localhost:8080/api/rewrites/modes
```

Stop containers:

```powershell
docker compose down
```

## Docker Hub Images

```text
Backend image:  keshab3/ai-writing-kotlin-backend:latest
Frontend image: keshab3/ai-writing-kotlin-frontend:latest
```

Links:

- Backend: https://hub.docker.com/r/keshab3/ai-writing-kotlin-backend
- Frontend: https://hub.docker.com/r/keshab3/ai-writing-kotlin-frontend

## Local Development

Start MySQL and backend with Docker:

```powershell
docker compose up -d mysql backend
```

Run frontend locally:

```powershell
cd frontend
npm install
npm run dev -- --port 3001
```

Open:

```text
http://localhost:3001
```

If the frontend says the backend is not reachable, make sure the backend is running on `8080` and that the frontend port is allowed in `CORS_ALLOWED_ORIGINS` inside `docker-compose.yml`.

## Backend Commands

```powershell
cd backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

## Frontend Commands

```powershell
cd frontend
npm install
npm run lint
npx tsc --noEmit
npm run build
```

## Default Accounts

| Role | Username | Password |
| --- | --- | --- |
| Admin | admin | admin123 |
| User | student | student123 |

These values can be changed with environment variables in `docker-compose.yml`.

## Main API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Register user |
| GET | `/api/auth/me` | Current user session |
| POST | `/api/rewrites/preview` | Guest rewrite preview |
| POST | `/api/rewrites` | Create logged-in rewrite |
| GET | `/api/rewrites` | Read rewrite history |
| GET | `/api/rewrites/modes` | Read rewrite modes |
| GET | `/api/rewrites/stats` | Read dashboard stats |
| PUT | `/api/rewrites/{id}` | Update rewrite |
| DELETE | `/api/rewrites/{id}` | Delete rewrite |
| POST | `/api/uploads/text` | Extract text from uploaded file |
| GET / PUT | `/api/profile` | Read or update profile |
| GET / PUT | `/api/user/prompt-settings` | User prompt settings |
| POST | `/api/contact` | Send contact message |
| GET / PUT | `/api/admin/prompt-settings` | Admin prompt controls |
| GET / POST / PUT / DELETE | `/api/admin/users` | Admin user management |

## Testing

Backend tests:

```powershell
cd backend
.\mvnw.cmd test
```

Frontend checks:

```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

## Troubleshooting

### Backend is not reachable at `localhost:8080`

Check if Docker backend is running:

```powershell
docker compose ps
```

Start backend and database:

```powershell
docker compose up -d mysql backend
```

Check if port `8080` is busy:

```powershell
netstat -ano | findstr :8080
```

### Frontend works on `3000` but not another port

The Docker frontend uses `http://localhost:3000`. If you run Next.js locally on another port, such as `3001` or `3003`, add that origin to backend CORS:

```yaml
CORS_ALLOWED_ORIGINS: http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001
```

Then restart backend:

```powershell
docker compose up -d --build backend
```

## Final Result

The final project provides a complete student-focused writing assistant with a Kotlin Spring Boot backend, Next.js frontend, MySQL database, Docker Compose setup, Docker Hub images, user/admin features, rewrite history, file upload, output download, and responsive UI.

Future improvements may include email verification, password reset, Word export, stronger dashboard charts, more language support, more automated tests, security hardening, and cloud deployment.

## Project Links

- GitHub repository: https://github.com/keshab3/ai-student-rewriter
- Docker Hub backend: https://hub.docker.com/r/keshab3/ai-writing-kotlin-backend
- Docker Hub frontend: https://hub.docker.com/r/keshab3/ai-writing-kotlin-frontend
