export async function onRequestGet(context) {
  const { request, env, params } = context;
  const path = params.path ? params.path.join('/') : '';
  
  try {
    if (!path) return new Response('Bad Request', { status: 400 });

    const object = await env.RECEIPTS_BUCKET.get(path);
    
    if (object === null) {
      return new Response('Not Found', { status: 404 });
    }
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    return new Response(object.body, {
      headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
