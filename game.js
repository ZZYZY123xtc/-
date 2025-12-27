// game.js
// =========================
// 大学生模拟器 v0.4.3（适配 grade_rule v3.2）
// ✅ 新增：社交属性 social（影响运气/突发好事权重/心情下滑折扣）
// ✅ 自动选课：按培养方案 planByTerm，保证 4 年修满学分（160）
// ✅ 第3周退补选：弹窗 + 可反复加/退课 + 自动排冲突（强制课不可退）
// ✅ 一周只允许 3 次行动
// ✅ CET4/6 证书显示
// ✅ 【新规则适配】必修卡B，选修秒A，需“高分解锁”
//
// 文件依赖：
// - course.js -> window.COURSE.generatePlan
// - grade_rule.js -> window.GRADING (v3.2+)
// - event.js -> window.EVENTS + window.eventMatchesState
// =========================

/* ========== 常量 ========== */
const TERM_WEEKS = 16;
const TERMS_PER_YEAR = 2;
const ACTIONS_PER_WEEK = 3;                  // ✅ 一周只能做 3 件事
const FINALS_WEEKS = [14, 15, 16];

const FAMILY_ALLOWANCE_MONTHLY = { poor: 800, ok: 1500, mid: 3000, rich: 8000 };
const ASK_PARENTS_AMOUNT = { poor: 0, ok: 200, mid: 1000, rich: 10000 };

const WORK_REWARD = 400;
const WORK_ENERGY_COST = 15;
const WORK_STRESS_COST = 10;

const MONTHLY_ESSENTIALS_MIN = 200;
const MONTHLY_ESSENTIALS_MAX = 400;
const MONTHLY_PHONE_TOPUP = 50;

const EXAM_MATERIAL_FEE = 50;
// v0.4.2：周进入扣 7 天随机开销（钱会自己蒸发）
const DAILY_LIVING_COST_RANGE = {
  poor: [10, 20],
  ok: [20, 49],
  mid: [50, 100],
  rich: [50, 100],
};


const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const randi = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

/* ========== DOM helpers ========== */
const byId = (id) => document.getElementById(id);
function setText(el, text) { if (el) el.textContent = text; }
function clear(el) { if (el) el.innerHTML = ""; }

/* ========== UI 绑定（必须和 index.html 的 id 对齐） ========== */
const ui = {
  metaTerm: byId("metaTerm"),
  metaWeek: byId("metaWeek"),

  txtEnergy: byId("txtEnergy"),
  txtStress: byId("txtStress"),
  txtMood: byId("txtMood"),
  txtMoney: byId("txtMoney"),
  txtSocial: byId("txtSocial"),

  barEnergy: byId("barEnergy"),
  barStress: byId("barStress"),
  barMood: byId("barMood"),
  barMoney: byId("barMoney"),
  barSocial: byId("barSocial"),

  // Overview
  btnAcaMed: byId("btnAcaMed"),
  btnAcaStem: byId("btnAcaStem"),
  btnAcaBiz: byId("btnAcaBiz"),
  btnAcaArts: byId("btnAcaArts"),
  txtAcaHint: byId("txtAcaHint"),

  btnFamPoor: byId("btnFamPoor"),
  btnFamOk: byId("btnFamOk"),
  btnFamMid: byId("btnFamMid"),
  btnFamRich: byId("btnFamRich"),
  txtFamHint: byId("txtFamHint"),

  btnRouteResearch: byId("btnRouteResearch"),
  btnRouteCareer: byId("btnRouteCareer"),
  btnRouteAbroad: byId("btnRouteAbroad"),
  txtRouteHint: byId("txtRouteHint"),

  btnStart: byId("btnStart"),

  // Tabs + panes
  tabs: Array.from(document.querySelectorAll(".tab")),
  panes: Array.from(document.querySelectorAll(".pane")),

  // Courses tab
  btnAutoPlan: byId("btnAutoPlan"),
  btnOpenAddDrop: byId("btnOpenAddDrop"),
  courseList: byId("courseList"),
  certList: byId("certList"),
  gradeList: byId("gradeList"),

  // Week tab
  btnNextWeek: byId("btnNextWeek"),
  actionPanel: byId("actionPanel"),
  txtActionsLeft: byId("txtActionsLeft"),
  logBox: byId("logBox"),

  // Event modal
  modalEvent: byId("modalEvent"),
  evTitle: byId("evTitle"),
  evText: byId("evText"),
  evOptions: byId("evOptions"),
  evHint: byId("evHint"),

  // Add-drop modal
  modalAddDrop: byId("modalAddDrop"),
  btnResolveConflicts: byId("btnResolveConflicts"),
  btnCloseAddDrop: byId("btnCloseAddDrop"),
  btnCloseAddDropX: byId("btnCloseAddDropX"),
  adCurrent: byId("adCurrent"),
  adPool: byId("adPool"),
  adHint: byId("adHint"),
};

/* ========== 状态 ========== */
const state = {
  // 学籍
  started: false,
  year: 1,
  term: 1,
  week: 1,

  // 选择
  family: null,                 // poor/ok/mid/rich
  academy: null,                // 中文：医/理工/商科/文社
  academyNormalized: null,      // medicine/stem/biz/arts
  route: null,                  // ✅ 路线可不选：research/career/abroad/null

  // 数值
  energy: 80,
  stress: 20,
  mood: 70,
  money: 200,
  social: 50,                   // ✅ 新增社交属性

  // 隐藏属性（长线）
  hidden: {
    academicPower: 0,
    careerPower: 0,
    luck: 0,
    stability: 0,
  },
  flags: {},                    // 【新】存储全局状态，如 allRequiredReachedB

  // 学期状态
  termGradeBonus: 0,            // 本学期成绩修正（事件/选择）
  termStudy: 0,                 // 本学期学习次数
  termResearch: 0,              // 本学期科研次数

  // 学习分配（v3.1 成绩规则需要）
  totalStudyThisTerm: 0,        // 本学期“学习动作”总次数
  finalsStudyWeeksThisTerm: 0,  // 期末周学习次数（0..3）
  studyActionsByCourseId: {},   // { courseId: hits }
  masteredCourseIds: [],        // 学到 A(≥90) 的课程（用于自动分配时跳过）

  disciplineFlag: false,        // 纪律处分（可扩展）
  conflictsResolved: true,      // 退补选后是否已解决冲突（默认 true）

  // 证书/轨迹
  certs: {
    cet4: null, // {score, pass, term, year}
    cet6: null,
  },
  milestones: {
    sci: 0,
    offers: 0,
  },

  // 课程
  curriculumPlan: null,         // from course.js
  allCoursesPool: [],
  coursesThisTerm: [],          // course objects
  recommendedCoursesThisTerm: [], // 本学期培养方案推荐（可选，不强制）
  completedCourseIds: new Set(),
  creditsEarned: 0,
  failedCourseIds: new Set(), // 挂科待重修

  // 月度（1月=4周）
  monthlyDinnerWeeks: [],
  monthlyDinnerAbsMonth: null,
  parentsAskedAbsMonth: null,


  // 每周
  actionsLeft: ACTIONS_PER_WEEK,

  // 事件
  recentEventIds: [],
  eventCooldownUntilAbsWeek: {},  // id -> absWeek
  eventPending: false,
  pendingEvent: null,

  // 弹窗状态
  addDropShownThisTerm: false,
  lastTermReport: null,
  showGradeReminder: false,
};

/* ========== 日志 ========== */
function logLine(text) {
  const line = document.createElement("div");
  line.className = "line";
  line.textContent = text;
  ui.logBox.appendChild(line);
  ui.logBox.scrollTop = ui.logBox.scrollHeight;
}

/* ========== 日志：数值变化（你要的“每个选项结束后显示变化”） ========== */
function snapshotMainStats() {
  return {
    energy: Number(state.energy || 0),
    stress: Number(state.stress || 0),
    mood: Number(state.mood || 0),
    money: Number(state.money || 0),
    social: Number(state.social || 0),
    termGradeBonus: Number(state.termGradeBonus || 0),
  };
}

