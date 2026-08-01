import { skillList } from "@/lib/skills";

export const runtime = "nodejs";

// Публичный список навыков для раздела «Навыки» и шапки чата (без грунтовки).
export async function GET() {
  return Response.json({ skills: skillList() });
}
