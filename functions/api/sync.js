export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  
  // This endpoint accepts an array of transactions to sync to D1
  const { userId, transactions } = body;
  
  if (!userId || !transactions || !Array.isArray(transactions)) {
    return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400 });
  }

  try {
    // Basic sync: delete existing for user and re-insert (for simplicity in offline-first sync)
    // A production app would use upserts or track deleted items.
    await env.DB.prepare("DELETE FROM transactions WHERE user_id = ?").bind(userId).run();
    
    if (transactions.length > 0) {
      // Build a bulk insert query
      const statements = transactions.map(tx => {
        return env.DB.prepare(
          "INSERT INTO transactions (id, user_id, type, amount, category, date, time, timestamp, notes, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(tx.id, userId, tx.type, tx.amount, tx.category, tx.date, tx.time, tx.timestamp, tx.notes, tx.paymentMode || 'UPI');
      });
      
      await env.DB.batch(statements);
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const body = await request.json();
  const { userId, budget } = body;
  
  if (!userId || budget === undefined) return new Response("Bad request", { status: 400 });
  
  try {
    await env.DB.prepare("UPDATE users SET budget = ? WHERE id = ?").bind(budget, userId).run();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch(err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
