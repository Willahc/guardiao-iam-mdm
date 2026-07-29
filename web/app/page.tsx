import { requireChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const admin = await requireChatGPTUser("/");
  return <Dashboard admin={{ displayName: admin.displayName, email: admin.email }} />;
}
