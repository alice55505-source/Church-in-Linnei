import { json } from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  return json({ client_id: env.GOOGLE_CLIENT_ID || '' });
}
