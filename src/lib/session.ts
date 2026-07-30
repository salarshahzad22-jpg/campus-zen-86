import { supabase } from "@/integrations/supabase/client";

const REMEMBER_KEY = "cz_remember_me";
const TAB_KEY = "cz_tab_session";

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "on" : "off");
  sessionStorage.setItem(TAB_KEY, "1");
}

export function isRememberMe() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(REMEMBER_KEY) !== "off";
}

/**
 * When "Remember me" is off, the session should not survive closing the browser.
 * sessionStorage survives reloads but not a closed tab/browser, so a missing
 * marker means this is a brand new browsing session — sign the user out.
 */
export async function enforceSessionPolicy() {
  if (typeof window === "undefined") return;
  if (isRememberMe()) return;
  if (sessionStorage.getItem(TAB_KEY) === "1") return;
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.auth.signOut();
}
