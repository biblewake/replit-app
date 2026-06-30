import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

async function fetchActiveBackgroundImageUrl(): Promise<string | null> {
  const { data } = await supabase
    .from("verse_background_images")
    .select("url")
    .eq("is_active", true)
    .limit(1)
    .single();
  return data?.url ?? null;
}

export function useActiveVerseBackground() {
  return useQuery({
    queryKey: ["activeVerseBackground"],
    queryFn: fetchActiveBackgroundImageUrl,
    staleTime: 1000 * 60 * 10,
  });
}
