// GET /api/history —— 历史记录（?taskId=xxx 可筛选，最新在前）
import { getHistory, json } from "../lib.js";

export async function onRequestGet(context) {
  const taskId = new URL(context.request.url).searchParams.get("taskId");
  const history = await getHistory(context.env);
  const filtered = taskId ? history.filter((r) => r.taskId === taskId) : history;
  return json({ ok: true, history: filtered.reverse() });
}
