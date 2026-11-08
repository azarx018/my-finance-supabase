import { db, type LocalChatMessage } from '$lib/db/dexie';

// Deliberately small per the design discussion — "cukup beberapa baris
// pertanyaan aja". Persisting to Dexie means this survives BOTH normal
// navigation away-and-back AND the app being killed from the phone's
// task switcher — those two are indistinguishable once anything is
// written to IndexedDB rather than kept only in JS memory, so there's
// no extra cost to "surviving a kill" specifically. The actual lever
// for keeping this lightweight is how MANY messages are kept, which is
// exactly what this constant controls.
const MAX_MESSAGES = 20;

export async function loadHistory(userId: string): Promise<LocalChatMessage[]> {
  const all = await db.chatMessages.where('userId').equals(userId).sortBy('createdAt');
  return all;
}

export async function appendHistory(msg: LocalChatMessage): Promise<void> {
  await db.chatMessages.put(msg);
  const all = await db.chatMessages.where('userId').equals(msg.userId).sortBy('createdAt');
  if (all.length > MAX_MESSAGES) {
    const excess = all.slice(0, all.length - MAX_MESSAGES);
    await db.chatMessages.bulkDelete(excess.map((m) => m.id));
  }
}

export async function updateHistoryAction(id: string, actionJson: string): Promise<void> {
  await db.chatMessages.update(id, { actionJson });
}

export async function deleteHistoryMessage(id: string): Promise<void> {
  await db.chatMessages.delete(id);
}
