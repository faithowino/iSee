import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db/pool.js';
import * as U from './repositories/users.js';
import * as C from './repositories/content.js';
import * as A from './repositories/admin.js';
import { moderate } from './services/moderation.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Pass errors from async Express handlers to the central error handler.
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: Number(process.env.SESSION_DAYS || 30) * 86400000,
});

async function me(req) {
  return req.cookies?.isee_session
    ? U.session(req.cookies.isee_session)
    : null;
}

const user = asyncHandler(async (req, res, next) => {
  req.user = await me(req);

  if (!req.user) {
    return res.status(401).json({ error: 'You must be logged in.' });
  }

  if (req.user.is_blocked) {
    return res.status(403).json({ error: 'This account is blocked.' });
  }

  next();
});

const admin = asyncHandler(async (req, res, next) => {
  req.user = await me(req);

  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  next();
});

function visitor(req, res) {
  if (req.cookies?.isee_visitor) return req.cookies.isee_visitor;

  const token = crypto.randomBytes(24).toString('hex');

  res.cookie('isee_visitor', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 31536000000,
  });

  return token;
}

async function mailOtp(email, otp) {
  if (!process.env.SMTP_HOST) {
    // Development only. Configure SMTP environment variables before production use.
    console.log(`[DEV OTP] ${email}: ${otp}`);
    return;
  }

  const port = Number(process.env.SMTP_PORT || 587);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'iSee <no-reply@example.com>',
    to: email,
    subject: 'Your iSee recovery code',
    text: `Your iSee recovery code is ${otp}. It expires in ${process.env.OTP_MINUTES || 10} minutes.`,
  });
}

function isValidPastOrCurrentDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.toISOString().slice(0, 10) !== date) return false;

  // Compare calendar dates, not the current time of day.
  // This allows posts dated today.
  const today = new Date().toISOString().slice(0, 10);

  return date <= today;
}

// Health checks only pass when both the server and PostgreSQL are reachable.
app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  }),
);

app.get(
  '/api/me',
  asyncHandler(async (req, res) => {
    const currentUser = await me(req);

    res.json({
      user: currentUser
        ? {
            id: currentUser.id,
            username: currentUser.username,
            isAdmin: currentUser.is_admin,
          }
        : null,
    });
  }),
);

app.get(
  '/api/locations',
  asyncHandler(async (_req, res) => {
    res.json({ locations: await C.locations() });
  }),
);

app.post(
  '/api/auth/signup',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const email = String(body.email || '').trim().toLowerCase() || null;

    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3–30 letters, numbers, or underscores.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters.',
      });
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        error: 'Enter a valid email address.',
      });
    }

    if (await U.byUsername(username)) {
      return res.status(409).json({
        error: 'That username is already taken.',
      });
    }

    const createdUser = await U.create({
      username,
      passwordHash: await bcrypt.hash(password, 12),
      email,
    });

    const sessionId = crypto.randomUUID();

    await U.addSession(sessionId, createdUser.id);

    res.cookie('isee_session', sessionId, sessionCookieOptions())
      .status(201)
      .json({ user: createdUser });
  }),
);

app.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const foundUser = await U.byUsername(username);

    if (
      !foundUser ||
      !(await bcrypt.compare(password, foundUser.password_hash))
    ) {
      return res.status(401).json({
        error: 'Incorrect username or password.',
      });
    }

    if (foundUser.is_blocked) {
      return res.status(403).json({
        error: 'This account is blocked.',
      });
    }

    const sessionId = crypto.randomUUID();

    await U.addSession(sessionId, foundUser.id);

    res.cookie('isee_session', sessionId, sessionCookieOptions()).json({
      user: {
        id: foundUser.id,
        username: foundUser.username,
        isAdmin: foundUser.is_admin,
      },
    });
  }),
);

app.post(
  '/api/auth/logout',
  asyncHandler(async (req, res) => {
    if (req.cookies?.isee_session) {
      await U.removeSession(req.cookies.isee_session);
    }

    res.clearCookie('isee_session').json({ ok: true });
  }),
);

app.post(
  '/api/auth/request-otp',
  asyncHandler(async (req, res) => {
    const username = String((req.body || {}).username || '').trim();
    const recoveryUser = await U.recoveryUser(username);

    // Do not reveal whether an account exists or has a recovery email.
    if (recoveryUser?.email) {
      const otp = String(crypto.randomInt(100000, 1000000));
      const expiryMinutes = Number(process.env.OTP_MINUTES || 10);

      await U.setOtp(
        recoveryUser.id,
        await bcrypt.hash(otp, 10),
        new Date(Date.now() + expiryMinutes * 60000),
      );

      await mailOtp(recoveryUser.email, otp);
    }

    res.json({ ok: true });
  }),
);

