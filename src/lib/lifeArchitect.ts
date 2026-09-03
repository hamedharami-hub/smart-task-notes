import { supabase } from "@/integrations/supabase/client";
import { callAI } from "@/lib/ai";
import { generateUUID, type GoalKanban, type TimeHorizon, type GoalPriority } from "@/lib/kanbanGoals";

export type RoleArchetype =
  | "freelancer"
  | "corporate"
  | "student"
  | "creator"
  | "homemaker"
  | "transition"
  | "balanced";

export type LifeObstacle =
  | "procrastination"
  | "overwhelm"
  | "distraction"
  | "consistency"
  | "work_life_balance";

export type LifeDomainKey =
  | "career"
  | "health"
  | "mind"
  | "growth"
  | "finance"
  | "relationships";

export type Chronotype = "morning" | "afternoon" | "night" | "flexible";

export interface UserAnswers {
  role: RoleArchetype;
  obstacle: LifeObstacle;
  domains: LifeDomainKey[];
  chronotype: Chronotype;
  customGoals?: string;
  isAuditMode?: boolean;
}

export interface PlannedFolder {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description: string;
}

export interface PlannedGoal {
  id: string;
  folderId: string;
  title: string;
  description?: string;
  timeHorizon: TimeHorizon;
  priority: GoalPriority;
  color?: string;
  icon?: string;
  parentId?: string | null;
}

export interface PlannedHabit {
  name: string;
  description?: string;
  frequency: "daily" | "weekly";
  target_days?: number[];
  reminder_time?: string;
  icon?: string;
  color?: string;
}

export interface PlannedTask {
  title: string;
  description?: string;
  folderId?: string;
  kanbanColumnId?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  dueDaysOffset?: number;
}

export interface LifeBlueprint {
  title: string;
  summary: string;
  scientificInsight: string;
  folders: PlannedFolder[];
  goals: PlannedGoal[];
  habits: PlannedHabit[];
  tasks: PlannedTask[];
  recommendedWorkflow: "kanban" | "list" | "time-blocking";
}

export interface SystemAuditResult {
  totalTasks: number;
  totalFolders: number;
  totalHabits: number;
  wheelBalance: Record<LifeDomainKey, number>;
  healthScore: number;
  strengths: string[];
  gaps: string[];
  recommendations: {
    addFolders: PlannedFolder[];
    addHabits: PlannedHabit[];
    addGoals: PlannedGoal[];
    tips: string[];
  };
}

export interface WizardQuestion {
  id: keyof UserAnswers;
  titleFa: string;
  subtitleFa: string;
  scientificInsightFa: string;
  isMultiSelect?: boolean;
  options: {
    value: string;
    labelFa: string;
    icon: string;
    badge?: string;
    descFa: string;
  }[];
}

