export function InlineNotice({
  tone,
  copy,
}: {
  tone: "muted" | "error";
  copy: string;
}) {
  return (
    <div
      className={`rounded-[13px] border px-4 py-3 text-sm leading-6 ${
        tone === "error"
          ? "border-rose-300/[0.16] bg-rose-400/[0.07] text-rose-300"
          : "border-white/[0.06] bg-white/[0.025] text-white/40"
      }`}
    >
      {copy}
    </div>
  );
}
