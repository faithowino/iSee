import {pool} from '../db/pool.js';
export async function byUsername(u){const q=await pool.query('SELECT * FROM users WHERE LOWER(username)=LOWER($1)',[u]);return q.rows[0]||null}
export async function create({username,passwordHash,email}){const q=await pool.query('INSERT INTO users(username,password_hash,email) VALUES($1,$2,$3) RETURNING id,username,email',[username,passwordHash,email||null]);return q.rows[0]}
export async function session(id){const q=await pool.query('SELECT u.id,u.username,u.is_blocked,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>NOW()',[id]);return q.rows[0]||null}
export async function addSession(id,userId){await pool.query("INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",[id,userId])}
export async function removeSession(id){await pool.query('DELETE FROM sessions WHERE id=$1',[id])}
export async function recoveryUser(u){const q=await pool.query('SELECT id,username,email,recovery_otp_hash,recovery_otp_expires_at,recovery_otp_attempts FROM users WHERE LOWER(username)=LOWER($1)',[u]);return q.rows[0]||null}
export async function setOtp(id,hash,expires){await pool.query('UPDATE users SET recovery_otp_hash=$1,recovery_otp_expires_at=$2,recovery_otp_attempts=0 WHERE id=$3',[hash,expires,id])}
export async function bumpOtp(id){await pool.query('UPDATE users SET recovery_otp_attempts=recovery_otp_attempts+1 WHERE id=$1',[id])}
export async function clearOtp(id){await pool.query('UPDATE users SET recovery_otp_hash=NULL,recovery_otp_expires_at=NULL,recovery_otp_attempts=0 WHERE id=$1',[id])}
export async function setPassword(id,h){await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2',[h,id])}
