import Navbar from "@/components/Navbar";

export default function ExpertSetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="relative z-50">
        <Navbar />
      </div>
      <div className="relative z-0">{children}</div>
    </div>
  );
}
