import GachaClient from "./GachaClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function GachaPage({ searchParams }: PageProps) {
  const raw = searchParams?.tagId;
  const tagId = Array.isArray(raw) ? raw[0] : raw;

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="px-6 pt-6">
        <div className="aero-glass inline-flex items-center gap-2 rounded-2xl px-4 py-2">
          <span className="aero-subtle text-sm">현재 tagId</span>
          <span className="font-mono text-sm text-white/95">
            {tagId ?? "(none)"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <GachaClient tagId={tagId} />
      </div>
    </div>
  );
}

