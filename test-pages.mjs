// 本地逻辑测试：用内存 KV 模拟 Cloudflare 环境，验证 Pages Functions 的 API
import { onRequestGet as stateGet } from "./functions/api/state.js";
import { onRequestPost as checkinPost } from "./functions/api/checkin.js";
import { onRequestGet as historyGet } from "./functions/api/history.js";

const store = new Map();
const env = {
  KV: {
    async get(key) {
      return store.has(key) ? JSON.parse(store.get(key)) : null;
    },
    async put(key, val) {
      store.set(key, String(val));
    },
  },
};

const post = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function callState() {
  const res = await stateGet({ env, request: new Request("https://test.local/api/state") });
  return { status: res.status, data: await res.json() };
}
async function callCheckin(body) {
  const res = await checkinPost({ env, request: new Request("https://test.local/api/checkin", post(body)) });
  return { status: res.status, data: await res.json() };
}
async function callHistory(taskId) {
  const url = taskId ? `https://test.local/api/history?taskId=${taskId}` : "https://test.local/api/history";
  const res = await historyGet({ env, request: new Request(url) });
  return { status: res.status, data: await res.json() };
}

let passed = 0;
let failed = 0;
function assert(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}  ${extra}`);
  }
}

async function run() {
  console.log("1) 初始状态");
  let r = await callState();
  assert("state 返回 ok", r.data.ok === true);
  assert("打扫卫生初始归幸运星", r.data.state.clean_room === "member_lucky");
  assert("扔厕所垃圾初始归 Wi", r.data.state.toilet_trash === "member_wi");
  assert("扔客厅垃圾初始归幸运星", r.data.state.living_trash === "member_lucky");

  console.log("2) 错误打卡被拒绝");
  r = await callCheckin({ taskId: "clean_room", memberId: "member_wi" });
  assert("Wi 替幸运星打卡被拒", r.data.ok === false, JSON.stringify(r.data));

  console.log("3) 正确打卡：幸运星打扫卫生");
  r = await callCheckin({ taskId: "clean_room", memberId: "member_lucky" });
  assert("打卡成功", r.data.ok === true, JSON.stringify(r.data));
  assert("提醒文案正确", r.data.reminderText === "【打扫卫生】已完成，下一次轮到Wi干活", r.data.reminderText);
  assert("轮值切到 Wi", r.data.state.clean_room === "member_wi");
  assert("记录包含时间", typeof r.data.record.completedAt === "string" && r.data.record.completedAt.length > 0);

  console.log("4) 打卡后重复打卡被拒绝");
  r = await callCheckin({ taskId: "clean_room", memberId: "member_lucky" });
  assert("幸运星重复打卡被拒", r.data.ok === false, JSON.stringify(r.data));

  console.log("5) 其他任务不受影响");
  r = await callState();
  assert("扔厕所垃圾仍是 Wi", r.data.state.toilet_trash === "member_wi");
  assert("扔客厅垃圾仍是幸运星", r.data.state.living_trash === "member_lucky");

  console.log("6) 历史记录");
  r = await callHistory();
  assert("历史有 1 条", r.data.history.length === 1, `len=${r.data.history.length}`);
  assert("记录为幸运星-打扫卫生", r.data.history[0].memberId === "member_lucky" && r.data.history[0].taskId === "clean_room");
  r = await callHistory("toilet_trash");
  assert("按任务筛选为空", r.data.history.length === 0);

  console.log("7) 参数校验");
  r = await callCheckin({ taskId: "nonexist", memberId: "member_lucky" });
  assert("不存在任务被拒", r.data.ok === false);
  r = await callCheckin({});
  assert("缺参数被拒", r.data.ok === false);

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

run();