function formatDeltaLine(before, after) {
  const parts = [];
  const push = (label, d) => {
    if (!d) return;
    const s = d > 0 ? `+${d}` : `${d}`;
    parts.push(`${label}${s}`);
  };

  push("精力", after.energy - before.energy);
  push("压力", after.stress - before.stress);
  push("心情", after.mood - before.mood);
  push("金钱", after.money - before.money);
  push("社交", after.social - before.social);
  push("成绩修正", after.termGradeBonus - before.termGradeBonus);

  if (!parts.length) return "";
  return `【数值变化】${parts.join(" · ")}`;
}

/* ========== Tab ========== */
function setTab(tabId) {
  ui.tabs.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabId));
  ui.panes.forEach(p => p.classList.toggle("active", p.id === tabId));
}

/* ========== 社交 -> 运气（你要的“社交高运气好”） ========== */
function calcLuckEffective() {
  // 以 50 为“中性社交”，高于 50 会加运气，低于 50 会略减
  const baseLuck = Number(state.hidden.luck || 0);
  const socialBonus = (Number(state.social || 50) - 50) / 20;  // 90 -> +2
  return baseLuck + socialBonus;
}

/* ========== 课程状态检查 & 成绩规则入口 ========== */
// 【新】检查是否所有必修课都已达到 B
function createDeterministicRand() {
  const seq = [0.5, 0.25, 0.25];
  let i = 0;
  return () => {
    const v = seq[i % seq.length];
    i += 1;
    return v;
  };
}

function getStableCourseScore(course, overrideHits, overrideUnlockHighGrades) {
  const calcPercentFn = window.GRADING?.calcCoursePercent;
  if (typeof calcPercentFn !== "function") return null;
  const conflictsResolved = (typeof anyConflict === "function") ? !anyConflict(state.coursesThisTerm) : !!state.conflictsResolved;
  const rand = createDeterministicRand();
  const hits = (overrideHits != null) ? Number(overrideHits) : Number(state.studyActionsByCourseId?.[course.id] || 0);

  return calcPercentFn({
    course,
    studyActionsForThisCourse: hits,
    totalStudyThisTerm: state.totalStudyThisTerm,
    finalsStudyWeeks: state.finalsStudyWeeksThisTerm,
    termBonus: state.termGradeBonus,
    energy: state.energy,
    stress: state.stress,
    disciplineFlag: !!state.disciplineFlag,
    conflictsResolved,
    unlockHighGrades: (overrideUnlockHighGrades != null) ? !!overrideUnlockHighGrades : !!state.flags?.allRequiredReachedB,
    rand,
  });
}

function getStageTargetScore(course) {
  const unlockHighGrades = !!state.flags?.allRequiredReachedB;
  if (course.required) return unlockHighGrades ? 95 : 78;
  return unlockHighGrades ? 95 : 90;
}

function checkUnlockStatus() {
  if (!state.started || !window.GRADING || !window.GRADING.isGradeB) {
    state.flags.allRequiredReachedB = false; // ????? grading ????
    return;
  }

  const requiredCourses = (state.coursesThisTerm || []).filter(c => c.required);
  if (!requiredCourses.length) {
    state.flags.allRequiredReachedB = true; // ??????????
    return;
  }

  let allB = true;
  for (const c of requiredCourses) {
    const score = getStableCourseScore(c, null, false);
    if (score == null) {
      allB = false;
      break;
    }
    if (!window.GRADING.isGradeB(score)) {
      allB = false;
      break;
    }
  }
  state.flags.allRequiredReachedB = allB;
  // console.log("CheckUnlockStatus:", state.flags.allRequiredReachedB); // Debug log
}


/* ========== 学习：按课程分配 + 每次学习写“成绩预测日志” ========== */
function getAutoStudyTargetCourses(count = 4) {
  checkUnlockStatus();
  const list = Array.isArray(state.coursesThisTerm) ? state.coursesThisTerm : [];
  if (!list.length) return [];

  const getPriority = (course) => {
    const score = getStableCourseScore(course);
    const target = getStageTargetScore(course);
    if (score == null) return { tier: 0, gap: Infinity };
    if (course.required && score < 78) return { tier: 0, gap: 78 - score };
    if (!course.required && score < 90) return { tier: 1, gap: 90 - score };
    return { tier: 2, gap: Math.max(0, target - score) };
  };

  const sortByPriority = (a, b) => {
    const pa = getPriority(a);
    const pb = getPriority(b);
    if (pa.tier !== pb.tier) return pa.tier - pb.tier;
    if (pa.gap !== pb.gap) return pa.gap - pb.gap;
    const da = Number(a.difficulty ?? 3);
    const db = Number(b.difficulty ?? 3);
    if (da !== db) return da - db;
    return String(a.name).localeCompare(String(b.name));
  };

  const sorted = [...list].sort(sortByPriority);
  return sorted.slice(0, count);
}

function doStudyAction() {
  if (!state.started) return;

  const targets = getAutoStudyTargetCourses(4);
  if (!targets.length) {
    logLine("【学习】本学期没有课程可学习（可能还没选课）。");
    return;
  }

  const before = snapshotMainStats();

  // 基础消耗
  state.actionsLeft--;
  state.termStudy++;
  state.totalStudyThisTerm++;

  if (FINALS_WEEKS.includes(state.week)) {
    state.finalsStudyWeeksThisTerm = clamp(state.finalsStudyWeeksThisTerm + 1, 0, 3);
  }

  // applyEffects({ energy: -10, stress: +6, mood: -2, termGradeBonus: +1, hidden: { academicPower: +0.08 } });
  // 学习动作的直接影响：这里不直接加 gradeBonus，gradeBonus 应该由事件/游戏机制驱动
  // 学习动作主要是推进学习进度，消耗精力，增加压力
  applyEffects({ energy: -12, stress: +8, mood: -3, hidden: { academicPower: +0.1 } });
  logLine(`📚 本次学习推进（${targets.length}门）：${targets.map(c => c.name).join("、")}。`);
  logLine(`📚 你开始学习（一次同时推进 ${targets.length} 门课）。`);

  const explainFn = window.GRADING?.explain;
  const toLevel = window.GRADING?.percentToGradeLevel || window.GRADING?.percentToLetter;
  const toGp = window.GRADING?.percentToGradePoint || window.GRADING?.percentToGPA;
  const calcPercentFn = window.GRADING?.calcCoursePercent;

  // conflictsResolved：如果本学期课程仍有冲突，就算“未解决”
  const conflictsResolved = (typeof anyConflict === "function") ? !anyConflict(state.coursesThisTerm) : !!state.conflictsResolved;

  targets.forEach((course) => {
    try {
      const cid = course.id;
      state.studyActionsByCourseId[cid] = (state.studyActionsByCourseId[cid] || 0) + 1;
      const actions = state.studyActionsByCourseId[cid];

      // 用 calcCoursePercent 做“预测分数”（传入 state 来获取 unlockHighGrades）
      let predictedScore = null;
      let predictedLevel = "?";
      let predictedGp = null;

      if (typeof calcPercentFn === "function") {
        predictedScore = calcPercentFn({
          course,
          studyActionsForThisCourse: actions,
          totalStudyThisTerm: state.totalStudyThisTerm,
          finalsStudyWeeks: state.finalsStudyWeeksThisTerm,
          termBonus: state.termGradeBonus,
          energy: state.energy,
          stress: state.stress,
          disciplineFlag: !!state.disciplineFlag,
          conflictsResolved,
          // 【关键】将 unlockHighGrades 标志传入 grade_rule
          unlockHighGrades: !!state.flags?.allRequiredReachedB,
          rand: Math.random,
        });
        
        predictedLevel = (typeof toLevel === "function") ? toLevel(predictedScore) : "?";
        predictedGp = (typeof toGp === "function") ? toGp(predictedScore) : null;
      } else {
        logLine(`⚠️ 警告：grade_rule.js 的 calcCoursePercent 函数未加载。`);
      }

      const isMasteredA = (predictedScore !== null) && (predictedScore >= 90);
      if (isMasteredA) {
        const wasMastered = (state.masteredCourseIds || []).includes(cid);
        if (!wasMastered) state.masteredCourseIds.push(cid);

        logLine(`学习：你啃「${course.name}」→ 预测 ${predictedScore}（${predictedLevel}${predictedGp !== null ? `, GPA ${predictedGp}` : ""}）✅ 达到A(≥90) ${wasMastered ? "巩固" : "掌握"}`);
      } else {
        logLine(`学习：投入「${course.name}」｜第${actions}次喂课 → 预测 ${predictedScore ?? "?"}（${predictedLevel}${predictedGp !== null ? `, GPA ${predictedGp}` : ""}）`);
      }
    } catch (e) {
      console.error(`Error predicting score for course ${course?.name}:`, e);
      logLine(`⚠️ 学习预测计算出错：${course?.name ?? "未知课程"}（${e?.message ?? e}）`);
    }
  });

  checkUnlockStatus();

  const d = formatDeltaLine(before, snapshotMainStats());
  if (d) logLine(d);
}


