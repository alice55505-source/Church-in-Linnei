import { json } from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  return json({ key: env.VAPID_PUBLIC_KEY || '' });
}
