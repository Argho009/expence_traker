export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const { action, username, email, password, fullName, collegeName, budget } = body;

  try {
    if (action === 'signup') {
      const existing = await env.DB.prepare("SELECT * FROM users WHERE username = ? OR email = ?").bind(username, email).first();
      if (existing) {
        return new Response(JSON.stringify({ success: false, error: "Username or email already exists." }), { status: 400 });
      }
      
      const result = await env.DB.prepare(
        "INSERT INTO users (username, email, password, full_name, college_name, budget) VALUES (?, ?, ?, ?, ?, ?) RETURNING *"
      ).bind(username, email, password, fullName, collegeName, budget || 5000).first();
      
      return new Response(JSON.stringify({ success: true, user: result, transactions: [] }), { status: 200 });
    } 
    
    if (action === 'login') {
      const user = await env.DB.prepare("SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?")
        .bind(username, username, password).first();
        
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "Invalid credentials." }), { status: 401 });
      }
      
      const { results: transactions } = await env.DB.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY timestamp DESC").bind(user.id).all();
      
      return new Response(JSON.stringify({ success: true, user, transactions }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