/* ========== 心情扣减折扣（你要的 0.8） ========== */
function applyMoodDelta(rawDelta) {
  let delta = Number(rawDelta) || 0;
  if (delta < 0 && state.social > 90) {
    // 例：-5 -> -4（打 8 折），并且不让 -1 折成 0
    delta = Math.min(-1, Math.round(delta * 0.8));
  }
  state.mood = clamp(state.mood + delta, 0, 100);
  return delta;
}

/* ========== 统一应用 effects ========== */
function applyEffects(effects) {
  if (!effects) return;

  if (effects.energy != null) state.energy = clamp(state.energy + Number(effects.energy), 0, 100);
  if (effects.stress != null) state.stress = clamp(state.stress + Number(effects.stress), 0, 100);
  if (effects.mood != null) applyMoodDelta(effects.mood);

  if (effects.money != null) state.money = Math.max(0, state.money + Number(effects.money));
  if (effects.social != null) state.social = clamp(state.social + Number(effects.social), 0, 100);

  // 【新】v3.2 成绩规则的 unlockHighGrades 标志，通过 flags 传递
  if (effects.flags) {
    for (const k of Object.keys(effects.flags)) {
      const newVal = !!effects.flags[k];
      const oldVal = !!state.flags[k];
      state.flags[k] = newVal;

      // 里程碑计数：第一次触发才计数
      if (k === "gotOffer" && newVal && !oldVal) state.milestones.offers++;
      if (k === "gotSCI" && newVal && !oldVal) state.milestones.sci++;
    }
  }

  if (effects.termGradeBonus != null) state.termGradeBonus += Number(effects.termGradeBonus);

  if (effects.hidden) {
    for (const k of Object.keys(effects.hidden)) {
      state.hidden[k] = (Number(state.hidden[k]) || 0) + Number(effects.hidden[k]);
    }
  }

  if (effects.note) logLine(`【结果】${effects.note}`);
}

/* ========== 课程工具 ========== */
function isLockedCourseThisTerm(courseId) {
  const locked = state.curriculumPlan?.lockedByTerm?.[state.term] || [];
  return locked.includes(courseId);
}

function courseConflicts(a, b) {
  const A = new Set(a.timeslots || []);
  for (const t of (b.timeslots || [])) if (A.has(t)) return true;
  return false;
}

function anyConflict(courseList) {
  for (let i = 0; i < courseList.length; i++) {
    for (let j = i + 1; j < courseList.length; j++) {
      if (courseConflicts(courseList[i], courseList[j])) return true;
    }
  }
  return false;
}

/* ========== 渲染 ========== */
function renderMeta() {
  setText(ui.metaTerm, `第 ${state.year} 学年 · 第 ${state.term} 学期`);
  setText(ui.metaWeek, `第 ${state.week} 周`);
}

function renderBars() {
  setText(ui.txtEnergy, `${state.energy}/100`);
  setText(ui.txtStress, `${state.stress}/100`);
  setText(ui.txtMood, `${state.mood}/100`);
  setText(ui.txtMoney, `${state.money} 元`);
  setText(ui.txtSocial, `${state.social}/100`);

  ui.barEnergy.style.width = `${state.energy}%`;
  ui.barStress.style.width = `${state.stress}%`;
  ui.barMood.style.width = `${state.mood}%`;
  ui.barSocial.style.width = `${state.social}%`;
  ui.barMoney.style.width = `${Math.min(100, Math.floor(state.money / 3000 * 100))}%`;
}

function renderCourseList() {
  clear(ui.courseList);

  if (!state.curriculumPlan) {
    ui.courseList.innerHTML = `<div class="hint">未生成培养方案：请先在“概览”选择学院并开始。</div>`;
    return;
  }
  const selected = state.coursesThisTerm || [];
  const rec = state.recommendedCoursesThisTerm || [];

  const failedIds = state.failedCourseIds ? Array.from(state.failedCourseIds) : [];
  if (failedIds.length) {
    const failBox = document.createElement("div");
    failBox.className = "hint";
    const names = failedIds.map(id => {
      const c = (state.allCoursesPool || []).find(x => x.id === id); // 从总池子里找
      return c ? c.name : id;
    });
    failBox.textContent = `⚠️ 挂科待重修：${failedIds.length} 门（${names.join("、")}）。重修 = 下学期把这门课再选一次再学一次。`;
    ui.courseList.appendChild(failBox);
  }

  if (!selected.length && !rec.length) {
    ui.courseList.innerHTML = `<div class="hint">本学期还没生成选课建议。第1周点击“按培养方案自动选课”（会自动加入强制课 + 生成推荐）。</div>`;
    return;
  }

  // 已选课程
  const titleSel = document.createElement("div");
  titleSel.className = "hint";
  titleSel.textContent = "【已选课程】";
  ui.courseList.appendChild(titleSel);

  if (!selected.length) {
    const tip = document.createElement("div");
    tip.className = "hint";
    tip.textContent = "当前未选任何课（如果本学期强制课为 0，可从下方推荐里自选）。";
    ui.courseList.appendChild(tip);
  } else {
    for (const c of selected) {
      const row = document.createElement("div");
      row.className = "line";

      const locked = isLockedCourseThisTerm(c.id);
      const retake = state.failedCourseIds && state.failedCourseIds.has(c.id);
      const badgeLocked = locked ? `<span class="badge lock">强制</span>` : `<span class="badge">可退</span>`;
      const badgeRetake = retake ? ` <span class="badge lock">重修</span>` : "";
      const slot = (c.timeslots || []).join(", ");

      row.innerHTML = `${badgeLocked}${badgeRetake} <b>${c.name}</b> · ${c.credits} 学分 · 难度${c.difficulty} · 上课：${slot}`;
      ui.courseList.appendChild(row);
    }
  }

  const credits = selected.reduce((s, c) => s + (Number(c.credits) || 0), 0);
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = `本学期已选学分：${credits}（培养方案目标：${state.curriculumPlan.termTargetCredits[state.term]}）。第3周会弹出退补选，你也可以现在点“退补选”。`;
  ui.courseList.appendChild(hint);

  // 推荐（可选）
  if (rec.length) {
    const hr = document.createElement("hr");
    hr.className = "sep";
    ui.courseList.appendChild(hr);

    const titleRec = document.createElement("div");
    titleRec.className = "hint";
    titleRec.textContent = "【培养方案推荐（可选，不强制）】";
    ui.courseList.appendChild(titleRec);

    for (const c of rec) {
      const row = document.createElement("div");
      row.className = "rowBetween";

      const slot = (c.timeslots || []).join(", ");
      const left = document.createElement("div");
      const recBadge = c._retake ? `<span class="badge lock">重修</span>` : `<span class="badge">推荐</span>`;
      left.innerHTML = `${recBadge} <b>${c.name}</b> · ${c.credits} 学分 · 难度${c.difficulty} · 上课：${slot}`;

      const btn = document.createElement("button");
      btn.className = "btn primary";
      btn.textContent = "加课";

      const wouldConflict = selected.some(x => courseConflicts(x, c));
      if (wouldConflict) {
        btn.disabled = true;
        btn.textContent = "冲突";
      }

      btn.addEventListener("click", () => {
        if (selected.some(x => x.id === c.id)) return;
        if (selected.some(x => courseConflicts(x, c))) return;
        state.coursesThisTerm.push(c);
        state.recommendedCoursesThisTerm = state.recommendedCoursesThisTerm.filter(x => x.id !== c.id);
        render();
      });

      row.appendChild(left);
      row.appendChild(btn);
      ui.courseList.appendChild(row);
    }
  }
}

