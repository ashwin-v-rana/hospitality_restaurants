import { redirect } from "next/navigation";
import { getRestaurantScope } from "@/lib/selected-restaurant";
import { getCurrentAgent } from "@/lib/agent";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy.ts already verified a valid session to reach here. getCurrentAgent
  // re-checks the DB, so a deactivated/removed agent (valid JWT, but no longer
  // allowed) returns null — bounce them through the cookie-clearing route.
  const agent = await getCurrentAgent();
  if (!agent) redirect("/auth/signout?reason=inactive");

  const { restaurants, selected } = await getRestaurantScope();

  return (
    <div className="flex min-h-dvh">
      <Sidebar isAdmin={agent.role === "admin"} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          agent={{ full_name: agent.full_name, role: agent.role }}
          restaurants={restaurants}
          selectedId={selected?.id ?? null}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6">
          {restaurants.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No restaurants assigned</p>
              <p className="mt-1 text-sm">
                Your account isn&apos;t linked to any restaurant yet. Ask an admin
                to assign you on the Agents page.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
