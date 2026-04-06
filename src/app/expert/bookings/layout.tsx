import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import Navbar from "@/components/Navbar";

export default function ExpertBookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />
      <ActiveSessionBanner />
      {children}
    </div>
  );
}