function renderCerts() {
  const lines = [];

  // 毕业进度 + 挂科待重修
  const gradNeed = (window.COURSE && window.COURSE.GRADUATE_CREDITS) || 160;
  const failIds = state.failedCourseIds ? Array.from(state.failedCourseIds) : [];
  const failNames = failIds
    .map(id => (state.allCoursesPool || []).find(c => c.id === id)) // 从总池子里找
    .filter(Boolean)
    .map(c => c.name);

  lines.push(`毕业进度：已修学分 ${state.creditsEarned}/${gradNeed}`);
  if (failIds.length) {
    lines.push(`挂科待重修：${failIds.length} 门（${failNames.join("、")}）`);
  } else {
    lines.push("挂科待重修：0 门");
  }

  // 【新】显示高分解锁状态
  const unlockStatus = state.flags?.allRequiredReachedB ? "已解锁 A+" : "未解锁 A+";
  lines.push(`学分状态：${unlockStatus}`);


  if (state.certs.cet4) {
    const x = state.certs.cet4;
    lines.push(`CET4：${x.score}（${x.pass ? "通过" : "未过"}，第${x.year}学年·第${x.term}学期）`);
  } else {
    lines.push("CET4：未参加/未记录");
  }

  if (state.certs.cet6) {
    const x = state.certs.cet6;
    lines.push(`CET6：${x.score}（${x.pass ? "通过" : "未过"}，第${x.year}学年·第${x.term}学期）`);
  } else {
    lines.push("CET6：未参加/未记录");
  }

  lines.push(`科研：SCI 计数 ${state.milestones.sci}；就业：Offer 计数 ${state.milestones.offers}`);

  ui.certList.textContent = lines.join(" / ");
}

function renderActions() {
  clear(ui.actionPanel);

  if (!state.started) {
    ui.actionPanel.innerHTML = `<div class="hint">请先在“概览”完成选择并点击“开始”。</div>`;
    setText(ui.txtActionsLeft, "");
    return;
  }

  // 若事件还没处理，不允许行动
  if (state.eventPending) {
    ui.actionPanel.innerHTML = `<div class="hint">本周有事件待处理：请先做出选择。</div>`;
    setText(ui.txtActionsLeft, "");
    return;
  }

  const broke = Number(state.money || 0) <= 0;
  if (broke) {
    ui.actionPanel.innerHTML = `<div class="hint">资金见底：本周只能选择【兼职】或【向家里要钱】。</div>`;
  }

  const actions = [
    {
      id: "study",
      name: "学习（推进4门+成绩预测）",
      do() {
        doStudyAction();
      }
    },
    {
      id: "research",
      name: "科研（+SCI概率）",
      do() {
        const before = snapshotMainStats();
        state.actionsLeft--;
        state.termResearch++;
        applyEffects({ energy: -14, stress: +6, mood: -2, hidden: { academicPower: +0.08 } });

        if (state.year < 2) {
          logLine("科研推进中：大一通常还出不了论文。");
          const d = formatDeltaLine(before, snapshotMainStats());
          if (d) logLine(d);
          return;
        }

        const luckEff = calcLuckEffective();
        // 调整科研权重，让社交影响更明显
        const p = clamp(
          0.005 + state.hidden.academicPower * 0.015 + luckEff * 0.006 + state.social * 0.0003 + state.termResearch * 0.002,
          0,
          0.08
        );

        if (Math.random() < p) {
          state.milestones.sci++;
          const authorRoll = Math.random();
          const author = authorRoll < 0.25 ? "一作" : (authorRoll < 0.7 ? "二作" : "三作");
          logLine(`科研产出：SCI 论文录用（作者位次：${author}，通讯作者：否）。`);

          if (author === "一作") {
            const noFail = !state.failedCourseIds || state.failedCourseIds.size === 0;
            // 【重要】保研资格判断，必须所有必修课都>=B 且无挂科/违纪
            const allRequiredB = state.flags?.allRequiredReachedB ?? false;
            const isGoodStanding = noFail && !state.disciplineFlag;

            if (allRequiredB && isGoodStanding && !state.flags.gotRecommendation) {
              state.flags.gotRecommendation = true;
              logLine("一作 SCI 且所有必修课≥B、无挂科/违纪：获得保研资格。");
            } else if (!allRequiredB) {
              logLine("一作 SCI，但仍有必修课未达 B：暂不具备保研资格。");
            } else if (!isGoodStanding) {
              logLine("一作 SCI，但存在挂科或违纪：暂不具备保研资格。");
            }
          }
        } else {
          logLine("你做了些科研推进：慢，但在动。");
        }

        const d = formatDeltaLine(before, snapshotMainStats());
        if (d) logLine(d);
      }
    },
    {
      id: "work",
      name: "兼职（+钱）",
      do() {
        const before = snapshotMainStats();
        state.actionsLeft--;
        applyEffects({ energy: -WORK_ENERGY_COST, stress: +WORK_STRESS_COST, mood: -1, money: +WORK_REWARD, social: +1, hidden: { careerPower: +0.05 } });
        logLine(`你去兼职了一次，赚了 ${WORK_REWARD}。`);

        const d = formatDeltaLine(before, snapshotMainStats());
        if (d) logLine(d);
      }
    },
    {
      id: "party",
      name: "社交/聚会（+社交）",
      do() {
        const before = snapshotMainStats();
        state.actionsLeft--;
        applyEffects({ energy: -8, stress: -2, mood: +4, money: -60, social: +5, hidden: { careerPower: +0.1 } });
        logLine("你去社交了一波，认识了几个人。社交=概率论的样本量。");

        const d = formatDeltaLine(before, snapshotMainStats());
        if (d) logLine(d);
      }
    },
    {
      id: "rest",
      name: "休息（回血）",
      do() {
        const before = snapshotMainStats();
        state.actionsLeft--;
        applyEffects({ energy: +18, stress: -12, mood: +3, note: "睡了一觉，世界看起来没那么糟（回血更明显）。" });
        logLine("你休息了一会儿。");

        const d = formatDeltaLine(before, snapshotMainStats());
        if (d) logLine(d);
      }
    },
    {
      id: "askParents",
      name: "向家里要点钱",
      do() {
        const before = snapshotMainStats();
        const curMonth = absMonthIndex();
        if (state.parentsAskedAbsMonth === curMonth) {
          logLine("这个月你已经问过爸妈一次了（一个月只能要一次）。");
          return;
        }
        state.actionsLeft--;
        state.parentsAskedAbsMonth = curMonth;
        const amount = ASK_PARENTS_AMOUNT[state.family] || 0;
        if (amount <= 0) {
          applyEffects({ mood: -2, social: -1, note: "你想了想，还是算了。" });
        } else {
          applyEffects({ money: +amount, mood: +1, social: -1, note: `家里转来 ${amount} 元（也有点小愧疚）。` });
        }
        logLine("你联系了家里。");

        const d = formatDeltaLine(before, snapshotMainStats());
        if (d) logLine(d);
      }
    }
  ];

  for (const a of actions) {
    if (broke && a.id !== "work" && a.id !== "askParents") continue;
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = a.name;
    const askedThisMonth = (a.id === "askParents" && state.parentsAskedAbsMonth === absMonthIndex());
    btn.disabled = state.actionsLeft <= 0 || askedThisMonth;
    if (askedThisMonth) btn.title = "本月已问过一次";
    btn.addEventListener("click", () => {
      if (state.actionsLeft <= 0) return;
      a.do();

      // 一周 3 次行动用完后自动进入下一周
      if (state.actionsLeft <= 0 && !state.eventPending) {
        logLine("本周 3 次行动已用完：自动进入下一周。");
        nextWeek();
        return;
      }

      render();
    });
    ui.actionPanel.appendChild(btn);
  }

  setText(ui.txtActionsLeft, `本周剩余行动：${state.actionsLeft}/${ACTIONS_PER_WEEK}`);
}


