import GachaClient from "./GachaClient";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Next.js 15+ 사양에 맞춰 async 함수로 전면 수정
export default async function GachaPage({ searchParams }: PageProps) {
  // Promise 구조인 searchParams를 await로 해제(Unwrap)
  const resolvedSearchParams = await searchParams;
  const raw = resolvedSearchParams?.tagId;
  
  const tagId = Array.isArray(raw) ? raw[0] : raw;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-[#1a365d] to-[#0a192f]">
      <GachaClient tagId={tagId} />
    </main>
  );
}