# Parent2Parent

**Previously loved. Ready for more.**

A premium second-hand baby and kids product marketplace for South African parents. Built with React, Express, and SQLite.

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Seed the database with sample data
npm run seed

# Start development servers (frontend on :3000, backend on :3001)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- **Frontend**: React (Vite), React Router v6, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Auth**: JWT with httpOnly cookies
- **Image Uploads**: Multer (local storage)

## Project Structure

```
parent2parent/
├── client/          # React frontend (Vite)
│   ├── public/      # Static assets
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── pages/       # Route pages
│       ├── context/     # React context (Auth)
│       ├── hooks/       # Custom hooks
│       └── utils/       # Utility functions
├── server/          # Express backend
│   ├── db/          # Schema & seed data
│   ├── middleware/  # Auth & upload middleware
│   ├── routes/      # API route handlers
│   └── uploads/     # Image upload storage
└── package.json     # Root scripts
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/listings | Browse listings (with filters) |
| GET | /api/listings/:id | Get single listing |
| POST | /api/listings | Create listing (auth) |
| PUT | /api/listings/:id | Update listing (auth) |
| DELETE | /api/listings/:id | Delete listing (auth) |
| GET | /api/categories | List categories |
| GET | /api/users/:id | Get user profile |
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user (auth) |

Made with love in South Africa.
