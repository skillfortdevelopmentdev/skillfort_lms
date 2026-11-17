import { loadDB, saveDB } from '../db';

export interface InboxMessage {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  date: string;
  read: boolean;
  category: string;
  body: string;
}

export async function appendInboxMessage(
  userId: string,
  message: Omit<InboxMessage, 'id' | 'date' | 'read'> & { id?: string; date?: string; read?: boolean }
): Promise<void> {
  const db = await loadDB();
  const key = `skillfort_emails_${userId}`;
  const existing = db.platformKv[key];
  const list: InboxMessage[] = Array.isArray(existing) ? (existing as InboxMessage[]) : [];

  const entry: InboxMessage = {
    id: message.id ?? `email-${Date.now()}`,
    subject: message.subject,
    sender: message.sender,
    recipient: message.recipient,
    date: message.date ?? new Date().toISOString().split('T')[0],
    read: message.read ?? false,
    category: message.category,
    body: message.body,
  };

  db.platformKv[key] = [entry, ...list];
  await saveDB(db);
}
