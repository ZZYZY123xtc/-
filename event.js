// event.js
// =========================
// 大学生模拟器 v0.4.2 事件系统
// - window.EVENTS: [{ id, title, text, weight, tags, gates, options }]
// - window.eventMatchesState(ev, state): gate 判断
// 说明：
// - “每月一次聚餐”在 game.js 里强制触发，这里只放随机事件。
// - 家教/实习事件：收入 = 150*(2~3)（随机）
// =========================
(() => {
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  function gate({
    yearMin = 1,
    yearMax = 99,
    termMin = 1,
    termMax = 99,
    weekMin = 1,
    weekMax = 99,
    familyIn = null, // e.g. ['poor','ok']
    academyIn = null, // e.g. ['理工']
    routeIn = null, // e.g. ['科研']
    socialMin = 0,
    socialMax = 999,
    flagsAny = null,
    flagsAll = null,
    notFlags = null,
  } = {}) {
    return {
      yearMin, yearMax,
      termMin, termMax,
      weekMin, weekMax,
      familyIn, academyIn, routeIn,
      socialMin, socialMax,
      flagsAny, flagsAll, notFlags,
    };
  }

  function eventMatchesState(ev, state) {
    if (!ev?.gates || ev.gates.length === 0) return true;
    const hasFlag = (k) => !!state?.flags?.[k];

    for (const g of ev.gates) {
      if (state.year < g.yearMin || state.year > g.yearMax) return false;
      if (state.term < g.termMin || state.term > g.termMax) return false;
      if (state.week < g.weekMin || state.week > g.weekMax) return false;
      if (g.familyIn && !g.familyIn.includes(state.family)) return false;
      if (g.academyIn && !g.academyIn.includes(state.academy)) return false;
      if (g.routeIn && !g.routeIn.includes(state.route)) return false;
      if (state.social < g.socialMin || state.social > g.socialMax) return false;

      if (g.notFlags && g.notFlags.some(hasFlag)) return false;
      if (g.flagsAll && !g.flagsAll.every(hasFlag)) return false;
      if (g.flagsAny && !g.flagsAny.some(hasFlag)) return false;
    }
    return true;
  }

  // 家教/实习：每次触发随机天数 2~3
  function jobPay(daysMin = 2, daysMax = 3, perDay = 150) {
    const days = randInt(daysMin, daysMax);
    return { days, money: days * perDay };
  }

  const EVENTS = [
    // ==== 日常/心情 ====
    {
      id: "G_CAMPUS_CAT",
      title: "校园猫来蹭",
      text: "校园猫蹭到你脚边，你突然不想学习了。",
      weight: 8,
      tags: ["mood"],
      gates: [gate({})],
      options: [
        { text: "摸猫5分钟", effects: { mood: +3, stress: -2, hidden: { stability: +1 }, note: "情绪回血。" } },
        { text: "拍照发朋友圈", effects: { mood: +2, stress: -1, social: +2, hidden: { careerPower: +0.1 }, note: "社交存在感。" } },
      ],
    },
    {
      id: "G_ROOMMATE_FIGHT",
      title: "室友吵架",
      text: "室友因为空调/卫生的小事吵起来了。",
      weight: 6,
      tags: ["stress"],
      gates: [gate({})],
      options: [
        { text: "加入战局（吵回去）", effects: { stress: +6, mood: -4, social: -2, note: "赢了嘴，输了心情。" } },
        { text: "冷处理（各回各屋）", effects: { stress: +2, mood: -2, hidden: { stability: +1 }, note: "表面和平，暗流涌动。" } },
        { text: "买点饮料劝和（花钱消灾）", effects: { money: -120, stress: -3, mood: +1, social: +2, note: "用奶茶买来了短暂的和平。" } },
      ],
    },
    {
      id: "G_CLUB_INVITE",
      title: "社团招新",
      text: "你路过摊位，被拉住：要不要加入我们？",
      weight: 7,
      tags: ["social"],
      gates: [gate({})],
      options: [
        { text: "加入（扩大圈子）", effects: { energy: -4, mood: +3, social: +6, hidden: { careerPower: +0.2, stability: +1 }, note: "认识人=潜在机会。" } },
        { text: "婉拒（保时间）", effects: { termGradeBonus: +1, mood: +1, social: -1, hidden: { academicPower: +0.2 }, note: "把时间留给学习。" } },
      ],
    },
    {
      id: "G_MILK_TEA",
      title: "奶茶诱惑",
      text: "你路过奶茶店，脑子里出现一个声音：就一杯。",
      weight: 7,
      tags: ["mood", "money"],
      gates: [gate({})],
      options: [
        { text: "买（快乐+）", effects: { money: -30, mood: +4, stress: -2, hidden: { stability: +0.5 }, note: "情绪回血，钱包小流血。" } },
        { text: "忍住（自控+）", effects: { mood: -1, termGradeBonus: +1, hidden: { stability: +1 }, note: "延迟满足=长期收益。" } },
      ],
    },
    {
      id: "G_LIBRARY_AURA",
      title: "图书馆卷王领域展开",
      text: "你被旁边的键盘声和翻页声刺激到了。",
      weight: 7,
      tags: ["study"],
      gates: [gate({})],
      options: [
        { text: "被带着卷一把", effects: { energy: -6, stress: +5, termGradeBonus: +2, hidden: { academicPower: +0.8 }, note: "卷=成绩加成，但压力上升。" } },
        { text: "回寝回血", effects: { energy: +6, stress: -4, mood: +2, hidden: { stability: +1 }, note: "保命优先。" } },
      ],
    },
    {
      id: "G_CLASS_QUIZ",
      title: "突然小测",
      text: "老师临时抽人小测，你刚好在名单里。",
      weight: 6,
      tags: ["study"],
      gates: [gate({})],
      options: [
        { text: "硬上（心跳加速）", effects: { stress: +6, termGradeBonus: +1, hidden: { academicPower: +0.3 }, note: "慌中带稳。" } },
        { text: "临时抱佛脚", effects: { energy: -6, stress: +4, termGradeBonus: +2, note: "抱住了，没全稳。" } },
      ],
    },
    {
      id: "G_ATTENDANCE_CHECK",
      title: "点名风暴",
      text: "今天点名，老师似乎有备而来。",
      weight: 5,
      tags: ["study"],
      gates: [gate({})],
      options: [
        { text: "乖乖到场", effects: { stress: +1, termGradeBonus: +1, note: "低成本稳住出勤。" } },
        { text: "逃课（赌一把）", effects: { mood: +1, stress: +6, termGradeBonus: -2, note: "赌赢了轻松，赌输了就惨。" } },
      ],
    },

    // ==== 健康/休息 ====
    {
      id: "H_COLD",
      title: "小感冒来袭",
      text: "换季感冒找上门，你鼻子不太舒服。",
      weight: 5,
      tags: ["health"],
      gates: [gate({})],
      options: [
        { text: "吃药+早睡", effects: { energy: +8, stress: -4, mood: +1, money: -30, note: "修复成功。" } },
        { text: "硬扛", effects: { energy: -6, stress: +4, mood: -2, note: "硬扛一周更累。" } },
      ],
    },
    {
      id: "H_RUN",
      title: "晨跑计划",
      text: "室友喊你一起晨跑，空气还算清新。",
      weight: 4,
      tags: ["health"],
      gates: [gate({})],
      options: [
        { text: "一起跑", effects: { energy: -4, stress: -4, mood: +2, hidden: { stability: +0.5 }, note: "运动回血。" } },
        { text: "继续睡", effects: { energy: +6, mood: +1, note: "睡眠也是回血。" } },
      ],
    },
    {
      id: "H_MASSAGE",
      title: "按摩/理疗",
      text: "路过一家小店，写着：肩颈救星。你心动了。",
      weight: 4,
      tags: ["relax", "money"],
      gates: [gate({})],
      options: [
        { text: "去（花钱买轻松）", effects: { money: -(180 + randInt(0, 180)), energy: +10, stress: -10, mood: +3, note: "人类的快乐，有时是肩膀不酸。" } },
        { text: "算了（继续硬扛）", effects: { stress: +1, note: "把以后再说写进了肌肉记忆。" } },
      ],
    },

    // ==== 消费/意外 ====
    {
      id: "M_PHONE_BREAK",
      title: "手机摔了",
      text: "一不小心手机磕到桌角，屏幕出现蜘蛛网裂纹。",
      weight: 5,
      tags: ["money"],
      gates: [gate({})],
      options: [
        { text: "换屏（心在滴血）", effects: { money: -(300 + randInt(0, 300)), mood: -2, stress: +2, note: "钱包：我恨你。" } },
        { text: "先凑合用（强迫症发作）", effects: { mood: -1, stress: +1, note: "每次亮屏都像在看伤口。" } },
      ],
    },
    {
      id: "M_LAPTOP_REPAIR",
      title: "电脑出问题",
      text: "电脑突然蓝屏，文件还没保存。",
      weight: 4,
      tags: ["money", "study"],
      gates: [gate({})],
      options: [
        { text: "送修（保命）", effects: { money: -(200 + randInt(0, 200)), stress: -2, note: "维修费很痛，但人稳了。" } },
        { text: "自己修（赌运气）", effects: { stress: +3, mood: -1, note: "修好算你狠。" } },
      ],
    },
    {
      id: "M_LOST_CARD",
      title: "校园卡丢了",
      text: "吃饭时发现卡不见了，只能补办。",
      weight: 4,
      tags: ["money"],
      gates: [gate({})],
      options: [
        { text: "补办", effects: { money: -50, stress: +1, note: "小钱但很烦。" } },
        { text: "先借用朋友的", effects: { social: -1, stress: +2, note: "人情债+1。" } },
      ],
    },
    {
      id: "M_IMPULSE_BUY",
      title: "冲动消费",
      text: "你刷到一个限时折扣，手指有点不受控。",
      weight: 6,
      tags: ["money", "mood"],
      gates: [gate({})],
      options: [
        { text: "买（快乐5分钟）", effects: { money: -(120 + randInt(0, 260)), mood: +3, stress: -1, note: "多巴胺到账。" } },
        { text: "忍住（理性获胜）", effects: { mood: +1, hidden: { stability: +1 }, note: "对未来的自己很好。" } },
      ],
    },

    // ==== 兼职/实习 ====
    {
      id: "J_TUTOR_INVITE",
      title: "家教邀约",
      text: "同学问你：我表弟需要家教，你要不要接？",
      weight: 7,
      tags: ["job"],
      gates: [gate({})],
      options: [
        {
          build: () => {
            const { days, money } = jobPay(2, 3, 150);
            return {
              text: `接（这周 ${days} 次，+${money}）`,
              effects: {
                money: +money,
                energy: -12,
                stress: +8,
                mood: -1,
                termGradeBonus: -1,
                social: +1,
                hidden: { careerPower: +0.15 },
                note: `家教 ${days} 次：钱来了，但学习时间没了。`,
              },
            };
          },
        },
        {
          build: () => {
            const { days, money } = jobPay(4, 5, 150);
            return {
              text: `接更多（这周 ${days} 次，+${money}）`,
              effects: {
                money: +money,
                energy: -20,
                stress: +14,
                mood: -2,
                termGradeBonus: -2,
                social: +1,
                hidden: { careerPower: +0.25 },
                note: `家教 ${days} 次：钱多了，学习被挤压了。`,
              },
            };
          },
        },
        { text: "拒绝（保住学习节奏）", effects: { mood: +1, stress: -1, note: "你决定把这周留给课程。" } },
        { text: "拒绝并躺平（回血）", effects: { energy: +8, stress: -8, mood: +2, note: "你把这周还给了自己。" } },
      ],
    },
    {
      id: "J_INTERN_INVITE",
      title: "实习机会",
      text: "学长问你：我们组缺人，来帮忙做点杂活/写点材料？",
      weight: 5,
      tags: ["job", "career"],
      gates: [gate({ yearMin: 2 })],
      options: [
        {
          build: () => {
            const { days, money } = jobPay(2, 3, 150);
            return {
              text: `去（这周 ${days} 天，+${money}）`,
              effects: {
                money: +money,
                energy: -16,
                stress: +12,
                mood: -2,
                termGradeBonus: -2,
                social: +2,
                hidden: { careerPower: +0.25 },
                note: `实习 ${days} 天：涨经验也涨疲惫。`,
              },
            };
          },
        },
        {
          build: () => {
            const { days, money } = jobPay(4, 5, 150);
            return {
              text: `加班去（这周 ${days} 天，+${money}）`,
              effects: {
                money: +money,
                energy: -24,
                stress: +18,
                mood: -3,
                termGradeBonus: -3,
                social: +2,
                hidden: { careerPower: +0.35 },
                note: `实习 ${days} 天：钱多了，但身心被榨干了。`,
              },
            };
          },
        },
        { text: "不去（先把课过了）", effects: { mood: +1, stress: -1, note: "你把精力留给作业/期中。" } },
        { text: "不去并补觉（回血）", effects: { energy: +10, stress: -10, mood: +2, note: "你决定先把自己修好。" } },
      ],
    },

    // ==== 机会/突破 ====
    {
      id: "C_SCHOLARSHIP_RUMOR",
      title: "奖学金风声",
      text: "你听说学院最近有个小额奖学金名额。",
      weight: 3,
      tags: ["breakthrough"],
      gates: [gate({ socialMin: 25 })],
      options: [
        { text: "去问问老师/学长", effects: { stress: +2, social: +2, hidden: { careerPower: +0.1 }, note: "信息差就是生产力。" } },
        { text: "算了（别折腾）", effects: { note: "你选择省心。" } },
      ],
    },
    {
      id: "C_COMPETITION",
      title: "学科竞赛组队",
      text: "学长来找你组队参赛，听起来又卷又刺激。",
      weight: 3,
      tags: ["breakthrough", "study"],
      gates: [gate({ yearMin: 2 })],
      options: [
        { text: "加入（爆肝）", effects: { energy: -12, stress: +10, termGradeBonus: +2, hidden: { academicPower: +1, careerPower: +0.4 }, note: "打比赛=能力加成。" } },
        { text: "婉拒（保住节奏）", effects: { mood: +1, stress: -1, note: "节奏稳住了。" } },
      ],
    },
    {
      id: "R_PI_CALL",
      title: "科研线：导师抓你跑数据",
      text: "导师：今晚把那批数据跑完，明早要看图。",
      weight: 5,
      tags: ["route:research"],
      gates: [gate({ routeIn: ["research"], yearMin: 2 })],
      options: [
        { text: "硬刚通宵", effects: { energy: -16, stress: +12, mood: -2, termGradeBonus: -2, hidden: { academicPower: +0.5 }, note: "科研推进，但学习被挤压。" } },
        { text: "争取延期", effects: { stress: +6, mood: -2, termGradeBonus: +1, hidden: { stability: +1 }, note: "保命但有点心虚。" } },
      ],
    },
    {
      id: "C_INTERVIEW",
      title: "就业线：面试邀约",
      text: "HR 发来消息：这周能来面试吗？你突然开始紧张。",
      weight: 4,
      tags: ["route:career"],
      gates: [gate({ routeIn: ["career"], yearMin: 2 })],
      options: [
        { text: "准备+参加", effects: { energy: -10, stress: +8, hidden: { careerPower: +0.8 }, note: "就业推进。" } },
        { text: "怂了不去", effects: { mood: -2, stress: +4, hidden: { careerPower: -0.4, stability: -1 }, note: "机会流失。" } },
      ],
    },
    {
      id: "A_ENGLISH_TEST_BOOK",
      title: "出国线：语言考试报名",
      text: "你看到报名窗口：现在报，还来得及冲一把。",
      weight: 4,
      tags: ["route:abroad"],
      gates: [gate({ routeIn: ["abroad"], yearMin: 2 })],
      options: [
        { text: "报名（花钱买机会）", effects: { money: -600, stress: +6, hidden: { careerPower: +0.3 }, flags: { bookedEnglishTest: true }, note: "后续可触发出分事件。" } },
        { text: "先不报", effects: { stress: -1, mood: +1, hidden: { stability: +1 }, note: "窗口会过去。" } },
      ],
    },

    // ==== 日常补充 ====
    {
      id: "G_SHORT_VIDEO",
      title: "短视频停不下来",
      text: "你只是想看一眼，结果半小时变两小时。",
      weight: 8,
      tags: ["mood"],
      gates: [gate({})],
      options: [
        { text: "卸载一周", effects: { mood: -1, stress: +1, termGradeBonus: +2, hidden: { stability: +2 }, note: "痛一下，但学习时间回来了。" } },
        { text: "继续刷（爽）", effects: { mood: +1, stress: +3, energy: -5, termGradeBonus: -2, hidden: { stability: -1 }, note: "爽完更焦虑。" } },
      ],
    },
    {
      id: "G_RAINY_DAY",
      title: "下雨的一天",
      text: "雨一直下，你突然很想躺平。",
      weight: 6,
      tags: ["mood"],
      gates: [gate({})],
      options: [
        { text: "在室内做点事", effects: { energy: -4, termGradeBonus: +1, hidden: { academicPower: +0.4 }, note: "一点点推进也算推进。" } },
        { text: "彻底摆烂休息", effects: { energy: +6, stress: -3, mood: +2, hidden: { stability: +1 }, note: "恢复也很重要。" } },
      ],
    },
    {
      id: "G_ROOMMATE_NOISE",
      title: "室友噪音事件",
      text: "室友半夜打游戏，你被吵醒。",
      weight: 6,
      tags: ["stress"],
      gates: [gate({})],
      options: [
        { text: "沟通（硬气）", effects: { stress: +2, mood: -1, hidden: { stability: +1 }, note: "短期尴尬，长期好。" } },
        { text: "忍了（委屈）", effects: { energy: -6, stress: +4, hidden: { stability: -1 }, note: "睡眠债记账。" } },
      ],
    },
    {
      id: "G_SIDE_PROJECT",
      title: "突然想做个小项目",
      text: "你脑子里冒出一个点子：做个小项目会不会很酷？",
      weight: 6,
      tags: ["career"],
      gates: [gate({})],
      options: [
        { text: "开干（小步快跑）", effects: { energy: -6, mood: +3, stress: +2, hidden: { careerPower: +0.6 }, note: "作品集+1（隐性就业潜力）。" } },
        { text: "先记下来", effects: { mood: +1, hidden: { stability: +1 }, termGradeBonus: +1, note: "不分心，保成绩。" } },
      ],
    },
    {
      id: "G_STUDY_GROUP",
      title: "自习搭子",
      text: "有人问你要不要一起自习。",
      weight: 6,
      tags: ["study"],
      gates: [gate({})],
      options: [
        { text: "一起自习", effects: { energy: -6, stress: +4, termGradeBonus: +2, hidden: { academicPower: +0.6 }, note: "效率更稳。" } },
        { text: "拒绝", effects: { mood: -1, stress: +1, hidden: { stability: +1 }, note: "保护边界。" } },
      ],
    },
    {
      id: "G_BIKE_FLAT",
      title: "车胎没气了",
      text: "你出门发现车胎没气，心情有点糟。",
      weight: 5,
      tags: ["money"],
      gates: [gate({})],
      options: [
        { text: "修车（省事）", effects: { money: -20, stress: -1, note: "小钱换省心。" } },
        { text: "走路回去", effects: { energy: -4, mood: -1, note: "省钱但费脚。" } },
      ],
    },

    // ==== 健康补充 ====
    {
      id: "H_ALLERGY",
      title: "过敏发作",
      text: "季节性过敏来袭，你眼睛很难受。",
      weight: 4,
      tags: ["health"],
      gates: [gate({})],
      options: [
        { text: "买药+休息", effects: { money: -40, energy: +6, stress: -2, note: "缓解不少。" } },
        { text: "硬扛一天", effects: { energy: -6, stress: +3, mood: -2, note: "硬扛更累。" } },
      ],
    },
    {
      id: "H_SLEEP_DEBT",
      title: "睡眠债爆表",
      text: "连续熬夜后，你整天昏昏沉沉。",
      weight: 5,
      tags: ["health"],
      gates: [gate({})],
      options: [
        { text: "今晚早睡", effects: { energy: +10, stress: -4, mood: +1, hidden: { stability: +1 }, note: "回血明显。" } },
        { text: "继续硬扛", effects: { energy: -8, stress: +4, termGradeBonus: +1, hidden: { stability: -1 }, note: "硬扛=代价更高。" } },
      ],
    },

    // ==== 消费补充 ====
    {
      id: "M_TEXTBOOKS",
      title: "教材费",
      text: "老师让买教材/打印讲义。",
      weight: 5,
      tags: ["money", "study"],
      gates: [gate({ weekMin: 1, weekMax: 6 })],
      options: [
        { text: "按要求买", effects: { money: -120, termGradeBonus: +1, note: "资料齐全更安心。" } },
        { text: "借同学/找电子版", effects: { stress: +2, termGradeBonus: 0, note: "省钱但麻烦。" } },
      ],
    },
    {
      id: "M_SUBSCRIPTION",
      title: "会员自动续费",
      text: "你忘记关会员自动续费，被扣了一笔。",
      weight: 4,
      tags: ["money"],
      gates: [gate({})],
      options: [
        { text: "认了", effects: { money: -50, mood: -1, note: "心痛但懒得折腾。" } },
        { text: "立刻取消", effects: { money: -50, stress: +1, hidden: { stability: +1 }, note: "至少止损了。" } },
      ],
    },

    // ==== 家庭/家境 ====
    {
      id: "F_ALLOWANCE_DELAY",
      title: "生活费延迟",
      text: "家里说这个月周转不开，生活费可能要晚点到。",
      weight: 7,
      tags: ["family"],
      gates: [gate({ familyIn: ["poor"] })],
      options: [
        { text: "勒紧裤腰带", effects: { mood: -2, stress: +6, hidden: { stability: +1 }, note: "穷人版坚强。" } },
        { text: "找同学借点", effects: { money: +200, stress: +3, flags: { debt: true }, note: "借钱会留下债务标记。" } },
      ],
    },
    {
      id: "F_RED_PACKET",
      title: "家里小红包",
      text: "家里问你最近怎么样，顺手发了个小红包。",
      weight: 6,
      tags: ["family"],
      gates: [gate({ familyIn: ["ok", "mid", "rich"] })],
      options: [
        { text: "收下（心安）", effects: { money: +120, mood: +2, stress: -2, hidden: { stability: +1 }, note: "被照顾的感觉很稳。" } },
        { text: "拒绝（逞强）", effects: { mood: -1, stress: +1, termGradeBonus: +1, hidden: { stability: +1 }, note: "靠自己更自律一点。" } },
      ],
    },
    {
      id: "F_HIGH_CONSUME",
      title: "高消费诱惑",
      text: "你刷到一个很想要的东西：贵，但真的很香。",
      weight: 5,
      tags: ["family", "money"],
      gates: [gate({ familyIn: ["mid", "rich"] })],
      options: [
        { text: "买！", effects: { money: -900, mood: +6, stress: -2, hidden: { stability: +0.5 }, note: "快乐可被消费。" } },
        { text: "忍住", effects: { mood: -1, stress: +1, termGradeBonus: +1, hidden: { stability: +2 }, note: "延迟满足+。" } },
      ],
    },
    {
      id: "F_DEBT_REMIND",
      title: "债务提醒",
      text: "你突然想起：你还欠同学钱。",
      weight: 4,
      tags: ["family"],
      gates: [gate({ flagsAny: ["debt"] })],
      options: [
        { text: "还一部分", effects: { money: -150, stress: -2, hidden: { stability: +1 }, note: "压力下降，但钱更紧了。" } },
        { text: "先拖着", effects: { stress: +3, mood: -1, hidden: { stability: -2 }, note: "社交压力上涨。" } },
      ],
    },

    // ==== 学院特色 ====
    {
      id: "A_STEM_DEBUG_HELL",
      title: "理工：Debug 地狱",
      text: "代码跑不通、实验不出结果、报告要交。",
      weight: 6,
      tags: ["academy", "study"],
      gates: [gate({ academyIn: ["理工"] })],
      options: [
        { text: "通宵硬刚", effects: { energy: -18, stress: +14, mood: -2, termGradeBonus: +1, hidden: { academicPower: +1.0 }, note: "能推进，但很伤。" } },
        { text: "找同学/助教", effects: { stress: +3, mood: +1, termGradeBonus: +2, hidden: { stability: +1 }, note: "社交解决技术债。" } },
      ],
    },
    {
      id: "A_MED_WARD",
      title: "医学：见习精神打击",
      text: "带教老师语速像机关枪，问题像机关炮。",
      weight: 6,
      tags: ["academy", "study"],
      gates: [gate({ academyIn: ["医", "医学"] })],
      options: [
        { text: "回去狠狠干背", effects: { energy: -12, stress: +12, termGradeBonus: +3, hidden: { academicPower: +1.2 }, note: "医学生压力天花板。" } },
        { text: "先缓一缓", effects: { stress: -6, mood: +2, termGradeBonus: +1, hidden: { stability: +1 }, note: "不崩比猛进更重要。" } },
      ],
    },
    {
      id: "A_BIZ_CASE",
      title: "商科：Case 突然加码",
      text: "老师：下周展示。你：啊？（还要分组）",
      weight: 6,
      tags: ["academy"],
      gates: [gate({ academyIn: ["商科"] })],
      options: [
        { text: "组队冲", effects: { energy: -10, stress: +8, termGradeBonus: +2, hidden: { careerPower: +0.6 }, note: "练职场味。" } },
        { text: "摆烂当路人", effects: { mood: +1, stress: +4, termGradeBonus: -1, hidden: { stability: -1 }, note: "后续可能触发组内矛盾。" } },
      ],
    },
    {
      id: "A_ART_DEADLINE",
      title: "文社：论文 deadline 压顶",
      text: "你打开文档，标题还是“未命名1”。",
      weight: 6,
      tags: ["academy", "study"],
      gates: [gate({ academyIn: ["文社"] })],
      options: [
        { text: "开始写（先丑后美）", effects: { energy: -8, stress: +6, termGradeBonus: +3, hidden: { academicPower: +1.0 }, note: "最靠谱策略。" } },
        { text: "再等等（拖延）", effects: { mood: +1, stress: +6, termGradeBonus: -2, hidden: { stability: -1 }, note: "拖延税越来越贵。" } },
      ],
    },

    // ==== 路线事件 ====
    {
      id: "R_EXPERIMENT_FAIL",
      title: "科研线：实验翻车",
      text: "你以为稳了，结果关键一步翻车。",
      weight: 5,
      tags: ["route:research"],
      gates: [gate({ routeIn: ["research"], yearMin: 2 })],
      options: [
        { text: "重做（更稳）", effects: { energy: -10, stress: +8, termGradeBonus: -1, hidden: { academicPower: +0.6 }, note: "稳，但累。" } },
        { text: "硬写解释（赌审稿人）", effects: { stress: +5, termGradeBonus: -2, hidden: { luck: +0.6 }, note: "赌一把。" } },
      ],
    },
    {
      id: "C_RESUME",
      title: "就业线：简历更新",
      text: "学长说：赶紧更新简历，机会稍纵即逝。",
      weight: 5,
      tags: ["route:career"],
      gates: [gate({ routeIn: ["career"], yearMin: 2 })],
      options: [
        { text: "更新并投递", effects: { energy: -6, stress: +4, hidden: { careerPower: +1.0 }, note: "机会+。" } },
        { text: "下周再说", effects: { mood: +1, stress: +2, hidden: { careerPower: -0.3 }, note: "拖延会让机会减少。" } },
      ],
    },
    {
      id: "C_NETWORKING",
      title: "就业线：小型宣讲会",
      text: "你收到宣讲会邀请，看起来机会不错。",
      weight: 4,
      tags: ["route:career"],
      gates: [gate({ routeIn: ["career"], yearMin: 2, socialMin: 40 })],
      options: [
        { text: "去听听", effects: { energy: -4, stress: +2, social: +2, hidden: { careerPower: +0.6 }, note: "行业信息+。" } },
        { text: "不去", effects: { mood: +1, stress: +1, hidden: { stability: +1 }, note: "省事但错过信息。" } },
      ],
    },
    {
      id: "A_LANGUAGE_PARTNER",
      title: "出国线：语言搭子",
      text: "有人邀请你做口语搭子，一起练英语。",
      weight: 4,
      tags: ["route:abroad"],
      gates: [gate({ routeIn: ["abroad"], yearMin: 2 })],
      options: [
        { text: "一起练", effects: { energy: -4, stress: +1, termGradeBonus: +1, hidden: { careerPower: +0.4 }, note: "语言能力稳步提升。" } },
        { text: "先缓缓", effects: { mood: +1, stress: -1, hidden: { stability: +1 }, note: "缓一缓也可以。" } },
      ],
    },

    // ==== 考试周事件 ====
    {
      id: "E_FINAL_PANIC",
      title: "期末周：复习焦虑爆炸",
      text: "你突然意识到：快考试了。心跳像打鼓。",
      weight: 8,
      tags: ["exam"],
      gates: [gate({ weekMin: 14, weekMax: 16 })],
      options: [
        { text: "狠狠干复习", effects: { energy: -14, stress: +16, mood: -1, termGradeBonus: +4, hidden: { academicPower: +1.2 }, note: "冲刺收益高。" } },
        { text: "摆烂装死", effects: { mood: +1, stress: +10, energy: -6, termGradeBonus: -4, hidden: { stability: -2 }, note: "挂科风险暴涨。" } },
      ],
    },
    {
      id: "E_FINAL_MATERIALS",
      title: "期末周：资料之战",
      text: "同学发来一堆资料：你要不要全都看？",
      weight: 6,
      tags: ["exam"],
      gates: [gate({ weekMin: 13, weekMax: 16 })],
      options: [
        { text: "筛重点看", effects: { energy: -8, stress: +6, termGradeBonus: +3, hidden: { stability: +1 }, note: "效率拉满。" } },
        { text: "全看（爆肝）", effects: { energy: -14, stress: +10, termGradeBonus: +4, hidden: { academicPower: +1 }, note: "更强但更痛。" } },
      ],
    },

    // ==== 稀有事件 ====
    {
      id: "RARE_SCI_CHANCE",
      title: "稀有事件：SCI 机会出现",
      text: "你参与的项目突然有希望出文章。",
      weight: 1,
      tags: ["rare", "breakthrough"],
      gates: [gate({ routeIn: ["research"], yearMin: 2, socialMin: 55 })],
      options: [
        { text: "拼到最后（爆肝）", effects: { energy: -22, stress: +18, mood: -2, termGradeBonus: -2, hidden: { academicPower: +1.5, luck: +1 }, note: "科研大推进，但学习被挤压。" } },
        { text: "保命优先", effects: { stress: -6, mood: +1, termGradeBonus: +1, hidden: { stability: +2 }, note: "稳住更长久。" } },
      ],
    },
    {
      id: "RARE_OFFER_SEED",
      title: "稀有事件：内推机会",
      text: "你认识的人提了一嘴：他们那边最近缺人，可以帮你内推。",
      weight: 1,
      tags: ["rare", "breakthrough"],
      gates: [gate({ routeIn: ["career"], yearMin: 2, socialMin: 60 })],
      options: [
        { text: "马上投递", effects: { stress: +3, energy: -4, social: +2, hidden: { careerPower: +1.2, luck: +1 }, flags: { offerSeed: true }, note: "你抓住了机会。" } },
        { text: "先等等", effects: { mood: +1, hidden: { careerPower: -0.4 }, note: "机会也许会跑掉。" } },
      ],
    },
  ];

  window.EVENTS = EVENTS;
  window.eventMatchesState = eventMatchesState;
})();