export const WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    id: "role",
    titleFa: "نقش و سبک زندگی اصلی شما در این روزها چیست؟",
    subtitleFa: "این بخش اسکلت‌بندی اولیه پوشه‌ها و افق زمانی شما را تعیین می‌کند.",
    scientificInsightFa:
      "تحقیقات دانشگاه استنفورد نشان می‌دهد تطابق ساختار وظایف با نقش حرفه‌ای، خستگی تصمیم‌گیری (Decision Fatigue) را تا ۴۰٪ کاهش می‌دهد.",
    options: [
      {
        value: "freelancer",
        labelFa: "کارآفرین / فریلنسر / سولوپرنور",
        icon: "🚀",
        badge: "پروژه‌محور",
        descFa: "مدیریت مشتریان، درآمدهای چندگانه و نیاز به انضباط فردی مستقل",
      },
      {
        value: "corporate",
        labelFa: "کارمند / مدیر / متخصص تیمی",
        icon: "🏢",
        badge: "جلسات و خروجی",
        descFa: "وظایف مشارکتی، گزارش‌دهی هفتگی، اهداف فصلی و تعادل کار و زندگی",
      },
      {
        value: "student",
        labelFa: "دانشجو / پژوهشگر / داوطلب آزمون",
        icon: "🎓",
        badge: "مطالعه و ددلاین",
        descFa: "امتحانات، یادگیری متمرکز، خلاصه برداری و زمان‌بندی مرور دروس",
      },
      {
        value: "creator",
        labelFa: "تولیدکننده محتوا / طراح / نویسنده",
        icon: "🎨",
        badge: "فرآیند خلاقانه",
        descFa: "ایده‌پردازی، پایپ‌لاین تولید، ویرایش، انتشار و انضباط خلاق",
      },
      {
        value: "homemaker",
        labelFa: "مدیر خانه و خانواده",
        icon: "🏠",
        badge: "نظم محیط و روابط",
        descFa: "امور خانه، خریدها، بودجه خانواده، سلامت اعضا و برنامه‌های روزمره",
      },
      {
        value: "transition",
        labelFa: "در دوران تغییر مسیر یا بازآفرینی زندگی",
        icon: "🔄",
        badge: "هدف‌گذاری نو",
        descFa: "کشف فرصت‌های تازه، ساخت عادت‌های جدید و بازسازی اولویت‌ها",
      },
      {
        value: "balanced",
        labelFa: "تمرکز بر توسعه فردی و سبک زندگی متعادل",
        icon: "🌱",
        badge: "رشد ۳۶۰ درجه",
        descFa: "ایجاد توازن جامع بین سلامتی، ذهن، مطالعه، روابط و کارهای روزانه",
      },
    ],
  },
  {
    id: "obstacle",
    titleFa: "بزرگ‌ترین مانع ذهنی یا عملی شما در اجرای برنامه‌ها چیست؟",
    subtitleFa: "برای شکستن این مانع، ابزارهای روانشناختی مناسب در سیستم شما فعال می‌شوند.",
    scientificInsightFa:
      "بر اساس اصول روانشناسی شناختی-رفتاری (CBT)، موانع به دلیل نبود اراده نیستند، بلکه نتیجه اصطکاک بالا در نقطه شروع عمل هستند.",
    options: [
      {
        value: "procrastination",
        labelFa: "شروع کردن کارها (اهمال‌کاری و تنبلی)",
        icon: "⏳",
        badge: "راهکار: کپسول ۲ دقیقه‌ای",
        descFa: "سختی در شروع، عقب انداختن کارهای مهم و انتظار برای انگیزه",
      },
      {
        value: "overwhelm",
        labelFa: "حجم زیاد کارها و احساس سردرگمی (Overwhelm)",
        icon: "🤯",
        badge: "راهکار: متد GTD",
        descFa: "ندانستن اینکه اول باید چه کاری انجام شود و استرس لیست‌های طولانی",
      },
      {
        value: "distraction",
        labelFa: "پرت شدن مداوم حواس و پرش ذهن",
        icon: "🎯",
        badge: "راهکار: پومودورو بصری",
        descFa: "گوشی، شبکه‌های اجتماعی و دشواری در حفظ تمرکز عمیق پایدار",
      },
      {
        value: "consistency",
        labelFa: "حفظ پیوستگی بعد از چند روز اول",
        icon: "🏃‍♂️",
        badge: "راهکار: گیمیفیکیشن و باغ رشد",
        descFa: "شروع‌های طوفانی اما رها کردن برنامه‌ها بعد از چند روز یا چند هفته",
      },
      {
        value: "work_life_balance",
        labelFa: "غرق شدن در کار و فراموشی سلامت و خود",
        icon: "⚖️",
        badge: "راهکار: مرزبندی حوزه‌ها",
        descFa: "نداشتن وقت برای ورزش، خانواده، آرامش روان یا سرگرمی‌های فردی",
      },
    ],
  },
  {
    id: "domains",
    titleFa: "سه حوزه اصلی که در این فصل می‌خواهید بیشترین تمرکز را روی آن‌ها بگذارید کدامند؟",
    subtitleFa: "قانون طلایی تمرکز: حداکثر ۳ حوزه کلیدی را انتخاب کنید.",
    scientificInsightFa:
      "قانون تمرکز وارن بافت و اصل پارتو نشان می‌دهند تمرکز همزمان روی بیش از ۳ جبهه، احتمال تحقق همه آن‌ها را تا ۶۰٪ تضعیف می‌کند.",
    isMultiSelect: true,
    options: [
      {
        value: "career",
        labelFa: "شغل، کسب‌وکار و پروژه‌ها",
        icon: "💼",
        descFa: "پیشرفت کاری، درآمدزایی، تحویل به موقع پروژه‌ها و اعتبار شغلی",
      },
      {
        value: "health",
        labelFa: "سلامتی، ورزش و انرژی بدنی",
        icon: "🏃‍♂️",
        descFa: "تناسب اندام، خواب باکیفیت، تغذیه سالم و افزایش سطح نشاط روزانه",
      },
      {
        value: "mind",
        labelFa: "آرامش ذهن، کاهش استرس و سلامت روان",
        icon: "🧠",
        descFa: "چک‌این روزانه، ثبت افکار CBT، تنفس آرام‌بخش و خودآگاهی",
      },
      {
        value: "growth",
        labelFa: "یادگیری مهارت نو، مطالعه و رشد فردی",
        icon: "📚",
        descFa: "کتاب‌خوانی، زبان، دوره‌های آموزشی و ارتقای توانمندی‌های فکری",
      },
      {
        value: "finance",
        labelFa: "نظم مالی، بودجه‌بندی و پس‌انداز",
        icon: "💰",
        descFa: "پیگیری هزینه‌ها، کنترل خریدهای هیجانی و سرمایه‌گذاری",
      },
      {
        value: "relationships",
        labelFa: "روابط عاطفی، خانواده و دوستان",
        icon: "👨‍👩‍👧",
        descFa: "وقت باکیفیت با عزیزان، ابراز محبت و تقویت پیوندهای اجتماعی",
      },
    ],
  },
  {
    id: "chronotype",
    titleFa: "ساعت طلایی انرژی و اوج تمرکز شبانه‌روزی شما چه زمانی است؟",
    subtitleFa: "کارهای عمیق و عادت‌های کلیدی شما دقیقا در این بازه چیده می‌شوند.",
    scientificInsightFa:
      "کرونوبیولوژی اثبات می‌کند همگام‌سازی کارهای سنگین تحلیلی با اوج دمای بدن و ترشح دوپامین، کارایی مغز را تا دو برابر می‌کند.",
    options: [
      {
        value: "morning",
        labelFa: "سحرخیز و صبحگاهی (۶ تا ۱۱ صبح)",
        icon: "🌅",
        badge: "انرژی صبحگاهی",
        descFa: "بیشترین طراوت فکری قبل از شروع همهمه‌ی روز و شلوغی‌ها",
      },
      {
        value: "afternoon",
        labelFa: "اوج تمرکز بعدازظهر (۲ تا ۶ عصر)",
        icon: "🌆",
        badge: "انرژی میانه روز",
        descFa: "صبح‌ها صرف هماهنگی و کارهای سبک، بعدازظهر برای کارهای عمیق",
      },
      {
        value: "night",
        labelFa: "جغد شب و آرامش شبانه (۹ شب به بعد)",
        icon: "🌙",
        badge: "سکوت شبانه",
        descFa: "بیشترین قدرت خلاقیت و تمرکز زمانی که همه جا ساکت است",
      },
      {
        value: "flexible",
        labelFa: "شناور و وابسته به شرایط روزانه",
        icon: "⚡",
        badge: "انعطاف‌پذیر",
        descFa: "نیازمند سیستم منعطف بر اساس بلوک‌های ۲۵ دقیقه‌ای در طول روز",
      },
    ],
  },
];

