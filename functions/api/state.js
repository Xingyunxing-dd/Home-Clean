// GET /api/state —— 获取当前轮值状态 + 成员 + 任务
import { getState, MEMBERS, TASKS, json } from "../lib.js";

export async function onRequestGet(context) {
  const state = await getState(context.env);
  return json({ ok: true, state, members: MEMBERS, tasks: TASKS });
}
