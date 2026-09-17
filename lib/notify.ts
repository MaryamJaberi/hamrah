/** Asks the server to push a notification about a request/message the current user just created. */
export function notify(kind: 'request' | 'message', id: string) {
  return fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id }) }).catch(() => {});
}