export function generateDeterministicBlueprint(answers: UserAnswers): LifeBlueprint {
  const { role, obstacle, domains, chronotype, customGoals } = answers;

  const folders: PlannedFolder[] = [];
  const goals: PlannedGoal[] = [];
  const habits: PlannedHabit[] = [];
  const tasks: PlannedTask[] = [];

  const domainMeta: Record<LifeDomainKey, { name: string; color: string; icon: string; desc: string }> = {
    career: { name: "💼 کار و پروژه‌ها", color: "#3b82f6", icon: "💼", desc: "اهداف شغلی، وظایف درآمدزا و تحویل پروژه‌ها" },
    health: { name: "🏃 تندرستی و انرژی", color: "#10b981", icon: "🏃", desc: "ورزش، تغذیه، خواب و سلامتی پایدار" },
    mind: { name: "🧠 ذهن و آرامش", color: "#8b5cf6", icon: "🧠", desc: "خودشناسی، بازنگری افکار و مدیریت استرس" },
    growth: { name: "📚 یادگیری و مهارت", color: "#f59e0b", icon: "📚", desc: "کتاب‌ها، دوره‌ها و مهارت‌های جدید" },
    finance: { name: "💰 انضباط مالی", color: "#06b6d4", icon: "💰", desc: "بودجه‌بندی، پیگیری دخل و خرج و سرمایه‌گذاری" },
    relationships: { name: "👨‍👩‍👧 خانه و روابط", color: "#ec4899", icon: "👨‍👩‍👧", desc: "ارتباط با عزیزان، خانواده و امور منزل" },
  };

  const activeDomains = domains.length >= 2 ? domains : (["career", "health", "growth"] as LifeDomainKey[]);

  activeDomains.forEach((dom) => {
    const meta = domainMeta[dom];
    if (!meta) return;
    const folderId = generateUUID();
    folders.push({
      id: folderId,
      name: meta.name,
      color: meta.color,
      icon: meta.icon,
      description: meta.desc,
    });

    const rootGoalId = generateUUID();
    let goalTitle = `تمرکز فصلی: ${meta.name.replace(/^[^\s]+\s/, "")}`;
    if (dom === "career" && role === "freelancer") goalTitle = "توسعه مشتریان و تحویل بی‌نقص پروژه‌ها";
    else if (dom === "career" && role === "corporate") goalTitle = "دستیابی به اهداف فصلی تیم (OKRs)";
    else if (dom === "career" && role === "student") goalTitle = "معدل عالی و تسلط بر دروس کلیدی";
    else if (dom === "health") goalTitle = "پایداری روتین ورزشی و خواب ۷.۵ ساعته";
    else if (dom === "mind") goalTitle = "کاهش استرس روزانه و آرامش پایدار";
    else if (dom === "growth") goalTitle = "مطالعه ۳ کتاب و یادگیری ۱ مهارت اثرگذار";

    goals.push({
      id: rootGoalId,
      folderId,
      title: goalTitle,
      timeHorizon: "quarterly",
      priority: "high",
      color: meta.color,
      icon: meta.icon,
      parentId: null,
    });

    tasks.push({
      title: `طراحی گام‌های اجرایی ماه اول برای «${goalTitle}»`,
      description: "این هدف را به ۳ گام ملموس بشکن و زمان‌بندی کن.",
      folderId,
      kanbanColumnId: rootGoalId,
      priority: "medium",
      dueDaysOffset: 1,
    });
  });

  const morningTime = "07:30";
  const eveningTime = "21:30";

  habits.push({
    name: "بررسی برنامه و اولویت‌بندی ۳ تسک مهم روز (MIT)",
    description: "هر روز صبح قبل از چک کردن پیام‌ها، مهم‌ترین ۳ کار روز را مشخص کن.",
    frequency: "daily",
    reminder_time: chronotype === "night" ? "11:00" : morningTime,
    icon: "🎯",
    color: "#3b82f6",
  });

  if (obstacle === "procrastination") {
    habits.push({
      name: "شروع با قانون ۲ دقیقه (ضد اهمال‌کاری)",
      description: "سخت‌ترین کار را فقط برای ۲ دقیقه شروع کن، بعد تصمیم بگیر ادامه دهی یا نه.",
      frequency: "daily",
      reminder_time: "09:30",
      icon: "⚡",
      color: "#f59e0b",
    });
  } else if (obstacle === "overwhelm" || obstacle === "work_life_balance") {
    habits.push({
      name: "چک‌این روزانه و پاکسازی ذهن در پایان روز",
      description: "در برنامه یک Check-in ثبت کن و کارهای باز فردا را بنویس تا با خیال آسوده بخوابی.",
      frequency: "daily",
      reminder_time: eveningTime,
      icon: "🌙",
      color: "#8b5cf6",
    });
  } else if (obstacle === "distraction") {
    habits.push({
      name: "یک بلوک پومودورو ۲۵ دقیقه‌ای عمیق و بدون گوشی",
      description: "گوشی در حالت سایلنت، تایمر پومودورو روشن و تمرکز خالص روی ۱ وظیفه.",
      frequency: "daily",
      reminder_time: chronotype === "morning" ? "08:30" : "15:00",
      icon: "⏱️",
      color: "#ef4444",
    });
  } else {
    habits.push({
      name: "آبیاری باغچه و ثبت پیوستگی در پایان روز",
      description: "با تکمیل کارهای روزانه قطرات آب دریافت کن و باغچه‌ات را سرسبز نگه دار.",
      frequency: "daily",
      reminder_time: eveningTime,
      icon: "🌱",
      color: "#10b981",
    });
  }

  if (domains.includes("health")) {
    habits.push({
      name: "۲۰ دقیقه تحرک / پیاده‌روی / کشش بدنی",
      description: "فعالیت سبک برای رساندن اکسیژن به مغز و بازیابی سطح دوپامین.",
      frequency: "daily",
      reminder_time: "18:00",
      icon: "🏃",
      color: "#10b981",
    });
  }

  tasks.unshift({
    title: "آشنایی با سیستم جدید و مرتب کردن اینباکس ذهنی",
    description: "تمام کارهای معلق فعلی را در اینباکس بنویس تا خیالت راحت شود.",
    priority: "urgent",
    dueDaysOffset: 0,
  });

  if (customGoals && customGoals.trim()) {
    tasks.push({
      title: `اقدام اولیه برای هدف اختصاصی: ${customGoals.trim().slice(0, 50)}`,
      description: customGoals.trim(),
      priority: "high",
      dueDaysOffset: 2,
    });
  }

  const roleTitles: Record<RoleArchetype, string> = {
    freelancer: "معماری بهره‌وری فریلنسر و سولوپرنور",
    corporate: "سیستم مدیریت هدفمند کاری و سازمانی",
    student: "پایگاه یادگیری عمیق و موفقیت تحصیلی",
    creator: "سیستم جریان خلاقیت و تولید پیوسته",
    homemaker: "مدیریت آرامش‌بخش خانه و خانواده",
    transition: "طرح راهبردی تغییر مسیر و بازآفرینی فردی",
    balanced: "سیستم‌عامل جامع رشد متوازن و سلامت ۳۶۰ درجه",
  };

  return {
    title: roleTitles[role] || "نقشه اختصاصی معماری زندگی",
    summary: `این ساختار بر اساس سبک زیستی ${roleTitles[role]}، غلبه بر چالش «${obstacle}» و ساعت انرژی «${chronotype}» طراحی شده است.`,
    scientificInsight:
      "با پیاده‌سازی این سیستم، بخش پردازشگر جلوی مغز (Prefrontal Cortex) دیگر درگیر ذخیره‌سازی وظایف معلق نمی‌شود و تمام ظرفیت آن به تمرکز و اقدام عمیق اختصاص می‌یابد.",
    folders,
    goals,
    habits,
    tasks,
    recommendedWorkflow: role === "freelancer" || role === "creator" ? "kanban" : "list",
  };
}