function render() {
  renderMeta();
  renderBars();
  renderCourseList();
  renderCerts();
  renderActions();
}

/* ========== 事件系统（弹窗） ========== */
function absWeekIndex() {
  // 绝对周：用于 cooldown
  return (state.year - 1) * TERMS_PER_YEAR * TERM_WEEKS + (state.term - 1) * TERM_WEEKS + state.week;
}

function pickWeeklyEvent() {
  if (!window.EVENTS || !window.eventMatchesState) return null;

  const absWeek = absWeekIndex();

  // 过滤 gate + cooldown
  const candidates = [];
  for (const ev of window.EVENTS) {
    if (!window.eventMatchesState(ev, state)) continue;

    const until = state.eventCooldownUntilAbsWeek[ev.id] || 0;
    if (absWeek <= until) continue;

    candidates.push(ev);
  }
  if (!candidates.length) return null;

  // 权重：社交高时，breakthrough 权重提高
  const social = Number(state.social || 50);
  const luckEff = calcLuckEffective();

  const weighted = candidates.map(ev => {
    let w = Number(ev.weight || 1);

    const tags = ev.tags || [];
    if (tags.includes("breakthrough")) {
      // 社交越高，越容易触发好事（你要的）
      if (social >= 60) w *= 1 + (social - 60) * 0.02; // 90 -> *1.6
    }

    // 运气也轻微影响（但别让它变成玄学作弊器）
    w *= 1 + clamp(luckEff, -2, 3) * 0.05;

    // 避免刚触发过的事件立刻再来
    if (state.recentEventIds.includes(ev.id)) w *= 0.25;

    return { ev, w: Math.max(0.01, w) };
  });

  const sum = weighted.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * sum;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) return x.ev;
  }
  return weighted[weighted.length - 1].ev;
}

function openEventModal(ev) {
  state.eventPending = true;
  state.pendingEvent = ev;

  setText(ui.evTitle, ev.title || "事件");
  setText(ui.evText, ev.text || "");
  clear(ui.evOptions);
  setText(ui.evHint, "请选择一个选项。");

  (ev.options || []).forEach((optRaw) => {
    // 支持动态选项：{ build: () => ({ text, effects }) }
    const opt = (optRaw && typeof optRaw.build === "function") ? optRaw.build() : optRaw;
    if (!opt) return;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = opt.text;
    btn.addEventListener("click", () => {
      const before = snapshotMainStats();

      // 先记日志，再改数值（读起来更顺）
      logLine(`【事件】你选择了：${opt.text}`);

      // 应用 effects
      applyEffects(opt.effects);

      // cooldown
      const cd = Number(ev.cooldownWeeks || 0);
      if (cd > 0) state.eventCooldownUntilAbsWeek[ev.id] = absWeekIndex() + cd;

      // recent
      state.recentEventIds.push(ev.id);
      if (state.recentEventIds.length > 10) state.recentEventIds.shift();

      // close
      state.eventPending = false;
      state.pendingEvent = null;
      ui.modalEvent.classList.add("hidden");

      const d = formatDeltaLine(before, snapshotMainStats());
      if (d) logLine(d);
      render();
    });
    ui.evOptions.appendChild(btn);
  });

  ui.modalEvent.classList.remove("hidden");
}

function openGradeReminderModal() {
  if (!state.lastTermReport) return;

  state.eventPending = true;
  state.pendingEvent = { id: "GRADE_REMINDER" };

  setText(ui.evTitle, "期末成绩提醒");
  ui.evText.innerHTML = `${state.lastTermReport.header}<br>${state.lastTermReport.summary}<br>成绩表已更新，可在“课程/成绩”里查看。`;
  clear(ui.evOptions);
  setText(ui.evHint, "点击确认继续本周行动。");

  const btn = document.createElement("button");
  btn.className = "btn primary";
  btn.textContent = "知道了";
  btn.addEventListener("click", () => {
    state.eventPending = false;
    state.pendingEvent = null;
    ui.modalEvent.classList.add("hidden");
    render();
  });
  ui.evOptions.appendChild(btn);

  ui.modalEvent.classList.remove("hidden");
}

function ensureWeeklyEvent() {
  if (!state.started) return;
  if (state.eventPending) return;

  const ev = pickWeeklyEvent();
  if (!ev) return;

  openEventModal(ev);
}

/* ========== 选课：自动培养方案 ========== */
function autoPlanThisTerm() {
  if (!state.curriculumPlan) return;
  const ids = state.curriculumPlan.planByTerm[state.term] || [];
  const pool = state.allCoursesPool;

  // ✅ 你的规则：第1周只“自动加入强制课”，其余课程给推荐但不强制。
  const lockedSelected = [];
  const recommended = [];

  // 优先处理重修课
  const failingCourseIds = state.failedCourseIds ? Array.from(state.failedCourseIds) : [];
  const retakeCourses = failingCourseIds
    .map(id => pool.find(x => x.id === id))
    .filter(Boolean)
    .map(c => ({ ...c, _retake: true })); // 标记为重修

  for (const id of ids) {
    // 已通过的课就不重复选
    if (state.completedCourseIds.has(id)) continue;

    const course = pool.find(x => x.id === id);
    if (!course) continue;

    if (isLockedCourseThisTerm(id)) {
      // 强制课，但如果是重修课，理论上不应该被锁？这里优先加入非重修的强制课
      // 如果是重修的强制课，则标记重修
      if (failingCourseIds.includes(id)) {
         lockedSelected.push({ ...course, _retake: true });
      } else {
         lockedSelected.push(course);
      }
    } else {
      // 非强制课，但也要排除掉重修课（重修课会单独添加到 recommended）
      if (!failingCourseIds.includes(id)) {
          recommended.push(course);
      }
    }
  }

  // 将重修课合并到推荐列表（或优先选择）
  const finalRecommended = [...retakeCourses, ...recommended];
  // 去重（理论上不会，但保险起见）
  const seen = new Set();
  state.recommendedCoursesThisTerm = finalRecommended.filter(c => {
      const duplicate = seen.has(c.id);
      seen.add(c.id);
      return !duplicate;
  });

  // 保留玩家已选课，只补齐强制课
  const have = new Set(state.coursesThisTerm.map(c => c.id));
  for (const c of lockedSelected) {
    if (!have.has(c.id)) state.coursesThisTerm.push(c);
  }

  // 过滤掉已选的推荐课
  const pickedIds = new Set(state.coursesThisTerm.map(c => c.id));
  state.recommendedCoursesThisTerm = state.recommendedCoursesThisTerm.filter(c => !pickedIds.has(c.id));


  if (anyConflict(state.coursesThisTerm)) {
    logLine("⚠️ 已选课程检测到时间冲突：打开退补选处理冲突。");
  } else {
    logLine(`✅ 已自动加入本学期强制课（${lockedSelected.length}门），并生成培养方案推荐列表（${state.recommendedCoursesThisTerm.length}门，可选）。`);
  }

  render();
}

