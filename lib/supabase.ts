import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase 환경 변수(.env.local)가 세팅되지 않았습니다.");
}

// Next.js 전역에서 호출하여 사용할 실제 DB 커넥션 객체
export const supabase = createClient(supabaseUrl, supabaseAnonKey);