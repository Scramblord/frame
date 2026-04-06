import Navbar from "@/components/Navbar";

export default function ExpertConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />
      {children}
    </div>
  );
}
