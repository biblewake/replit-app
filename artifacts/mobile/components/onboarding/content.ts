export interface QuestionDef {
  step: number;
  key: string;
  title: string;
  subtitle?: string;
  options: string[];
  numbered?: boolean;
}

export const QUESTIONS: QuestionDef[] = [
  {
    step: 1,
    key: "morning_person",
    title: "Do you consider yourself a morning person?",
    options: ["Yes", "No"],
  },
  {
    step: 2,
    key: "age_range",
    title: "What's your age range?",
    options: ["13-17", "18-24", "25-34", "45-54", "55+"],
  },
  {
    step: 3,
    key: "bed_obstacle",
    title: "What is your biggest obstacle to getting out of bed?",
    options: [
      "I scroll on my phone",
      "I hit snooze repeatedly",
      "I sleep through my alarms",
      "None of the above",
    ],
  },
  {
    step: 5,
    key: "alarm_count",
    title: "How many alarms do you usually set?",
    options: ["Just one", "2 or 3", "4 or more"],
  },
  {
    step: 6,
    key: "trust_first_alarm",
    title: "Do you trust yourself to wake up after the first alarm?",
    options: ["Yes, always", "Sometimes, it's a gamble", "No, never"],
  },
  {
    step: 7,
    key: "turn_off_sleep",
    title: "Do you ever turn off your alarm and go back to sleep?",
    options: [
      "Yes, it happens often",
      "Sometimes",
      "No, but I worry I might",
      "No, never",
    ],
  },
  {
    step: 9,
    key: "alarm_night_feeling",
    title: "How do you usually feel when you set your alarm at night?",
    options: [
      "Motivated and ready",
      "Anxious about sleep",
      "Defeated, I know I'll snooze",
      "Neutral",
    ],
  },
  {
    step: 10,
    key: "alarm_rings_thought",
    title: "When the alarm rings, what is your immediate thought?",
    options: [
      "I'm up!",
      "I'll get up after the next alarm",
      "Just 5 more minutes",
      "Why did I set this?",
    ],
  },
  {
    step: 11,
    key: "negotiate_bed",
    title: "Do you negotiate with yourself to stay in bed?",
    options: ["Yes, I make deals with myself", "No, I get right up"],
  },
  {
    step: 12,
    key: "verse_memory",
    title: "Which of these verses could you recite right now, from memory?",
    options: [
      "John 3:16",
      "Psalm 23:1",
      "Philippians 4:13",
      "Jeremiah 29:11",
      "Romans 8:28",
      "None of these",
    ],
  },
  {
    step: 14,
    key: "bible_translation",
    title: "Which Bible translation do you prefer?",
    options: ["KJV", "NIV", "ESV", "NKJV", "NLT", "Not sure"],
  },
  {
    step: 15,
    key: "verse_goal",
    title: "How many verses would you like to memorize this month?",
    numbered: true,
    options: [
      "4 verses",
      "8 verses",
      "12 verses",
      "I will follow Bible Wake's plan",
    ],
  },
];

export function getQuestion(step: number): QuestionDef | undefined {
  return QUESTIONS.find((q) => q.step === step);
}

export const SNOOZE_FALLING = [0.9, 0.82, 0.7, 0.55, 0.45, 0.32, 0.24, 0.16, 0.1, 0.06];
export const SNOOZE_RISING = [0.2, 0.28, 0.35, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.95];

export const FAITH_RISING = [0.15, 0.25, 0.3, 0.45, 0.55, 0.68, 0.78, 0.88, 0.93, 0.98];
export const FAITH_FLAT = [0.3, 0.26, 0.32, 0.28, 0.33, 0.27, 0.31, 0.26, 0.3, 0.27];
