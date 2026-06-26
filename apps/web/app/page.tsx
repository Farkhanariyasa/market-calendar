import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CalendarDashboard from "@/components/CalendarDashboard";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900">
        <div className="p-8 bg-slate-800 rounded-2xl shadow-xl text-center border border-slate-700 max-w-md">
          <h1 className="text-3xl font-bold mb-4 text-white">Discord Calendar</h1>
          <p className="text-slate-400 mb-8">
            Manage your community events directly from this beautiful dashboard.
          </p>
          <a
            href="/api/auth/signin"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-blue-500/25"
          >
            Login with Discord
          </a>
        </div>
      </div>
    );
  }

  return <CalendarDashboard session={session} />;
}
