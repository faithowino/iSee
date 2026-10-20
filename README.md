# iSee — Missed Connections
# iSee — Missed Connections

**Sometimes a moment is all it takes. ♡**

iSee is a campus-focused missed connections web application designed to help people reconnect after a brief encounter, a shared glance, or a conversation that never happened. It provides a central notice board where users can share their experiences, discover connections, and take a chance on meeting someone new.

The application combines a responsive React interface with an Express API and PostgreSQL database. It supports anonymous and account-associated posts, community interactions, and content moderation capabilities.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Commands](#available-commands)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [Security and Moderation](#security-and-moderation)
- [Current Limitations](#current-limitations)
- [License](#license)

## Overview

Missed connections happen every day on campus: someone you noticed in class, someone you passed in the hallway, or someone you wished you had spoken to.

iSee gives those moments a place to live.

Users can browse missed connections by date and location, write posts, leave comments, express interest through **Connect**, and report inappropriate content. Account creation is optional for posting and interacting with the board, while registered users can manage their saved posts.

The project is designed with a repository-based backend architecture so that the user interface communicates through an API rather than depending directly on database implementation details.

## Features

### Missed Connections Board

- Browse posts organized by connection date.
- Search for posts and filter by campus location.
- Create text-only missed connection posts.
- Browse past and current dates.
- Use a responsive interface designed for desktop and mobile screens.

### Community Interactions

- **Connect:** Respond to a missed connection when you believe a post may be about you. Each original post is limited to five Connect responses.
- **Comments:** Add general commentary separately from Connect responses.
- **Likes:** Like and unlike posts.
- **Reports:** Report posts, replies, and comments for review.

### User Accounts

- Create an account with a unique username and password.
- Optionally provide a recovery email address.
- Log in and log out using session cookies.
- View and delete posts associated with your account.
- Recover an account using a time-limited verification code when email delivery is configured.

Anonymous posts are not associated with a registered user account. Account-based and anonymous posting should be treated as distinct choices.

### Content Moderation

The backend includes moderation capabilities intended to support a respectful community:

- Automated keyword-based content checks.
- A moderation queue for flagged content.
- Reporting thresholds that can move content into pending moderation.
- Administrative actions to approve, hide, or delete content.
- User blocking and unblocking.
- An audit trail of administrative actions.

Administrative functionality is exposed through API endpoints; a complete administrator dashboard is not included in this documentation as an assumed, verified feature.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Frontend tooling | Vite |
| Backend | Node.js and Express |
| Database | PostgreSQL |
| Database access | `pg` |
| Authentication | Session cookies and `bcryptjs` password hashing |
| Password recovery email | Nodemailer and SMTP |
| Production packaging | Docker |
| Deployment target | Fly.io |

## Architecture

The application is organized into three main layers.

```text
iSee
├── src/
│   └── Frontend application
│
├── server/
│   ├── index.js
│   ├── db/
│   │   ├── pool.js
│   │   └── migrate.js
│   ├── repositories/
│   │   ├── users.js
│   │   ├── content.js
│   │   └── admin.js
│   └── services/
│       └── moderation.js
│
├── Dockerfile
├── fly.toml
├── package.json
├── package-lock.json
└── README.md
```

**Frontend:** React renders the board, forms, navigation, and user interactions.

**API:** Express provides endpoints for authentication, posts, comments, Connect responses, likes, reporting, and administrative actions. In production, Express also serves the compiled frontend from `dist/`.

**Data layer:** PostgreSQL stores persistent application data. Repository modules separate database operations from API route handlers, allowing storage implementation details to remain outside the user interface.

## Getting Started

### Prerequisites

Install the following before running the project locally:

- Node.js 20 or a compatible supported version.
- npm.
- A running PostgreSQL database.
- Git, if cloning the repository.

### 1. Obtain the source code

Clone the repository:

```bash
git clone <repository-url>
cd <repository-directory>
```

Replace the placeholders with your actual Git repository URL and directory name.

### 2. Install dependencies

```bash
npm ci
```

This installs the dependencies recorded in `package-lock.json`.

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and configure your local PostgreSQL connection and any optional services you plan to use.

### 4. Create and migrate the database

Create a PostgreSQL database for iSee and configure `DATABASE_URL` to point to it.

Then run:

```bash
npm run db:migrate
```

The migration script initializes the application's database schema and any seed data defined by the project.

Ensure that the database is running and accessible before running migrations.

### 5. Start the development server

```bash
npm run dev
```

The development script starts Vite and the Express API together.

By default, Vite serves the frontend on port `5173`, while the API listens on port `3001`. Use the actual URLs printed in your terminal if your local configuration differs.

### 6. Build for production

```bash
npm run build
```

This generates the production frontend in `dist/`.

To start the production-configured Express server locally:

```bash
npm start
```

A working PostgreSQL connection and appropriately configured environment variables are required for database-dependent functionality.

## Environment Variables

Configure the variables required by the project in your local `.env` file or deployment environment.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Express server port; defaults to `3001` |
| `NODE_ENV` | Application environment, such as `development` or `production` |
| `SESSION_DAYS` | Session cookie lifetime in days; defaults to `30` |
| `OTP_MINUTES` | Password recovery code validity period in minutes; defaults to `10` |
| `ADMIN_USERNAME` | Optional initial administrator username, if supported by the migration configuration |
| `ADMIN_PASSWORD` | Optional initial administrator password, if supported by the migration configuration |
| `SMTP_HOST` | SMTP server hostname for recovery emails |
| `SMTP_PORT` | SMTP server port; defaults to `587` |
| `SMTP_USER` | SMTP authentication username |
| `SMTP_PASS` | SMTP authentication password |
| `SMTP_FROM` | Sender identity for recovery messages |

Use the project's `.env.example` as the reference for the exact expected variable names and defaults.

**Never commit `.env` files, database passwords, email credentials, or deployment secrets to Git.** Use Fly.io secrets for production credentials.

Password recovery requires working email delivery in production. The development fallback that prints verification codes to logs must not be treated as a production email service.

## Available Commands

| Command | Description |
|---|---|
| `npm install` | Install dependencies and update the lockfile if needed |
| `npm ci` | Install dependencies from the existing lockfile |
| `npm run dev` | Start the Vite frontend and Express API |
| `npm run build` | Build the production frontend |
| `npm start` | Start the production-configured Express server |
| `npm run db:migrate` | Run database migrations |

## API Overview

All API endpoints use the `/api` prefix.

### Health and Application Data

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check application and database availability |
| `GET` | `/api/me` | Retrieve the current session user |
| `GET` | `/api/locations` | Retrieve available campus locations |
| `GET` | `/api/posts` | Retrieve posts with date, search, and location filters |
| `GET` | `/api/posts/:id` | Retrieve a specific post |

The health endpoint checks PostgreSQL connectivity. A successful health check confirms that the database accepts a simple query, not that every application feature has been tested.

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | Create an account |
| `POST` | `/api/auth/login` | Authenticate a user |
| `POST` | `/api/auth/logout` | End the current session |
| `POST` | `/api/auth/request-otp` | Request an account recovery code |
| `POST` | `/api/auth/reset-password` | Reset a password using a valid code |

### Community Content

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/posts` | Create a missed connection |
| `POST` | `/api/posts/:id/like` | Toggle a post like |
| `POST` | `/api/posts/:id/replies` | Add a Connect response |
| `POST` | `/api/posts/:id/comments` | Add a general comment |
| `POST` | `/api/report` | Report a post, reply, or comment |
| `GET` | `/api/my-posts` | Retrieve the logged-in user's posts |
| `DELETE` | `/api/my-posts/:id` | Delete an owned post |

### Administration

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/admin/queue` | Retrieve the moderation queue |
| `POST` | `/api/admin/moderate` | Change a content moderation status |
| `POST` | `/api/admin/block-user` | Block a user |
| `POST` | `/api/admin/unblock-user` | Unblock a user |

Administrative endpoints require an authenticated administrator session. These routes are backend capabilities and do not imply that all corresponding administrative controls are available in the public interface.

## Deployment

iSee is configured for deployment on Fly.io using Docker.

The deployment uses:

- `Dockerfile` to build the application image.
- `fly.toml` to configure the Fly app, region, service, and health checks.
- Fly.io secrets to store production configuration.
- A separate, self-managed PostgreSQL instance with persistent storage.

The intended database approach is **self-managed PostgreSQL, not Fly.io Managed Postgres**.

### Deployment Checklist

1. Confirm the `Dockerfile`, `fly.toml`, `.dockerignore`, and `package-lock.json` are present.
2. Validate the Fly configuration:

   ```bash
   fly config validate
   ```

3. Provision the PostgreSQL server and persistent volume.
4. Restrict database access to the appropriate private network and configure a secure connection string.
5. Store `DATABASE_URL` and other production credentials using Fly.io secrets.
6. Run database migrations from an environment that can securely reach PostgreSQL.
7. Deploy the application:

   ```bash
   fly deploy
   ```

8. Verify the application's health endpoint and test account creation, login, posting, and moderation.

Keep the web server configuration aligned with the application's listening port. The current configuration uses port `3001`.

Self-managed PostgreSQL requires you to plan for backups, restoration, upgrades, and database availability. A persistent volume alone is not a backup. Test the recovery process before relying on the service for real user data.

## Security and Moderation

iSee handles account credentials, user-generated content, and moderation records. Production deployments should follow these practices:

- Use strong, unique credentials and store them as secrets.
- Keep PostgreSQL private rather than exposing its port publicly.
- Enable HTTPS for the public application.
- Configure SMTP before enabling production password recovery.
- Keep Node.js and dependencies updated.
- Apply database migrations deliberately and maintain restorable backups.
- Monitor application errors, memory usage, and database storage.
- Review reports and moderation actions regularly.
- Avoid publishing personal information about other people in missed connection posts.
- Make it clear that anonymous posting means a post is not associated with a registered account; it should not be presented as a guarantee of complete anonymity.

Automated moderation and report thresholds can assist with review, but they do not replace a human moderation process.