app.post(
  '/api/auth/reset-password',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const recoveryUser = await U.recoveryUser(
      String(body.username || '').trim(),
    );

    const otp = String(body.otp || '');
    const password = String(body.password || '');

    if (
      !recoveryUser?.recovery_otp_hash ||
      !recoveryUser.recovery_otp_expires_at ||
      new Date(recoveryUser.recovery_otp_expires_at) < new Date() ||
      recoveryUser.recovery_otp_attempts >= 5
    ) {
      return res.status(400).json({
        error: 'That recovery code is invalid or expired.',
      });
    }

    if (!(await bcrypt.compare(otp, recoveryUser.recovery_otp_hash))) {
      await U.bumpOtp(recoveryUser.id);

      return res.status(400).json({
        error: 'That recovery code is incorrect.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters.',
      });
    }

    await U.setPassword(
      recoveryUser.id,
      await bcrypt.hash(password, 12),
    );

    await U.clearOtp(recoveryUser.id);

    const sessionId = crypto.randomUUID();

    await U.addSession(sessionId, recoveryUser.id);

    res.cookie('isee_session', sessionId, sessionCookieOptions()).json({
      user: {
        id: recoveryUser.id,
        username: recoveryUser.username,
        // /api/me remains the authoritative source for admin status.
        isAdmin: false,
      },
    });
  }),
);

app.get(
  '/api/posts',
  asyncHandler(async (req, res) => {
    const date = String(
      req.query.date || new Date().toISOString().slice(0, 10),
    );

    const search = String(req.query.search || '').trim();
    const location = String(req.query.location || '').trim();

    const posts = await C.posts({
      date,
      search,
      location,
      sort: req.query.sort,
    });

    res.json({ posts });
  }),
);

app.get(
  '/api/posts/:id',
  asyncHandler(async (req, res) => {
    const post = await C.get(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    res.json(post);
  }),
);

app.post(
  '/api/posts',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const currentUser = await me(req);
    const location = String(body.location || '').trim();
    const date = String(body.date || '');
    const content = String(body.content || '').trim();
    const time = String(body.time || '').trim() || null;

    const locationId = await C.locationId(location);

    if (!locationId) {
      return res.status(400).json({
        error: 'Choose a valid campus location.',
      });
    }

    if (!isValidPastOrCurrentDate(date)) {
      return res.status(400).json({
        error: 'Choose a valid past or current date.',
      });
    }

    if (content.length < 10 || content.length > 500) {
      return res.status(400).json({
        error: 'Message must be 10–500 characters.',
      });
    }

    const moderation = moderate(content);

    const id = await C.createPost({
      authorId: currentUser?.id || null,
      locationId,
      date,
      time,
      text: content,
      status: moderation.status,
      reason: moderation.reason,
    });

    res.status(201).json({
      id,
      moderationStatus: moderation.status,
    });
  }),
);

