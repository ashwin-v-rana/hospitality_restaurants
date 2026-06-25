import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantScope } from "@/lib/selected-restaurant";
import { RestaurantSwitcher } from "@/components/RestaurantSwitcher";
import { MainNav } from "@/components/MainNav";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders: middleware already gates this, but never render the
  // shell without a user.
  if (!user) redirect("/login");

  const { restaurants, selected } = await getRestaurantScope();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center" aria-label="The Ned — Cecconi's home">
            <Image
              src="/thened-cecconis-logo.svg"
              alt="The Ned — Cecconi's"
              width={194}
              height={74}
              priority
              className="h-8 w-auto"
            />
          </Link>
          <MainNav />
          <div className="ml-auto flex items-center gap-3">
            <RestaurantSwitcher
              restaurants={restaurants}
              selectedId={selected?.id ?? null}
            />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {restaurants.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <p className="font-medium text-foreground">
              No restaurants assigned
            </p>
            <p className="mt-1 text-sm">
              Your account isn&apos;t linked to any restaurant yet. Ask an admin
              to add you in <code className="font-mono">agent_restaurants</code>.
            </p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
