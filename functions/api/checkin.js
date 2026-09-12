// POST /api/checkin —— 打卡：记录完成时间、切换下一位轮值、追加历史
import {
  getState,
  getHistory,
  saveHistory,
  MEMBERS,
  taskMap,
  memberMap,
  json,
  HISTORY_LIMIT_VALUE,
} from "../lib.js";

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "请求体不是合法 JSON" }, 400);
  }
  const { taskId, memberId } = body || {};

  if (!taskId || !memberId) return json({ ok: false, error: "缺少 taskId 或 memberId" }, 400);
  if (!taskMap[taskId]) return json({ ok: false, error: "任务不存在" }, 400);
  if (!memberMap[memberId]) return json({ ok: false, error: "成员不存在" }, 400);

  const env = context.env;
  const state = await getState(env);
  if (state[taskId] !== memberId) {
    const current = memberMap[state[taskId]];
    return json(
      {
        ok: false,
        error: `当前「${taskMap[taskId].name}」轮到${current ? current.name : "未知"}，不能由${memberMap[memberId].name}打卡`,
      },
      400
    );
  }

  // 轮值切换到另一人
  const nextMember = MEMBERS.find((m) => m.id !== memberId);
  state[taskId] = nextMember.id;
  await env.KV.put("rotation_state", JSON.stringify(state));

  // 追加历史记录
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId,
    memberId,
    completedAt: new Date().toISOString(),
  };
  const history = await getHistory(env);
  history.push(record);
  while (history.length > HISTORY_LIMIT_VALUE) history.shift();
  await saveHistory(env, history);

  return json({
    ok: true,
    record,
    taskName: taskMap[taskId].name,
    nextMember: nextMember.name,
    reminderText: `【${taskMap[taskId].name}】已完成，下一次轮到${nextMember.name}干活`,
    state,
  });
}
