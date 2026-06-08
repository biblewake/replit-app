export type SoundCategory = "bright" | "calm" | "classic" | "energetic" | "noisy";

export interface AlarmSound {
  id: string;
  label: string;
  category: SoundCategory;
  getSource: () => number;
}

export interface SoundCategoryMeta {
  id: SoundCategory;
  emoji: string;
  label: string;
}

export const SOUND_CATEGORIES: SoundCategoryMeta[] = [
  { id: "bright", emoji: "☀️", label: "Bright" },
  { id: "noisy", emoji: "🚨", label: "Noisy" },
  { id: "energetic", emoji: "⚡", label: "Energetic" },
  { id: "calm", emoji: "🌿", label: "Calm" },
  { id: "classic", emoji: "🎵", label: "Classic" },
];

export const ALARM_SOUNDS: AlarmSound[] = [
  { id: "bright_chirps", label: "Chirps", category: "bright", getSource: () => require("../assets/sounds/bright/chirps.mp3") },
  { id: "bright_jinglebells", label: "Jingle Bells", category: "bright", getSource: () => require("../assets/sounds/bright/jinglebells.mp3") },
  { id: "bright_miku", label: "Miku", category: "bright", getSource: () => require("../assets/sounds/bright/miku.mp3") },
  { id: "bright_morning_flower", label: "Morning Flower", category: "bright", getSource: () => require("../assets/sounds/bright/morning_flower.mp3") },
  { id: "bright_summer_breeze", label: "Summer Breeze", category: "bright", getSource: () => require("../assets/sounds/bright/summer_breeze.mp3") },
  { id: "bright_tropical", label: "Tropical", category: "bright", getSource: () => require("../assets/sounds/bright/tropical.mp3") },

  { id: "calm_aura", label: "Aura", category: "calm", getSource: () => require("../assets/sounds/calm/aura.mp3") },
  { id: "calm_daybreak", label: "Daybreak", category: "calm", getSource: () => require("../assets/sounds/calm/daybreak.mp3") },
  { id: "calm_early_riser", label: "Early Riser", category: "calm", getSource: () => require("../assets/sounds/calm/early_riser.mp3") },
  { id: "calm_earth_day", label: "Earth Day", category: "calm", getSource: () => require("../assets/sounds/calm/earth_day.mp3") },
  { id: "calm_just_relax", label: "Just Relax", category: "calm", getSource: () => require("../assets/sounds/calm/just_relax.mp3") },
  { id: "calm_melodic_bones", label: "Melodic Bones", category: "calm", getSource: () => require("../assets/sounds/calm/melodic_bones.mp3") },
  { id: "calm_morning_chirp", label: "Morning Chirp", category: "calm", getSource: () => require("../assets/sounds/calm/morning_chirp.mp3") },
  { id: "calm_slow_morning", label: "Slow Morning", category: "calm", getSource: () => require("../assets/sounds/calm/slow_morning.mp3") },

  { id: "classic_average_joe", label: "Average Joe", category: "classic", getSource: () => require("../assets/sounds/classic/average_joe.mp3") },
  { id: "classic_baby_giggles", label: "Baby Giggles", category: "classic", getSource: () => require("../assets/sounds/classic/baby_giggles.mp3") },
  { id: "classic_casino_payout", label: "Casino Payout", category: "classic", getSource: () => require("../assets/sounds/classic/casino_payout.mp3") },
  { id: "classic_dog", label: "Dog", category: "classic", getSource: () => require("../assets/sounds/classic/dog.mp3") },
  { id: "classic_jazz", label: "Jazz", category: "classic", getSource: () => require("../assets/sounds/classic/jazz.mp3") },
  { id: "classic_rooster", label: "Rooster", category: "classic", getSource: () => require("../assets/sounds/classic/rooster.mp3") },
  { id: "classic_sunset", label: "Sunset", category: "classic", getSource: () => require("../assets/sounds/classic/sunset.mp3") },

  { id: "energetic_cloudy_day", label: "Cloudy Day", category: "energetic", getSource: () => require("../assets/sounds/energetic/cloudy_day.mp3") },
  { id: "energetic_coffee_and_tea", label: "Coffee & Tea", category: "energetic", getSource: () => require("../assets/sounds/energetic/coffee_and_tea.mp3") },
  { id: "energetic_electric", label: "Electric", category: "energetic", getSource: () => require("../assets/sounds/energetic/electric.mp3") },
  { id: "energetic_formation", label: "Formation", category: "energetic", getSource: () => require("../assets/sounds/energetic/formation.mp3") },
  { id: "energetic_mushrooms", label: "Mushrooms", category: "energetic", getSource: () => require("../assets/sounds/energetic/mushrooms.mp3") },
  { id: "energetic_pop_it_up", label: "Pop It Up", category: "energetic", getSource: () => require("../assets/sounds/energetic/pop_it_up.mp3") },
  { id: "energetic_retro_man", label: "Retro Man", category: "energetic", getSource: () => require("../assets/sounds/energetic/retro_man.mp3") },
  { id: "energetic_tech_house", label: "Tech House", category: "energetic", getSource: () => require("../assets/sounds/energetic/tech_house.mp3") },

  { id: "noisy_beep_beep", label: "Beep Beep", category: "noisy", getSource: () => require("../assets/sounds/noisy/beep_beep.mp3") },
  { id: "noisy_facility", label: "Facility", category: "noisy", getSource: () => require("../assets/sounds/noisy/facility.mp3") },
  { id: "noisy_fire_fire", label: "Fire Fire", category: "noisy", getSource: () => require("../assets/sounds/noisy/fire_fire.mp3") },
  { id: "noisy_payout_day", label: "Payout Day", category: "noisy", getSource: () => require("../assets/sounds/noisy/payout_day.mp3") },
  { id: "noisy_radiate", label: "Radiate", category: "noisy", getSource: () => require("../assets/sounds/noisy/radiate.mp3") },
  { id: "noisy_siren", label: "Siren", category: "noisy", getSource: () => require("../assets/sounds/noisy/siren.mp3") },
  { id: "noisy_toy_soldier", label: "Toy Soldier", category: "noisy", getSource: () => require("../assets/sounds/noisy/toy_soldier.mp3") },
];

export function getSoundById(id: string): AlarmSound | undefined {
  return ALARM_SOUNDS.find((s) => s.id === id);
}

export function getSoundsByCategory(category: SoundCategory): AlarmSound[] {
  return ALARM_SOUNDS.filter((s) => s.category === category);
}
