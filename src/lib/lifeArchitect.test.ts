import { describe, it, expect } from "vitest";
import {
  WIZARD_QUESTIONS,
  generateDeterministicBlueprint,
  type UserAnswers,
} from "./lifeArchitect";

describe("Life Architect Core Engine", () => {
  it("has valid questions with scientific insights", () => {
    expect(WIZARD_QUESTIONS.length).toBeGreaterThanOrEqual(4);
    WIZARD_QUESTIONS.forEach((q) => {
      expect(q.titleFa).toBeTruthy();
      expect(q.scientificInsightFa).toBeTruthy();
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("generates deterministic blueprint for a freelancer with procrastination", () => {
    const answers: UserAnswers = {
      role: "freelancer",
      obstacle: "procrastination",
      domains: ["career", "health", "finance"],
      chronotype: "morning",
      customGoals: "راه‌اندازی محصول دیجیتال جدید",
    };

    const bp = generateDeterministicBlueprint(answers);

    expect(bp.title).toContain("فریلنسر");
    expect(bp.folders.length).toBe(3);
    expect(bp.goals.length).toBe(3);

    // Check procrastination habit
    const procHabit = bp.habits.find((h) => h.name.includes("۲ دقیقه"));
    expect(procHabit).toBeDefined();

    // Check morning chronotype MIT habit
    const mitHabit = bp.habits.find((h) => h.name.includes("MIT"));
    expect(mitHabit).toBeDefined();
    expect(mitHabit?.reminder_time).toBe("07:30");

    // Check custom goal task
    const customTask = bp.tasks.find((t) => t.title.includes("محصول دیجیتال جدید"));
    expect(customTask).toBeDefined();
  });

  it("adjusts habits for distraction and night chronotype", () => {
    const answers: UserAnswers = {
      role: "student",
      obstacle: "distraction",
      domains: ["growth", "health"],
      chronotype: "night",
    };

    const bp = generateDeterministicBlueprint(answers);

    // Distraction habit should be Pomodoro
    const pomodoroHabit = bp.habits.find((h) => h.name.includes("پومودورو"));
    expect(pomodoroHabit).toBeDefined();

    // Night chronotype MIT habit reminder time should be later
    const mitHabit = bp.habits.find((h) => h.name.includes("MIT"));
    expect(mitHabit?.reminder_time).toBe("11:00");
  });
});
