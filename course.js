// course.js
// =========================
// 大学生模拟器 v0.4.2 课程系统（培养方案版）
// - window.COURSE.generatePlan(academyZh)
// - 输出接口对齐 game.js：
//   { graduateCredits, termTargetCredits, lockedByTerm, planByTerm, coursePool }
// - 强制课锁死：体育1-4、大学英语1-2、学术英语读写（大二）、思政顺序（前六学期）
// - 课程带 timeslots（上课时间），冲突检测靠 timeslots
// =========================
(() => {
  const TIME_SLOTS = [
    "Mon-1", "Mon-2", "Mon-3",
    "Tue-1", "Tue-2", "Tue-3",
    "Wed-1", "Wed-2", "Wed-3",
    "Thu-1", "Thu-2", "Thu-3",
    "Fri-1", "Fri-2", "Fri-3",
  ];

  function normalizeAcademy(academyZh) {
    if (academyZh === "理工") return "stem";
    if (academyZh === "商科") return "biz";
    if (academyZh === "医" || academyZh === "医学") return "medicine";
    return "arts"; // 文社
  }

  function courseId(name) {
    return name.replace(/\s+/g, "_").replace(/[^\w\u4e00-\u9fa5]/g, "");
  }

  function mkCourse({
    name,
    credits = 2,
    difficulty = 3,
    examLoad = 2,
    required = false,
    locked = false,
    area = "",
    type = "",
    suggestedTerm = 1,
    slot = null,
  }) {
    const id = courseId(name);
    const timeslots = slot ? [slot] : [];
    return { id, name, credits, difficulty, examLoad, required, locked, area, type, suggestedTerm, term: suggestedTerm, timeslots };
  }

  function courseConflicts(a, b) {
    const A = new Set(a.timeslots || []);
    for (const t of (b.timeslots || [])) if (A.has(t)) return true;
    return false;
  }

  function conflictsWithAny(course, list) {
    return list.some(c => courseConflicts(course, c));
  }

  function sumCredits(list) {
    return list.reduce((s, c) => s + Number(c.credits || 0), 0);
  }

  // ===== 强制通用课（所有学院通用） =====
  const GENERAL_REQUIRED_SEQUENCE = [
    mkCourse({ name: "体育1", credits: 1, difficulty: 1, examLoad: 1, required: true, locked: true, area: "体育", suggestedTerm: 1, slot: "Mon-1" }),
    mkCourse({ name: "体育2", credits: 1, difficulty: 1, examLoad: 1, required: true, locked: true, area: "体育", suggestedTerm: 2, slot: "Mon-1" }),
    mkCourse({ name: "体育3", credits: 1, difficulty: 1, examLoad: 1, required: true, locked: true, area: "体育", suggestedTerm: 3, slot: "Mon-1" }),
    mkCourse({ name: "体育4", credits: 1, difficulty: 1, examLoad: 1, required: true, locked: true, area: "体育", suggestedTerm: 4, slot: "Mon-1" }),

    mkCourse({ name: "大学英语1", credits: 3, difficulty: 3, examLoad: 2, required: true, locked: true, area: "英语", suggestedTerm: 1, slot: "Tue-1" }),
    mkCourse({ name: "大学英语2", credits: 3, difficulty: 3, examLoad: 2, required: true, locked: true, area: "英语", suggestedTerm: 2, slot: "Tue-1" }),

    mkCourse({ name: "学术英语阅读", credits: 2, difficulty: 3, examLoad: 2, required: true, locked: true, area: "英语", suggestedTerm: 3, slot: "Tue-2" }),
    mkCourse({ name: "学术英语写作", credits: 2, difficulty: 4, examLoad: 2, required: true, locked: true, area: "英语", suggestedTerm: 4, slot: "Tue-2" }),

    mkCourse({ name: "思政导论", credits: 2, difficulty: 2, examLoad: 2, required: true, locked: true, area: "思政", suggestedTerm: 1, slot: "Wed-1" }),
    mkCourse({ name: "中国近代史纲要", credits: 2, difficulty: 2, examLoad: 2, required: true, locked: true, area: "思政", suggestedTerm: 2, slot: "Wed-1" }),
    mkCourse({ name: "马克思主义基本原理", credits: 3, difficulty: 3, examLoad: 3, required: true, locked: true, area: "思政", suggestedTerm: 3, slot: "Wed-1" }),
    mkCourse({ name: "毛泽东思想和中国特色社会主义理论体系概论", credits: 3, difficulty: 3, examLoad: 3, required: true, locked: true, area: "思政", suggestedTerm: 4, slot: "Wed-1" }),
    mkCourse({ name: "习近平新时代中国特色社会主义思想概论", credits: 3, difficulty: 3, examLoad: 3, required: true, locked: true, area: "思政", suggestedTerm: 5, slot: "Wed-1" }),
    mkCourse({ name: "形势与政策", credits: 1, difficulty: 1, examLoad: 1, required: true, locked: true, area: "思政", suggestedTerm: 6, slot: "Wed-1" }),
    mkCourse({ name: "形势与政策2", credits: 1, difficulty: 1, examLoad: 1, required: true, locked: true, area: "思政", suggestedTerm: 7, slot: "Wed-1" }),
    mkCourse({ name: "形势与政策3", credits: 1, difficulty: 1, examLoad: 1, required: true, locked: true, area: "思政", suggestedTerm: 8, slot: "Wed-1" }),
  ];

  function getTermRequiredGeneral(term) {
    return GENERAL_REQUIRED_SEQUENCE.filter(c => c.suggestedTerm === term);
  }

  // ===== 学院核心课池（可继续加厚） =====
  function buildAcademyPool(academyNorm) {
    const pool = [];

    if (academyNorm === "stem") {
      pool.push(
        mkCourse({ name: "高等数学A", credits: 4, difficulty: 5, examLoad: 3, required: true, area: "理工", suggestedTerm: 1, slot: "Thu-1" }),
        mkCourse({ name: "线性代数", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "理工", suggestedTerm: 1, slot: "Fri-1" }),
        mkCourse({ name: "大学物理", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "理工", suggestedTerm: 1, slot: "Thu-2" }),

        mkCourse({ name: "程序设计基础", credits: 3, difficulty: 3, examLoad: 2, required: true, area: "理工", suggestedTerm: 2, slot: "Thu-2" }),
        mkCourse({ name: "概率论与数理统计", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "理工", suggestedTerm: 2, slot: "Fri-2" }),
        mkCourse({ name: "数据分析入门", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "理工", suggestedTerm: 2, slot: "Wed-2" }),

        mkCourse({ name: "数据结构", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "理工", suggestedTerm: 3, slot: "Thu-3" }),
        mkCourse({ name: "离散数学", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "理工", suggestedTerm: 3, slot: "Fri-3" }),
        mkCourse({ name: "计算机组成", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "理工", suggestedTerm: 3, slot: "Wed-3" }),

        mkCourse({ name: "操作系统", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "理工", suggestedTerm: 4, slot: "Thu-1" }),
        mkCourse({ name: "数据库基础", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "理工", suggestedTerm: 4, slot: "Fri-1" }),
        mkCourse({ name: "算法设计", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "理工", suggestedTerm: 4, slot: "Fri-2" }),

        mkCourse({ name: "机器学习导论", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "理工", suggestedTerm: 5, slot: "Thu-2" }),
        mkCourse({ name: "统计学习", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "理工", suggestedTerm: 5, slot: "Fri-2" }),
        mkCourse({ name: "生物信息学导论", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "理工", suggestedTerm: 5, slot: "Tue-3" }),

        mkCourse({ name: "深度学习入门", credits: 3, difficulty: 5, examLoad: 3, required: false, area: "理工", suggestedTerm: 6, slot: "Thu-3" }),
        mkCourse({ name: "软件工程", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "理工", suggestedTerm: 6, slot: "Mon-2" }),
        mkCourse({ name: "科研项目实践", credits: 4, difficulty: 4, examLoad: 2, required: false, area: "理工", suggestedTerm: 7, slot: "Wed-2" }),

        mkCourse({ name: "毕业设计/论文", credits: 6, difficulty: 4, examLoad: 2, required: true, area: "理工", suggestedTerm: 8, slot: "Thu-1" }),
      );
    }

    if (academyNorm === "medicine") {
      pool.push(
        mkCourse({ name: "人体解剖学", credits: 4, difficulty: 5, examLoad: 3, required: true, area: "医学", suggestedTerm: 1, slot: "Thu-1" }),
        mkCourse({ name: "医学细胞生物学", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "医学", suggestedTerm: 1, slot: "Fri-1" }),

        mkCourse({ name: "生理学", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "医学", suggestedTerm: 2, slot: "Thu-2" }),
        mkCourse({ name: "生物化学", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "医学", suggestedTerm: 2, slot: "Fri-2" }),

        mkCourse({ name: "病理学", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "医学", suggestedTerm: 3, slot: "Thu-3" }),
        mkCourse({ name: "微生物学", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "医学", suggestedTerm: 3, slot: "Fri-3" }),

        mkCourse({ name: "药理学", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "医学", suggestedTerm: 4, slot: "Fri-1" }),
        mkCourse({ name: "诊断学", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "医学", suggestedTerm: 4, slot: "Thu-1" }),

        mkCourse({ name: "内科学", credits: 4, difficulty: 5, examLoad: 3, required: false, area: "医学", suggestedTerm: 5, slot: "Thu-2" }),
        mkCourse({ name: "外科学", credits: 4, difficulty: 5, examLoad: 3, required: false, area: "医学", suggestedTerm: 5, slot: "Fri-2" }),

        mkCourse({ name: "临床见习", credits: 4, difficulty: 4, examLoad: 2, required: true, area: "医学", suggestedTerm: 6, slot: "Thu-3" }),
        mkCourse({ name: "科研/病例报告写作", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "医学", suggestedTerm: 7, slot: "Tue-3" }),

        mkCourse({ name: "毕业实习/论文", credits: 6, difficulty: 4, examLoad: 2, required: true, area: "医学", suggestedTerm: 8, slot: "Thu-1" }),
      );
    }

    if (academyNorm === "biz") {
      pool.push(
        mkCourse({ name: "微观经济学", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "商科", suggestedTerm: 1, slot: "Thu-1" }),
        mkCourse({ name: "管理学导论", credits: 3, difficulty: 3, examLoad: 2, required: true, area: "商科", suggestedTerm: 1, slot: "Fri-1" }),

        mkCourse({ name: "宏观经济学", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "商科", suggestedTerm: 2, slot: "Thu-2" }),
        mkCourse({ name: "会计学基础", credits: 3, difficulty: 3, examLoad: 2, required: true, area: "商科", suggestedTerm: 2, slot: "Fri-2" }),

        mkCourse({ name: "统计学（商科）", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "商科", suggestedTerm: 3, slot: "Thu-3" }),
        mkCourse({ name: "市场营销", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "商科", suggestedTerm: 3, slot: "Fri-3" }),
        mkCourse({ name: "财务管理", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "商科", suggestedTerm: 3, slot: "Wed-2" }),

        mkCourse({ name: "商业案例分析", credits: 3, difficulty: 4, examLoad: 2, required: false, area: "商科", suggestedTerm: 4, slot: "Thu-1" }),
        mkCourse({ name: "运营管理", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "商科", suggestedTerm: 4, slot: "Fri-1" }),

        mkCourse({ name: "公司金融", credits: 3, difficulty: 5, examLoad: 3, required: false, area: "商科", suggestedTerm: 5, slot: "Thu-2" }),
        mkCourse({ name: "战略管理", credits: 3, difficulty: 4, examLoad: 2, required: false, area: "商科", suggestedTerm: 5, slot: "Fri-2" }),

        mkCourse({ name: "实习与职场实践", credits: 4, difficulty: 3, examLoad: 1, required: false, area: "商科", suggestedTerm: 6, slot: "Tue-3" }),
        mkCourse({ name: "毕业论文", credits: 6, difficulty: 3, examLoad: 2, required: true, area: "商科", suggestedTerm: 8, slot: "Thu-1" }),
      );
    }

    if (academyNorm === "arts") {
      pool.push(
        mkCourse({ name: "学术写作基础", credits: 2, difficulty: 3, examLoad: 2, required: true, area: "文社", suggestedTerm: 1, slot: "Thu-1" }),
        mkCourse({ name: "经典阅读", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "文社", suggestedTerm: 1, slot: "Fri-1" }),

        mkCourse({ name: "社会调查方法", credits: 3, difficulty: 4, examLoad: 3, required: true, area: "文社", suggestedTerm: 2, slot: "Thu-2" }),
        mkCourse({ name: "统计入门（社科）", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "文社", suggestedTerm: 2, slot: "Fri-2" }),

        mkCourse({ name: "论文写作工作坊", credits: 3, difficulty: 4, examLoad: 2, required: true, area: "文社", suggestedTerm: 3, slot: "Thu-3" }),
        mkCourse({ name: "定量研究方法", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "文社", suggestedTerm: 3, slot: "Fri-3" }),

        mkCourse({ name: "社会理论", credits: 3, difficulty: 4, examLoad: 3, required: false, area: "文社", suggestedTerm: 4, slot: "Thu-1" }),
        mkCourse({ name: "田野调查", credits: 3, difficulty: 4, examLoad: 2, required: false, area: "文社", suggestedTerm: 5, slot: "Tue-3" }),

        mkCourse({ name: "毕业论文", credits: 6, difficulty: 4, examLoad: 2, required: true, area: "文社", suggestedTerm: 8, slot: "Thu-1" }),
      );
    }

    // ===== 通识/选修池（所有学院） =====
    pool.push(
      mkCourse({ name: "心理健康与自我成长", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 2, slot: "Mon-2" }),
      mkCourse({ name: "科研入门与文献检索", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "通识", suggestedTerm: 3, slot: "Mon-3" }),
      mkCourse({ name: "演讲与沟通", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 3, slot: "Tue-3" }),
      mkCourse({ name: "职业发展与求职", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 5, slot: "Wed-2" }),
      mkCourse({ name: "创新创业基础", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "通识", suggestedTerm: 6, slot: "Mon-3" }),
      mkCourse({ name: "跨学科项目实践", credits: 3, difficulty: 4, examLoad: 2, required: false, area: "通识", suggestedTerm: 7, slot: "Wed-3" }),

      // ===== 填学分用的 1-2 学分通识（用来凑到 160） =====
      mkCourse({ name: "通识选修：艺术鉴赏", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 1, slot: "Mon-2" }),
      mkCourse({ name: "通识选修：科学史", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 1, slot: "Mon-3" }),
      mkCourse({ name: "通识选修：写作与表达", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "通识", suggestedTerm: 2, slot: "Tue-3" }),
      mkCourse({ name: "通识选修：数据素养", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "通识", suggestedTerm: 2, slot: "Wed-2" }),
      mkCourse({ name: "通识选修：心理学导论", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 3, slot: "Mon-2" }),
      mkCourse({ name: "通识选修：经济学思维", credits: 2, difficulty: 3, examLoad: 2, required: false, area: "通识", suggestedTerm: 4, slot: "Tue-3" }),
      mkCourse({ name: "通识选修：AI 与社会", credits: 2, difficulty: 3, examLoad: 1, required: false, area: "通识", suggestedTerm: 5, slot: "Fri-3" }),
      mkCourse({ name: "通识选修：法律常识", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 5, slot: "Thu-3" }),
      mkCourse({ name: "通识选修：金融与生活", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 6, slot: "Fri-3" }),
      mkCourse({ name: "通识选修：社会热点研讨", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 7, slot: "Thu-2" }),
      mkCourse({ name: "通识选修：毕业求职写作", credits: 2, difficulty: 2, examLoad: 1, required: false, area: "通识", suggestedTerm: 8, slot: "Tue-3" }),

      // 1 学分小课：用来精确凑学分
      mkCourse({ name: "任选小课：摄影入门", credits: 1, difficulty: 1, examLoad: 0, required: false, area: "通识", suggestedTerm: 2, slot: "Wed-3" }),
      mkCourse({ name: "任选小课：时间管理", credits: 1, difficulty: 1, examLoad: 0, required: false, area: "通识", suggestedTerm: 3, slot: "Thu-2" }),
      mkCourse({ name: "任选小课：求职简历", credits: 1, difficulty: 1, examLoad: 0, required: false, area: "通识", suggestedTerm: 4, slot: "Fri-2" }),
      mkCourse({ name: "任选小课：英语口语角", credits: 1, difficulty: 1, examLoad: 0, required: false, area: "通识", suggestedTerm: 5, slot: "Mon-2" }),
      mkCourse({ name: "任选小课：科研伦理", credits: 1, difficulty: 1, examLoad: 0, required: false, area: "通识", suggestedTerm: 6, slot: "Wed-2" }),
      mkCourse({ name: "任选小课：毕业讲座", credits: 1, difficulty: 1, examLoad: 0, required: false, area: "通识", suggestedTerm: 8, slot: "Fri-3" }),
    );

    return pool;
  }

  // 8 学期目标学分（总计 160）
  const TERM_TARGET_CREDITS = [20, 20, 20, 20, 20, 20, 20, 20];

  function pickToFill(candidates, chosen, target) {
    // 目标：尽量不冲突、尽量刚好填到 target（可允许微小超额）
    const picked = [];

    const tryPick = (list, remaining, preferFit) => {
      let best = null;
      let bestOver = Infinity;

      for (const c of list) {
        if (conflictsWithAny(c, chosen)) continue;

        const cc = Number(c.credits || 0);
        const over = (sumCredits(chosen) + cc) - target;

        // 先尝试“能正好塞进 remaining”
        if (preferFit && cc <= remaining) {
          best = c;
          bestOver = over;
          break;
        }

        // 否则选“超额最小”的
        if (over >= 0 && over < bestOver) {
          best = c;
          bestOver = over;
        }
      }
      return best;
    };

    let guard = 0;
    while (sumCredits(chosen) < target && guard < 200) {
      guard++;
      const remaining = target - sumCredits(chosen);

      // 先选能 fit 的
      let c = tryPick(candidates, remaining, true);

      // 如果剩余太小，找 1 学分/2 学分小课来凑
      if (!c && remaining <= 2) {
        const small = candidates.filter(x => Number(x.credits || 0) <= remaining)
          .sort((a, b) => Number(a.credits || 0) - Number(b.credits || 0));
        c = tryPick(small, remaining, true);
      }

      // 实在不行就选超额最小的
      if (!c) c = tryPick(candidates, remaining, false);

      if (!c) break;
      chosen.push({ ...c });
      picked.push({ ...c });
      candidates = candidates.filter(x => x.id !== c.id);
    }

    return picked;
  }

  function generatePlan(academyZh) {
    const academyNorm = normalizeAcademy(academyZh);
    const coursePool = [
      ...GENERAL_REQUIRED_SEQUENCE.map(c => ({ ...c })),
      ...buildAcademyPool(academyNorm).map(c => ({ ...c })),
    ];

    const lockedByTerm = {};
    for (let term = 1; term <= 8; term++) {
      lockedByTerm[term] = getTermRequiredGeneral(term).map(c => c.id);
    }

    // 计划：term -> courseId[]
    const planByTerm = {};

    // 按“这门课预计在哪学期修”做一个可用池
    const bySuggestedTerm = (t) => coursePool.filter(c => Number(c.suggestedTerm || 1) <= t);

    const used = new Set();

    for (let term = 1; term <= 8; term++) {
      const chosen = [];

      // 1) 强制课（锁死）
      for (const c of getTermRequiredGeneral(term)) {
        chosen.push({ ...c });
        used.add(c.id);
      }

      // 2) 本学院/通识课程：优先 required，再选修
      const target = TERM_TARGET_CREDITS[term - 1] || 20;

      const poolNow = coursePool
        .filter(c => !used.has(c.id))
        .filter(c => Number(c.suggestedTerm || 1) <= term + 1) // 允许提前一点点看到未来课
        .map(c => ({ ...c }));

      const req = poolNow.filter(c => c.required).sort((a, b) => (a.suggestedTerm - b.suggestedTerm) || (b.credits - a.credits));
      const ele = poolNow.filter(c => !c.required).sort((a, b) => (a.suggestedTerm - b.suggestedTerm) || (Number(a.credits || 0) - Number(b.credits || 0)));

      pickToFill(req, chosen, target);
      pickToFill(ele, chosen, target);

      // 3) 记录 + 标记 used
      for (const c of chosen) used.add(c.id);
      planByTerm[term] = chosen.map(c => c.id);
    }

    const termTargetCredits = {};
    for (let term = 1; term <= 8; term++) termTargetCredits[term] = TERM_TARGET_CREDITS[term - 1];

    return {
      graduateCredits: 160,
      termTargetCredits,
      lockedByTerm,
      planByTerm,
      coursePool,
      TIME_SLOTS,
      sumCredits,
      courseConflicts,
    };
  }

  window.COURSE = {
    generatePlan,
    TIME_SLOTS,
  };
})();