export async function enhanceBlueprintWithAI(
  answers: UserAnswers,
  baseBlueprint: LifeBlueprint
): Promise<LifeBlueprint> {
  try {
    const prompt = `
نقش شما: مربی فوق‌العاده باهوش بهره‌وری، عصب‌شناس و روانشناس رفتاری است.
کاربر به پرسشنامه معماری زندگی پاسخ داده است:
- نقش زندگی: ${answers.role}
- مانع اصلی: ${answers.obstacle}
- حوزه‌های تمرکز: ${answers.domains.join(", ")}
- ریتم انرژی: ${answers.chronotype}
- دغدغه یا هدف اختصاصی: ${answers.customGoals || "ذکر نشده"}

ما یک نقشه اولیه قطعی داریم:
${JSON.stringify(baseBlueprint, null, 2)}

لطفاً این نقشه را تحلیل و شخصی‌سازی کن:
1. عناوین پوشه‌ها، اهداف و عادات را متناسب با زبان و لحن گرم، انگیزه‌بخش و عمیق فارسی صیقل بزن.
2. اگر کاربر هدف خاصی در "customGoals" نوشته، حتماً یک پوشه یا هدف بسیار ملموس و تسک هفته اول برای آن خلق کن.
3. یک بینش علمی-روانشناسی کوتاه، تکان‌دهنده و انگیزاننده برای شخص او بنویس.

خروجی باید صرفاً یک آبجکت JSON معتبر مطابق ساختار LifeBlueprint باشد (بدون مارک‌داون اضافی).
    `;

    const res = await callAI("chat" as any, prompt, undefined, undefined, "fa");
    if (!res) return baseBlueprint;

    let jsonStr = typeof res === "string" ? res : (res as any).text || "";
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.folders) && Array.isArray(parsed.habits)) {
      return {
        ...baseBlueprint,
        title: parsed.title || baseBlueprint.title,
        summary: parsed.summary || baseBlueprint.summary,
        scientificInsight: parsed.scientificInsight || baseBlueprint.scientificInsight,
        folders: parsed.folders.length > 0 ? parsed.folders : baseBlueprint.folders,
        goals: parsed.goals && parsed.goals.length > 0 ? parsed.goals : baseBlueprint.goals,
        habits: parsed.habits.length > 0 ? parsed.habits : baseBlueprint.habits,
        tasks: parsed.tasks && parsed.tasks.length > 0 ? parsed.tasks : baseBlueprint.tasks,
      };
    }
  } catch (err) {
    console.warn("AI enhancement skipped, using deterministic blueprint:", err);
  }
  return baseBlueprint;
}

