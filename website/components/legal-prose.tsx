export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <div className="space-y-3 text-base leading-7 text-slate-400">{children}</div>
    </section>
  );
}

export function LegalPageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-8 text-base leading-7 text-slate-400">
      {children}
    </div>
  );
}