/* ========== 退补选弹窗 ========== */
function openAddDropModal() {
  if (!state.curriculumPlan) return;

  state.addDropShownThisTerm = true;

  const pool = state.allCoursesPool;
  const failingIds = state.failedCourseIds ? Array.from(state.failedCourseIds) : [];

  function renderModal() {
    clear(ui.adCurrent);
    clear(ui.adPool);

    const picked = state.coursesThisTerm.slice();
    const pickedIds = new Set(picked.map(c => c.id));

    // 当前已选
    for (const c of picked) {
      const row = document.createElement("div");
      row.className = "line";

      const locked = isLockedCourseThisTerm(c.id);
      const retake = failingIds.includes(c.id); // 检查是否是重修课
      const slot = (c.timeslots || []).join(", ");
      const suggested = (c.suggestedTerm != null) ? `推荐第${c.suggestedTerm}学期` : "推荐学期未知";

      row.innerHTML = `
        <div class="courseInfo">
          <div class="courseTitle"><b>${c.name}</b>
            ${retake ? `<span class="badge lock">重修</span>` : ""}
            ${locked ? `<span class="badge lock">强制</span>` : ""}
          </div>
          <div class="courseMeta">${c.credits}学分 · 上课：${slot} · <span class="termTag">${suggested}</span></div>
        </div>`;

      const btn = document.createElement("button");
      btn.className = "btn adBtn";
      btn.textContent = locked ? "不可退" : "退课";
      btn.disabled = locked;
      btn.addEventListener("click", () => {
        if (locked) return;
        state.coursesThisTerm = state.coursesThisTerm.filter(x => x.id !== c.id);
        renderModal();
        render();
      });

      row.appendChild(document.createElement("span")).className = "sep";
      row.appendChild(btn);
      ui.adCurrent.appendChild(row);
    }

    // 可选课程池（本学期）：按“未通过且未已选”展示
    const candidates = pool
      .filter(c => !state.completedCourseIds.has(c.id))
      .filter(c => !pickedIds.has(c.id))
      .sort((a, b) => (a.suggestedTerm - b.suggestedTerm) || (a.difficulty - b.difficulty));

    for (const c of candidates) {
      const row = document.createElement("div");
      row.className = "line";

      const retake = failingIds.includes(c.id);
      const slot = (c.timeslots || []).join(", ");
      const suggested = (c.suggestedTerm != null) ? `推荐第${c.suggestedTerm}学期` : "推荐学期未知";

      row.innerHTML = `
        <div class="courseInfo">
          <div class="courseTitle"><b>${c.name}</b>
            ${retake ? `<span class="badge lock">重修</span>` : ""}
          </div>
          <div class="courseMeta">${c.credits}学分 · 难度${c.difficulty} · 上课：${slot} · <span class="termTag">${suggested}</span></div>
        </div>`;

      const addBtn = document.createElement("button");
      addBtn.className = "btn primary adBtn";
      addBtn.textContent = "加课";

      // 检测冲突：与当前已选任意课冲突则禁用
      const wouldConflict = state.coursesThisTerm.some(x => courseConflicts(x, c));
      if (wouldConflict) {
        addBtn.disabled = true;
        addBtn.textContent = "冲突";
      }

      addBtn.addEventListener("click", () => {
        if (wouldConflict) return;
        state.coursesThisTerm.push(c);
        renderModal();
        render();
      });

      row.appendChild(document.createElement("span")).className = "sep";
      row.appendChild(addBtn);
      ui.adPool.appendChild(row);
    }

    const credits = state.coursesThisTerm.reduce((s, c) => s + (Number(c.credits) || 0), 0);
    const conflict = anyConflict(state.coursesThisTerm);

    const tip = [
      `本学期已选 ${state.coursesThisTerm.length} 门课，总学分 ${credits}（目标 ${state.curriculumPlan.termTargetCredits[state.term]}）。`,
      conflict ? "⚠️ 当前存在时间冲突：点击右上角【自动排冲突】。" : "✅ 当前无时间冲突。"
    ].join("\n");

    setText(ui.adHint, tip);
  }

  // 自动排冲突：从“非强制课”里删到不冲突
  ui.btnResolveConflicts.onclick = () => {
    let safety = 0;
    while (anyConflict(state.coursesThisTerm) && safety < 50) {
      safety++;

      let removed = false;
      for (let i = 0; i < state.coursesThisTerm.length; i++) {
        for (let j = i + 1; j < state.coursesThisTerm.length; j++) {
          const a = state.coursesThisTerm[i];
          const b = state.coursesThisTerm[j];
          if (!courseConflicts(a, b)) continue;

          const aLocked = isLockedCourseThisTerm(a.id);
          const bLocked = isLockedCourseThisTerm(b.id);

          // 都锁：没法自动解决
          if (aLocked && bLocked) {
            logLine("⚠️ 冲突发生在两门强制课之间（理论上不会）：需要检查 course.js 的排课。");
            removed = true;
            break;
          }

          // 选择要删的那个：优先删非强制；两者都非强制时删难度更高的
          let drop = null;
          if (aLocked) drop = b;
          else if (bLocked) drop = a;
          else drop = (a.difficulty >= b.difficulty) ? a : b;

          state.coursesThisTerm = state.coursesThisTerm.filter(x => x.id !== drop.id);
          logLine(`【退补选】为解决冲突，自动退掉：${drop.name}`);
          removed = true;
          break;
        }
        if (removed) break;
      }
      if (!removed) break;
    }

    renderModal();
    render();
  };

  renderModal();
  ui.modalAddDrop.classList.remove("hidden");
}

