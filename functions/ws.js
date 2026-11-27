export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (url.pathname !== '/ws') return new Response('Not found', { status: 404 });
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  const roomCode = (url.searchParams.get('room') || '').trim().toUpperCase();
  const role = url.searchParams.get('role') || '';
  const playerId = url.searchParams.get('pid') || '';
  if (!/^[A-Z0-9]{3,12}$/.test(roomCode) || !['host', 'player'].includes(role) || (role === 'player' && !playerId)) {
    return new Response('Invalid room connection parameters', { status: 400 });
  }

  // Pass the original WebSocket upgrade request to the existing Durable Object relay.
  const id = env.ROOMS.idFromName(roomCode);
  return env.ROOMS.get(id).fetch(request);
}