export async function auditExistingSystem(userId: string): Promise<SystemAuditResult> {
  const [tasksRes, foldersRes, habitsRes] = await Promise.all([
    supabase.from("tasks").select("id,title,completed,folder_id,due_date,created_at").eq("user_id", userId),
    supabase.from("folders").select("id,name,color").eq("user_id", userId),
    supabase.from("habits").select("id,name,frequency").eq("user_id", userId),
  ]);

  const tasks = tasksRes.data || [];
  const folders = foldersRes.data || [];
  const habits = habitsRes.data || [];

  const totalTasks = tasks.length;
  const totalFolders = folders.length;
  const totalHabits = habits.length;

  const domainKeywords: Record<LifeDomainKey, string[]> = {
    career: ["کار", "پروژه", "جلسه", "کاری", "مشتری", "ارائه", "شغل", "work", "job", "project", "client"],
    health: ["ورزش", "باشگاه", "پیاده‌روی", "خواب", "دکتر", "سلامتی", "تغذیه", "gym", "health", "sleep"],
    mind: ["مراقبه", "تنفس", "مدیتیشن", "آرامش", "استرس", "فکر", "روان", "mind", "cbt", "mood"],
    growth: ["کتاب", "مطالعه", "آموزش", "زبان", "انگلیسی", "درس", "یادگیری", "book", "read", "study", "learn"],
    finance: ["پول", "خرید", "بانک", "قسط", "حساب", "مالی", "درآمد", "سرمایه", "money", "finance", "buy"],
    relationships: ["خانواده", "دوست", "مامان", "بابا", "همسر", "بچه", "تولد", "family", "friend", "home"],
  };

  const domainCounts: Record<LifeDomainKey, number> = {
    career: 0, health: 0, mind: 0, growth: 0, finance: 0, relationships: 0,
  };

  tasks.forEach((t) => {
    const text = (t.title || "").toLowerCase();
    Object.entries(domainKeywords).forEach(([dKey, kws]) => {
      if (kws.some((kw) => text.includes(kw))) {
        domainCounts[dKey as LifeDomainKey]++;
      }
    });
  });

  const maxCount = Math.max(...Object.values(domainCounts), 1);
  const wheelBalance: Record<LifeDomainKey, number> = {
    career: Math.round((domainCounts.career / maxCount) * 100),
    health: Math.round((domainCounts.health / maxCount) * 100),
    mind: Math.round((domainCounts.mind / maxCount) * 100),
    growth: Math.round((domainCounts.growth / maxCount) * 100),
    finance: Math.round((domainCounts.finance / maxCount) * 100),
    relationships: Math.round((domainCounts.relationships / maxCount) * 100),
  };

  const strengths: string[] = [];
  const gaps: string[] = [];
  const addFolders: PlannedFolder[] = [];
  const addHabits: PlannedHabit[] = [];
  const addGoals: PlannedGoal[] = [];
  const tips: string[] = [];

  let healthScore = 70;
  if (totalTasks > 5) healthScore += 10;
  if (totalFolders >= 3) healthScore += 10;
  if (totalHabits >= 2) healthScore += 10;

  const unfiledCount = tasks.filter((t) => !t.folder_id).length;
  if (unfiledCount > 8) {
    gaps.push(`${unfiledCount} تسک بدون پوشه در اینباکس داری که باعث خستگی ذهن می‌شود.`);
    tips.push("انتقال تسک‌های اینباکس به پوشه‌های معین، احساس کنترل و آرامش بالایی ایجاد می‌کند.");
    healthScore -= 10;
  } else {
    strengths.push("اینباکس خلوت و سازمان‌یافته با پوشه‌بندی مناسب.");
  }

  const existingFolderNames = folders.map((f) => f.name.toLowerCase());
  if (domainCounts.health === 0 && !existingFolderNames.some((n) => n.includes("ورزش") || n.includes("سلامت"))) {
    gaps.push("هیچ تسک یا پوشه‌ای برای تندرستی، ورزش و خواب ثبت نشده است.");
    addFolders.push({
      id: generateUUID(),
      name: "🏃 تندرستی و انرژی",
      color: "#10b981",
      icon: "🏃",
      description: "حفظ سوخت جسمی برای موفقیت در اهداف کاری",
    });
    addHabits.push({
      name: "۲۰ دقیقه پیاده‌روی یا ورزش سبک روزانه",
      frequency: "daily",
      reminder_time: "18:30",
      icon: "🏃",
      color: "#10b981",
    });
  }

  if (domainCounts.growth === 0 && !existingFolderNames.some((n) => n.includes("کتاب") || n.includes("یادگیری"))) {
    gaps.push("حوزه یادگیری مهارت و مطالعه در سیستم شما کمرنگ است.");
    addFolders.push({
      id: generateUUID(),
      name: "📚 یادگیری و مطالعه",
      color: "#f59e0b",
      icon: "📚",
      description: "کتاب‌خوانی و ارتقای مهارت‌های فردی",
    });
    addHabits.push({
      name: "۱۵ دقیقه مطالعه کتاب قبل از خواب",
      frequency: "daily",
      reminder_time: "22:00",
      icon: "📖",
      color: "#f59e0b",
    });
  }

  if (totalHabits === 0) {
    gaps.push("هنوز هیچ عادتی در بخش Habits فعال نکرده‌ای.");
    addHabits.push({
      name: "بررسی ۳ اولویت اصلی روز (MIT)",
      frequency: "daily",
      reminder_time: "08:00",
      icon: "🎯",
      color: "#3b82f6",
    });
  } else {
    strengths.push(`داری از سیستم عادات با ${totalHabits} عادت فعال استفاده می‌کنی.`);
  }

  healthScore = Math.max(30, Math.min(100, healthScore));

  return {
    totalTasks,
    totalFolders,
    totalHabits,
    wheelBalance,
    healthScore,
    strengths,
    gaps,
    recommendations: {
      addFolders,
      addHabits,
      addGoals,
      tips,
    },
  };
}

