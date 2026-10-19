import 'dotenv/config'; import pg from 'pg';
const {Pool}=pg;
export const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
pool.on('error',e=>console.error('PostgreSQL error',e));
