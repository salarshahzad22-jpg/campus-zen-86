import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type CurrentProfile = {
  id: string;
  email: string;
  full_name: string;
  university: string;
  department: string;
  semester: string;
  phone: string;
  bio: string;
  avatar_path: string;
  avatarUrl: string;
  emailVerified: boolean;
};

/** Resolve a stored avatar value (storage path or absolute URL) to a displayable URL. */
export async function resolveAvatarUrl(value: string | null | undefined): Promise<string> {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(value, 60 * 60);
  return data?.signedUrl ?? "";
}

export function useProfile() {
  return useQuery({
    queryKey: ["current-profile"],
    queryFn: async (): Promise<CurrentProfile | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, university, department, semester, avatar_url, phone, bio")
        .eq("id", u.user.id)
        .maybeSingle();

      return {
        id: u.user.id,
        email: u.user.email ?? "",
        emailVerified: Boolean(u.user.email_confirmed_at),
        full_name: p?.full_name ?? "",
        university: p?.university ?? "",
        department: p?.department ?? "",
        semester: p?.semester ?? "",
        phone: p?.phone ?? "",
        bio: p?.bio ?? "",
        avatar_path: p?.avatar_url ?? "",
        avatarUrl: await resolveAvatarUrl(p?.avatar_url),
      };
    },
    staleTime: 60_000,
  });
}

export function useMyRoles() {
  return useQuery({
    queryKey: ["my-roles"],
    queryFn: async (): Promise<AppRole[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return (data ?? []).map((r) => r.role);
    },
    staleTime: 5 * 60_000,
  });
}

export function useIsAdmin() {
  const { data, isLoading } = useMyRoles();
  return { isAdmin: (data ?? []).includes("admin"), isLoading };
}

export function initialsFrom(name: string, email: string) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function firstNameFrom(name: string, email: string) {
  if (name.trim()) return name.trim().split(/\s+/)[0];
  return email.split("@")[0] || "there";
}
