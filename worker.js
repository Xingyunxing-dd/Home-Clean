/**
 * 宿舍清洁轮值打卡 - Cloudflare Worker API
 *
 * 接口：
 *   GET  /api/state   获取当前轮值状态 + 成员 + 任务
 *   POST /api/checkin 打卡（body: { taskId, memberId }），自动记录时间并切换下一位
 *   GET  /api/history 历史记录（?taskId=xxx 可筛选，默认最新在前）
 *
 * 数据存储：Cloudflare KV（binding 名：KV）
 */

const MEMBERS = [
  { id: "member_lucky", name: "幸运星" },
  { id: "member_wi", name: "Wi" },
];

const TASKS = [
  { id: "clean_room", name: "打扫卫生" },
  { id: "toilet_trash", name: "扔厕所垃圾" },
  { id: "living_trash", name: "扔客厅垃圾" },
];

const INITIAL_STATE = {
  clean_room: "member_lucky",
  toilet_trash: "member_wi",
  living_trash: "member_lucky",
};

const STATE_KEY = "rotation_state";
const HISTORY_KEY = "checkin_history";
const HISTORY_LIMIT = 200; // 最多保留 200 条历史记录

const memberMap = Object.fromEntries(MEMBERS.map((m) => [m.id, m]));
const taskMap = Object.fromEntries(TASKS.map((t) => [t.id, t]));

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function getState(env) {
  const raw = await env.KV.get(STATE_KEY, "json");
  return raw || { ...INITIAL_STATE };
}

async function getHistory(env) {
  const raw = await env.KV.get(HISTORY_KEY, "json");
  return Array.isArray(raw) ? raw : [];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      // 获取轮值状态
      if (path === "/api/state" && request.method === "GET") {
        const state = await getState(env);
        return json({ ok: true, state, members: MEMBERS, tasks: TASKS });
      }

      // 打卡
      if (path === "/api/checkin" && request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "请求体不是合法 JSON" }, 400);
        }
        const { taskId, memberId } = body || {};

        if (!taskId || !memberId) return json({ ok: false, error: "缺少 taskId 或 memberId" }, 400);
        if (!taskMap[taskId]) return json({ ok: false, error: "任务不存在" }, 400);
        if (!memberMap[memberId]) return json({ ok: false, error: "成员不存在" }, 400);

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
        await env.KV.put(STATE_KEY, JSON.stringify(state));

        // 追加历史记录
        const record = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          taskId,
          memberId,
          completedAt: new Date().toISOString(),
        };
        const history = await getHistory(env);
        history.push(record);
        while (history.length > HISTORY_LIMIT) history.shift();
        await env.KV.put(HISTORY_KEY, JSON.stringify(history));

        return json({
          ok: true,
          record,
          taskName: taskMap[taskId].name,
          nextMember: nextMember.name,
          reminderText: `【${taskMap[taskId].name}】已完成，下一次轮到${nextMember.name}干活`,
          state,
        });
      }

      // 历史记录（最新在前）
      if (path === "/api/history" && request.method === "GET") {
        const taskId = url.searchParams.get("taskId");
        const history = await getHistory(env);
        const filtered = taskId ? history.filter((r) => r.taskId === taskId) : history;
        return json({ ok: true, history: filtered.reverse() });
      }

      return json({ ok: false, error: "接口不存在" }, 404);
    } catch (err) {
      return json({ ok: false, error: `服务器内部错误：${err.message}` }, 500);
    }
  },
};
