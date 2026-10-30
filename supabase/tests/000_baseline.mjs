export async function run({ admin, createTestUser, assert }) {
  const userA = await createTestUser('تست الف');
  const userB = await createTestUser('تست ب');
  const userC = await createTestUser('تست ج');

  // 1. Negative test: user cannot escalate trust/admin columns on profiles (column-level grants)
  const { error: privErr } = await userA.client
    .from('profiles')
    .update({ is_admin: true, verified_id: true, rating_avg: 5 })
    .eq('id', userA.id);
  assert.notEqual(privErr, null, 'User must not be allowed to update trust/admin columns');

  // 2. Negative test: user A cannot update user B's profile
  await userA.client.from('profiles').update({ name: 'هک شد' }).eq('id', userB.id);
  const { data: bProf } = await admin.from('profiles').select('name').eq('id', userB.id).single();
  assert.equal(bProf.name, 'تست ب', 'User A must not modify User B profile');

  // 3. Positive + Negative test: request -> accept_request -> connection + message RLS
  const { data: reqRow, error: reqErr } = await userA.client
    .from('requests')
    .insert({ from_user: userA.id, to_user: userB.id, message: 'سلام ب!' })
    .select()
    .single();
  assert.equal(reqErr, null, 'User A should send request to User B');

  // Negative: User C cannot accept User B's request
  const { error: cAcceptErr } = await userC.client.rpc('accept_request', { p_request: reqRow.id });
  assert.notEqual(cAcceptErr, null, 'Non-recipient must not accept request');

  // Positive: User B accepts request -> creates connection
  const { data: connId, error: bAcceptErr } = await userB.client.rpc('accept_request', { p_request: reqRow.id });
  assert.equal(bAcceptErr, null, `Recipient should accept request: ${bAcceptErr?.message}`);
  assert.ok(connId, 'accept_request should return connection id');

  // Negative: User C cannot read or send messages in A-B connection
  const { data: cMsgs } = await userC.client.from('messages').select('*').eq('connection_id', connId);
  assert.equal(cMsgs.length, 0, 'Non-participant must not read connection messages');
  const { error: cMsgInsertErr } = await userC.client
    .from('messages')
    .insert({ connection_id: connId, sender: userC.id, body: 'نفوذ' });
  assert.notEqual(cMsgInsertErr, null, 'Non-participant must not insert messages');

  // 4. Block enforcement in both directions (is_blocked_between + search_people)
  const { error: blockErr } = await userB.client
    .from('blocks')
    .insert({ user_id: userB.id, blocked_id: userC.id });
  assert.equal(blockErr, null, 'User B should block User C');

  // User C cannot send request to User B
  const { error: blockedReqErr } = await userC.client
    .from('requests')
    .insert({ from_user: userC.id, to_user: userB.id, message: 'چرا بلاکم کردی' });
  assert.notEqual(blockedReqErr, null, 'Blocked user C must not be able to request B');

  // search_people hides B from C
  const { data: searchRes } = await userC.client.rpc('search_people', { p_q: 'تست ب' });
  assert.equal(
    (searchRes ?? []).some((p) => p.id === userB.id),
    false,
    'Blocked user B must not appear in C search_people results'
  );
}