app.post(
  '/api/posts/:id/like',
  asyncHandler(async (req, res) => {
    const token = visitor(req, res);

    const existing = await pool.query(
      'SELECT id FROM likes WHERE post_id = $1 AND visitor_token = $2',
      [req.params.id, token],
    );

    if (existing.rowCount) {
      await pool.query(
        'DELETE FROM likes WHERE id = $1',
        [existing.rows[0].id],
      );
    } else {
      await pool.query(
        `INSERT INTO likes(post_id, visitor_token)
         VALUES($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.params.id, token],
      );
    }

    const result = await pool.query(
      'SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1',
      [req.params.id],
    );

    res.json({ count: result.rows[0].count });
  }),
);

app.post(
  '/api/posts/:id/replies',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const currentUser = await me(req);
    const content = String(body.content || '').trim();
    const post = await C.get(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.replies.length >= 5) {
      return res.status(409).json({
        error: 'This connection already has 5 Connect responses.',
      });
    }

    if (!content || content.length > 500) {
      return res.status(400).json({
        error: 'Connect must be 1–500 characters.',
      });
    }

    const moderation = moderate(content);

    await C.addReply({
      postId: req.params.id,
      authorId: currentUser?.id || null,
      text: content,
      status: moderation.status,
      reason: moderation.reason,
    });

    res.status(201).json({
      moderationStatus: moderation.status,
    });
  }),
);

app.post(
  '/api/posts/:id/comments',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const currentUser = await me(req);
    const content = String(body.content || '').trim();
    const post = await C.get(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (!content || content.length > 300) {
      return res.status(400).json({
        error: 'Comment must be 1–300 characters.',
      });
    }

    const moderation = moderate(content);

    await C.addComment({
      postId: req.params.id,
      authorId: currentUser?.id || null,
      text: content,
      status: moderation.status,
      reason: moderation.reason,
    });

    res.status(201).json({
      moderationStatus: moderation.status,
    });
  }),
);

app.post(
  '/api/report',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const token = visitor(req, res);

    const { type, id, reason, details } = body;

    const tableByType = {
      post: 'posts',
      reply: 'replies',
      comment: 'comments',
    };

    const table = tableByType[type];

    if (!table) {
      return res.status(400).json({
        error: 'Invalid report target.',
      });
    }

    const column = `${type}_id`;

    const target = await pool.query(
      `SELECT id FROM ${table} WHERE id = $1`,
      [id],
    );

    if (!target.rowCount) {
      return res.status(404).json({
        error: 'Content not found.',
      });
    }

    const duplicate = await pool.query(
      `SELECT id FROM reports
       WHERE ${column} = $1 AND visitor_token = $2`,
      [id, token],
    );

    if (duplicate.rowCount) {
      return res.status(409).json({
        error: 'You already reported this item.',
      });
    }

    await pool.query(
      `INSERT INTO reports(${column}, visitor_token, reason, details)
       VALUES($1, $2, $3, $4)`,
      [
        id,
        token,
        String(reason || 'Other'),
        String(details || '').slice(0, 500),
      ],
    );

    const reportCount = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM reports
       WHERE ${column} = $1`,
      [id],
    );

    if (
      ['Personal information', 'Threat or violence'].includes(reason) ||
      reportCount.rows[0].count >= 3
    ) {
      await pool.query(
        `UPDATE ${table}
         SET moderation_status = 'pending',
             moderation_reason = $1
         WHERE id = $2`,
        ['User report threshold reached', id],
      );
    }

    res.json({ ok: true });
  }),
);

app.get(
  '/api/my-posts',
  user,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT p.id, p.connection_date,
              to_char(p.connection_time, 'FMHH12:MI AM') AS time,
              p.content, p.moderation_status, l.name AS location
       FROM posts p
       JOIN locations l ON l.id = p.location_id
       WHERE p.author_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id],
    );

    res.json({ posts: result.rows });
  }),
);

app.delete(
  '/api/my-posts/:id',
  user,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `DELETE FROM posts
       WHERE id = $1 AND author_id = $2
       RETURNING id`,
      [req.params.id, req.user.id],
    );

    if (!result.rowCount) {
      return res.status(403).json({
        error: 'You can only delete your own saved posts.',
      });
    }

    res.json({ ok: true });
  }),
);

app.get(
  '/api/admin/queue',
  admin,
  asyncHandler(async (_req, res) => {
    res.json({ items: await A.queue() });
  }),
);

app.post(
  '/api/admin/moderate',
  admin,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const { type, id, status } = body;

    if (!['post', 'reply', 'comment'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid moderation target.',
      });
    }

    if (!['approved', 'pending', 'hidden', 'deleted'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid moderation status.',
      });
    }

    if (status === 'deleted') {
      await A.remove(type, id);
    } else {
      await A.moderate(type, id, status);
    }

    await A.log(req.user.id, status, type, id);

    res.json({ ok: true });
  }),
);

app.post(
  '/api/admin/block-user',
  admin,
  asyncHandler(async (req, res) => {
    const userId = Number((req.body || {}).userId);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID.',
      });
    }

    await A.block(userId, true);
    await A.log(req.user.id, 'block_user', 'user', userId);

    res.json({ ok: true });
  }),
);

app.post(
  '/api/admin/unblock-user',
  admin,
  asyncHandler(async (req, res) => {
    const userId = Number((req.body || {}).userId);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID.',
      });
    }

    await A.block(userId, false);
    await A.log(req.user.id, 'unblock_user', 'user', userId);

    res.json({ ok: true });
  }),
);

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');

  app.use(express.static(dist));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// Final error handler. Never expose stack traces or secret configuration to clients.
app.use((error, req, res, _next) => {
  console.error('Request failed:', error);

  if (res.headersSent) return;

  const errorCode = Number(error.status || error.statusCode);

  const status =
    errorCode >= 400 && errorCode < 600
      ? errorCode
      : 500;

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({
      error: status === 500
        ? 'Internal server error.'
        : error.message,
    });
  }

  res.status(status).send(
    status === 500
      ? 'Internal server error.'
      : error.message,
  );
});

app.listen(PORT, () => {
  console.log(`iSee running on ${PORT}`);
});