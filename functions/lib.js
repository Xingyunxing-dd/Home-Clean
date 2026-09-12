// 共享逻辑：成员、任务、初始轮值、KV 读写、JSON 响应
// 供 functions/api/ 下的路由处理函数使用

export const MEMBERS = [
  { id: "member_lucky", name: "幸运星" },
  { id: "member_wi", name: "Wi" },
];

export const TASKS = [
  { id: "clean_room", name: "打扫卫生" },
  { id: "toilet_trash", name: "扔厕所垃圾" },
  { id: "living_trash", name: "扔客厅垃圾" },
];

export const INITIAL_STATE = {
  clean_room: "member_lucky",
  toilet_trash: "member_wi",
  living_trash: "member_lucky",
};

const STATE_KEY = "rotation_state";
const HISTORY_KEY = "checkin_history";
const HISTORY_LIMIT = 200; // 最多保留 200 条历史记录

export const memberMap = Object.fromEntries(MEMBERS.map((m) => [m.id, m]));
export const taskMap = Object.fromEntries(TASKS.map((t) => [t.id, t]));

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function getState(env) {
  const raw = await env.KV.get(STATE_KEY, "json");
  return raw || { ...INITIAL_STATE };
}

export async function getHistory(env) {
  const raw = await env.KV.get(HISTORY_KEY, "json");
  return Array.isArray(raw) ? raw : [];
}

export async function saveHistory(env, history) {
  await env.KV.put(HISTORY_KEY, JSON.stringify(history));
}

export const HISTORY_LIMIT_VALUE = HISTORY_LIMIT;