export async function deployLifeBlueprint(
  blueprint: LifeBlueprint,
  userId: string,
  selectedFolderIds?: Set<string>,
  selectedHabitNames?: Set<string>,
  selectedTaskTitles?: Set<string>
): Promise<{ foldersCount: number; habitsCount: number; tasksCount: number }> {
  let foldersCount = 0;
  let habitsCount = 0;
  let tasksCount = 0;

  const folderIdMap = new Map<string, string>();

  // 1. Insert Folders
  for (const f of blueprint.folders) {
    if (selectedFolderIds && !selectedFolderIds.has(f.id)) continue;
    const { data } = await supabase
      .from("folders")
      .insert({
        user_id: userId,
        name: f.name,
        color: f.color,
      })
      .select("id")
      .single();

    if (data) {
      folderIdMap.set(f.id, data.id);
      foldersCount++;
    }
  }

  // 2. Insert Kanban Goals
  for (const g of blueprint.goals) {
    const realFolderId = folderIdMap.get(g.folderId);
    if (!realFolderId) continue;
    const newGoal: GoalKanban = {
      id: generateUUID(),
      title: g.title,
      description: g.description,
      parentId: null,
      timeHorizon: g.timeHorizon,
      priority: g.priority,
      color: g.color || "#3b82f6",
      icon: g.icon || "🎯",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const storageKey = `arshnaz_kanban_goals_v3_${realFolderId}`;
    try {
      const raw = localStorage.getItem(storageKey);
      const existing: GoalKanban[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(storageKey, JSON.stringify([...existing, newGoal]));
    } catch {}
  }

  // 3. Insert Habits
  for (const h of blueprint.habits) {
    if (selectedHabitNames && !selectedHabitNames.has(h.name)) continue;
    const { error } = await supabase.from("habits").insert({
      user_id: userId,
      name: h.name,
      description: h.description || "",
      frequency: h.frequency || "daily",
      target_days: h.target_days || [0, 1, 2, 3, 4, 5, 6],
      reminder_time: h.reminder_time || null,
    } as any);
    if (!error) habitsCount++;
  }

  // 4. Insert Tasks
  for (const t of blueprint.tasks) {
    if (selectedTaskTitles && !selectedTaskTitles.has(t.title)) continue;
    const realFolderId = t.folderId ? folderIdMap.get(t.folderId) || null : null;
    const due = new Date();
    if (t.dueDaysOffset) due.setDate(due.getDate() + t.dueDaysOffset);

    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: t.title,
      description: t.description || "",
      folder_id: realFolderId,
      priority: t.priority || "medium",
      due_date: due.toISOString(),
    });
    if (!error) tasksCount++;
  }

  window.dispatchEvent(new Event("tasks-changed"));
  window.dispatchEvent(new Event("habits-changed"));
  window.dispatchEvent(new Event("folders-changed"));

  return { foldersCount, habitsCount, tasksCount };
}