/* ========== 期末结算 ========== */
function finalizeTermGrades() {
  if (!window.GRADING || !window.GRADING.calcCoursePercent || !window.GRADING.percentToLetter || !window.GRADING.percentToGPA) {
    logLine("❌ grade_rule.js 未加载或不完整：无法进行期末结算。");
    return;
  }
  if (!state.coursesThisTerm.length) {
    logLine("本学期无课程，跳过结算。");
    return;
  }

  // 【关键】每次结算前，重新检查 unlockHighGrades 状态
  checkUnlockStatus();

  const rows = [];
  let sumCredits = 0;
  let sumGpaCredits = 0;

  for (const c of state.coursesThisTerm) {
    // 【适配】将 state 完整传入 calcCoursePercent
    const percent = window.GRADING.calcCoursePercent(state, c);
    const letter = window.GRADING.percentToLetter(percent);
    const gpa = window.GRADING.percentToGPA(percent);

    const pass = percent >= 60;
    if (pass) {
      state.completedCourseIds.add(c.id);
      state.creditsEarned += Number(c.credits || 0);
      if (state.failedCourseIds) state.failedCourseIds.delete(c.id);
    } else {
      if (state.failedCourseIds) state.failedCourseIds.add(c.id);
    }

    sumCredits += Number(c.credits || 0);
    sumGpaCredits += gpa * Number(c.credits || 0);

    rows.push({ c, percent, letter, gpa, pass });
  }

  const termGPA = sumCredits > 0 ? (sumGpaCredits / sumCredits) : 0;

  const header = `第${state.year}学年·第${state.term}学期期末`;
  const summary = `学期GPA：${termGPA.toFixed(2)}；累计已修学分：${state.creditsEarned}/${state.curriculumPlan.graduateCredits}`;
  const rowsHtml = rows.map(r => `
    <tr>
      <td>${r.c.name}</td>
      <td>${Math.round(r.percent)}</td>
      <td>${r.letter}</td>
      <td>${r.gpa.toFixed(1)}</td>
      <td>${r.c.credits}</td>
      <td>${r.pass ? "通过" : "挂科"}</td>
    </tr>`).join("");

  ui.gradeList.innerHTML = `
    <div class=\"gradeSummary\">${header}</div>
    <div class=\"gradeSummary\">${summary}</div>
    <table class=\"table\">
      <thead>
        <tr>
          <th>课程</th>
          <th>分数</th>
          <th>等级</th>
          <th>GPA</th>
          <th>学分</th>
          <th>结果</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  logLine(`📌 期末结算完成：学期 GPA ${termGPA.toFixed(2)}。`);
  state.lastTermReport = { header, summary };
  state.showGradeReminder = true;

  // 学期清零项
  state.termGradeBonus = 0;
  state.termStudy = 0;
  state.termResearch = 0;
  state.totalStudyThisTerm = 0;
  state.finalsStudyWeeksThisTerm = 0;
  state.studyActionsByCourseId = {};
  state.masteredCourseIds = []; // A 级掌握列表也清空
  state.disciplineFlag = false; // 纪律处分一般是事件触发，这里也清一下
  state.conflictsResolved = true;
  state.actionsLeft = ACTIONS_PER_WEEK;
  state.addDropShownThisTerm = false;
}

/* ========== CET4/6 ========== */
function maybeRunCET() {
  // 简化设定：
  // - CET4：大一下（第2学期）第8周
  // - CET6：大二上（第3学期）第8周（要求 CET4 pass）
  if (state.week !== 8) return;

  const luckEff = calcLuckEffective();
  const study = Number(state.termStudy || 0);

  // 【新】CET4/6 的判定也需要考虑 `unlockHighGrades` 状态，如果还没解锁，成绩会受影响
  // 暂时简单处理，主要看学习和运气
  const scoreMultiplier = state.flags?.allRequiredReachedB ? 1.05 : 0.95; //解锁状态下略微加成

  if (state.term === 2 && !state.certs.cet4) {
    let base = 400 + Math.round(state.hidden.academicPower * 50) + Math.round(luckEff * 6) + Math.round(study * 7);
    let score = clamp(Math.round(base * scoreMultiplier) + randi(-40, 40), 0, 710);
    if (score >= 600 && study < 10) score = Math.min(score, 590); // 学习少可能分数低
    const pass = score >= 425;
    state.certs.cet4 = { score, pass, term: state.term, year: state.year };
    logLine(`📄 CET4 成绩：${score}（${pass ? "通过" : "未过"}）`);
  }

  if (state.term === 3 && state.certs.cet4?.pass && !state.certs.cet6) {
    let base = 380 + Math.round(state.hidden.academicPower * 45) + Math.round(luckEff * 5) + Math.round(study * 6) - 10;
    let score = clamp(Math.round(base * scoreMultiplier) + randi(-45, 35), 0, 710);
    if (score >= 600 && study < 12) score = Math.min(score, 585); // 学习少可能分数低
    const pass = score >= 425;
    state.certs.cet6 = { score, pass, term: state.term, year: state.year };
    logLine(`📄 CET6 成绩：${score}（${pass ? "通过" : "未过"}）`);
  }
}


/* ========== 周结算 / 进周（v0.4.2：月=4周；进周先发钱再扣钱；每月1次聚餐） ========== */
function weekInMonth() {
  // 1..4
  return ((state.week - 1) % 4) + 1;
}

function monthInTerm() {
  // 1..4（每学期16周）
  return Math.floor((state.week - 1) / 4) + 1;
}

function absMonthIndex() {
  // 绝对月份（用于“本月只能向爸妈要一次钱”等限制）
  // 每年2学期，每学期4个月
  return (state.year - 1) * TERMS_PER_YEAR * 4 + (state.term - 1) * 4 + monthInTerm();
}

function drawMonthlyDinnerWeeks() {
  const picks = [1, 2, 3, 4];
  // Fisher-Yates
  for (let i = picks.length - 1; i > 0; i--) {
    const j = randi(0, i);
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  return picks.slice(0, 1).sort((a, b) => a - b);
}

function monthlyIncomeAndCostsIfNeeded() {
  // 每 4 周算一个“月”，每个月第 1 周：发钱 + 扣固定支出 + 抽 1 个聚餐周
  if (weekInMonth() !== 1) return;

  const income = FAMILY_ALLOWANCE_MONTHLY[state.family] || 0;
  state.money += income;

  const essentials = randi(MONTHLY_ESSENTIALS_MIN, MONTHLY_ESSENTIALS_MAX);
  const isExamMonth = (monthInTerm() === 4); // 期末月（第13-16周）
  const fixed = essentials + MONTHLY_PHONE_TOPUP + (isExamMonth ? EXAM_MATERIAL_FEE : 0);
  state.money = Math.max(0, state.money - fixed);

  // 本月聚餐周次（保证 1 次）
  state.monthlyDinnerWeeks = drawMonthlyDinnerWeeks();
  state.monthlyDinnerAbsMonth = absMonthIndex();

  logLine(
    `💰 月初补贴 +${income}；固定支出 -${fixed}（日用品${essentials}+充值${MONTHLY_PHONE_TOPUP}${isExamMonth ? `+资料${EXAM_MATERIAL_FEE}` : ""}）。当前余额 ${state.money}。`
  );
}

function weeklyLivingCostAtWeekStart() {
  // 进第 N 周时扣一次“本周生活开销” = 7天随机开销求和
  const range = DAILY_LIVING_COST_RANGE[state.family] || [20, 49];
  const lo = range[0], hi = range[1];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += randi(lo, hi);

  state.money = Math.max(0, state.money - sum);
  logLine(`🧾 本周生活开销 -${sum}（7天合计，家境=${state.family}，日均区间${lo}-${hi}）`);
}

function maybeTriggerMonthlyDinner() {
  const absM = absMonthIndex();
  if (state.monthlyDinnerAbsMonth !== absM) {
    // 理论上月初会生成；这里兜底
    state.monthlyDinnerWeeks = drawMonthlyDinnerWeeks();
    state.monthlyDinnerAbsMonth = absM;
  }

  const w = weekInMonth();
  if (!state.monthlyDinnerWeeks.includes(w)) return false;

  // 聚餐事件（保证本月 1 次；当周视为“本周事件”，不再额外抽随机事件）
  const fam = state.family;
  const dinnerRange = fam === 'poor' ? [30, 80] : fam === 'ok' ? [80, 180] : [150, 400];
  const costAA = randi(dinnerRange[0], dinnerRange[1]);
  const costTreat = randi(Math.floor(dinnerRange[1] * 1.2), Math.floor(dinnerRange[1] * 1.8));

  openEventModal({
    id: `MONTHLY_DINNER_${absM}_${w}`,
    title: '聚餐/局（保底事件）',
    text: `这个月第${monthInTerm()}个月，本月第${w}周：同学/社团突然约饭。你感觉钱包在蒸发，但社交也在充电。`,
    cooldownWeeks: 0,
    tags: ['dinner'],
    options: [
      { text: `去（AA，-${costAA}）`, effects: { money: -costAA, mood: +3, stress: -3, social: +3, hidden: { stability: +0.3 }, note: '吃了，聊了，钱包轻了。' } },
      { text: `我请客（-${costTreat}）`, effects: { money: -costTreat, mood: +4, stress: -4, social: +5, hidden: { luck: +0.5 }, note: '豪气+，人脉+，钱包-。' } },
      { text: '不去（回宿舍躺平）', effects: { mood: -1, energy: +8, stress: -6, social: -1, hidden: { stability: +0.2 }, note: '躲过一局，但也少了一点存在感。' } },
    ],
  });

  return true;
}

function enterWeek({ skipRandomEvent = false } = {}) {
  // 进周：先“月初结算（如适用）”再扣“本周生活开销”
  monthlyIncomeAndCostsIfNeeded();
  weeklyLivingCostAtWeekStart();

  // 新学期第1周：先弹出上学期期末成绩提醒
  if (!skipRandomEvent && state.week === 1 && state.showGradeReminder) {
    state.showGradeReminder = false;
    openGradeReminderModal();
    return;
  }

  // 第3周自动弹出退补选（如果本学期没打开过）
  if (state.week === 3 && !state.addDropShownThisTerm) {
    openAddDropModal();
  }

  // 每月一次聚餐（保底弹窗）。聚餐当周不再额外抽随机事件，避免弹窗过载。
  if (!skipRandomEvent && maybeTriggerMonthlyDinner()) return;

  if (!skipRandomEvent) ensureWeeklyEvent();
}

function endOfWeekDrift() {
  // 周末漂移：压力自然上浮，心情受到压力影响
  const stressDrift = FINALS_WEEKS.includes(state.week) ? 8 : 3;
  state.stress = clamp(state.stress + stressDrift, 0, 100);

  // 心情：压力 > 70 会掉
  if (state.stress > 70) {
    const drop = -randi(2, 5);
    applyMoodDelta(drop);
  }

  logLine(`📆 周末结算：压力漂移 +${stressDrift}${state.stress > 70 ? '（高压影响心情）' : ''}。`);
}

function nextWeek() {
  if (!state.started) return;

  // 没处理事件，不能过周
  if (state.eventPending) {
    logLine('⚠️ 本周事件还没处理：先做出选择。');
    return;
  }

  // 结束周
  endOfWeekDrift();
  maybeRunCET();

  // 进下周
  state.week += 1;
  state.actionsLeft = ACTIONS_PER_WEEK;

  if (state.week > TERM_WEEKS) {
    // 期末 -> 结算学期 -> 进入新学期
    finalizeTermGrades();

    state.week = 1;
    state.term += 1;

    if (state.term > TERMS_PER_YEAR) {
      state.term = 1;
      state.year += 1;
      logLine(`🎓 进入第 ${state.year} 学年。`);
    }

    logLine(`📚 进入第${state.term}学期：第1周自动锁定强制课（其余给推荐）；第3周退补选。`);
    state.coursesThisTerm = []; // 新学期需要重新选课
    state.recommendedCoursesThisTerm = [];
    state.addDropShownThisTerm = false;
    state.failedCourseIds = new Set(); // 新学期挂科清零（但已通过的不清）

    // 新学期第1周：自动选强制课（不强制其他）
    autoPlanThisTerm();
    // 【关键】新学期开始，重新检查解锁状态
    checkUnlockStatus();
  }

  // 进周扣钱/事件（本周）
  enterWeek();

  render();
}
/* ========== 开局：选择学院/家境/路线 ========== */
function setAcademy(academyZh) {
  state.academy = academyZh;
  state.academyNormalized =
    academyZh === "理工" ? "stem" :
      academyZh === "商科" ? "biz" :
        academyZh === "医" || academyZh === "医学" ? "medicine" :
          "arts";

  setText(ui.txtAcaHint, `已选择学院：${academyZh}（锁死）`);
}

function setFamily(famKey) {
  state.family = famKey;
  setText(ui.txtFamHint, `已选择家境：${famKey}（锁死）`);
}

function setRoute(routeKey) {
  state.route = routeKey;
  const zh = routeKey === "research" ? "科研" : routeKey === "career" ? "就业" : routeKey === "abroad" ? "出国" : "未选择";
  setText(ui.txtRouteHint, `已选择路线：${zh}`);
}

function startGame() {
  if (state.started) {
    logLine("游戏已经开始，无需重复初始化。");
    setTab("tabCourses");
    return;
  }
  if (!state.academy || !state.family) {
    logLine("⚠️ 还没选学院/家境。");
    return;
  }
  if (!window.COURSE || typeof window.COURSE.generatePlan !== "function") {
    logLine("❌ course.js 未加载：window.COURSE.generatePlan 不存在。");
    return;
  }

  // 【重要】检查 grade_rule 是否加载
  if (!window.GRADING || !window.GRADING.calcCoursePercent) {
     logLine("❌ grade_rule.js 未加载或不完整，无法开始游戏。");
     return;
  }

  state.curriculumPlan = window.COURSE.generatePlan(state.academy);
  state.allCoursesPool = state.curriculumPlan.coursePool.slice();

  state.started = true;
  if (ui.btnStart) {
    ui.btnStart.disabled = true;
    ui.btnStart.textContent = "已开始";
  }
  const routeZh = state.route === "research" ? "科研" : state.route === "career" ? "就业" : state.route === "abroad" ? "出国" : "未选择";
  logLine(`✅ 开局完成：学院=${state.academy}，家境=${state.family}，路线=${routeZh}。`);

  // 【关键】游戏开始时，执行一次状态检查
  checkUnlockStatus();

  // 进第1周：月初结算/周开销/强制课补齐/聚餐保底/随机事件
  autoPlanThisTerm();
  enterWeek();

  setTab("tabCourses");
  render();
}

/* ========== 绑定事件 ========== */
function bindUI() {
  // tabs
  ui.tabs.forEach(btn => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  // academy
  ui.btnAcaMed?.addEventListener("click", () => { if (!state.started) setAcademy("医"); render(); });
  ui.btnAcaStem?.addEventListener("click", () => { if (!state.started) setAcademy("理工"); render(); });
  ui.btnAcaBiz?.addEventListener("click", () => { if (!state.started) setAcademy("商科"); render(); });
  ui.btnAcaArts?.addEventListener("click", () => { if (!state.started) setAcademy("文社"); render(); });

  // family
  ui.btnFamPoor?.addEventListener("click", () => { if (!state.started) setFamily("poor"); render(); });
  ui.btnFamOk?.addEventListener("click", () => { if (!state.started) setFamily("ok"); render(); });
  ui.btnFamMid?.addEventListener("click", () => { if (!state.started) setFamily("mid"); render(); });
  ui.btnFamRich?.addEventListener("click", () => { if (!state.started) setFamily("rich"); render(); });

  // route
  ui.btnRouteResearch?.addEventListener("click", () => { setRoute("research"); render(); });
  ui.btnRouteCareer?.addEventListener("click", () => { setRoute("career"); render(); });
  ui.btnRouteAbroad?.addEventListener("click", () => { setRoute("abroad"); render(); });

  // start
  ui.btnStart?.addEventListener("click", startGame);

  // courses tab
  ui.btnAutoPlan?.addEventListener("click", () => {
    if (!state.started) return logLine("⚠️ 还没开始游戏。");
    if (state.week !== 1) return logLine("⚠️ 自动选课建议在第1周进行（你也可以现在点，但更合理是新学期第1周）。");
    autoPlanThisTerm();
  });

  ui.btnOpenAddDrop?.addEventListener("click", () => {
    if (!state.started) return logLine("⚠️ 还没开始游戏。");
    openAddDropModal();
  });

  // 退补选弹窗：保证能关（你反馈“关不上”）
  const closeAddDrop = (e) => {
    e?.preventDefault?.();
    ui.modalAddDrop.classList.add("hidden");
    render();
  };
  ui.btnCloseAddDrop?.addEventListener("click", closeAddDrop);
  ui.btnCloseAddDropX?.addEventListener("click", closeAddDrop);

  // 点遮罩层也能关闭（点击白框外，更直觉）
  ui.modalAddDrop?.addEventListener("click", (e) => {
    if (e.target === ui.modalAddDrop) {
      ui.modalAddDrop.classList.add("hidden");
      render();
    }
  });

  // ESC 关闭退补选
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!ui.modalAddDrop.classList.contains("hidden")) {
      ui.modalAddDrop.classList.add("hidden");
      render();
    }
  });

  // next week
  ui.btnNextWeek?.addEventListener("click", nextWeek);
}

/* ========== 初始化 ========== */
bindUI();
setTab("tabOverview");
logLine("欢迎来到大学生模拟器 v0.4.3。");
logLine("去“概览”页：先选学院、家境（路线可不选），然后点【开始】。");
logLine("本游戏要点：第1周自动加入强制课 + 生成推荐；第3周退补选；每周3次行动；社交影响运气与人生轨迹。");
logLine("【新规则】必修课需达到 B (78分) 才能解锁 A+；选修课只要学一次就至少 A。");
render();
