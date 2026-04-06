import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import Navbar from "@/components/Navbar";

export default function BookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-zinc-100 to-zinc-200/90 dark:from-zinc-950 dark:to-zinc-900">
      <Navbar />
      <ActiveSessionBanner />
      {children}
    </div>
  );
}
