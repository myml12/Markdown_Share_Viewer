import { Suspense } from 'react';
import type { Metadata } from 'next';
import ViewerContent from './components/ViewerContent';

// Gist APIからメタデータを取得する関数
async function getGistMetadata(gistId: string): Promise<{ title: string; description: string }> {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      next: { revalidate: 3600 }, // 1時間キャッシュ
    });
    if (!response.ok) {
      return { title: 'Markdown Share Viewer', description: 'GitHub GistのMarkdownを美しく表示するビューアー' };
    }
    const data = await response.json();
    const files = Object.values(data.files as Record<string, { filename: string }>);
    const mdFile = files.find((f: { filename: string }) => f.filename.endsWith('.md') || f.filename.endsWith('.markdown'));

    const title = data.description || mdFile?.filename || files[0]?.filename || 'Markdown Document';
    const description = data.description || `${title} - GitHub GistのMarkdown資料`;

    return { title, description };
  } catch (error) {
    console.error('Error fetching Gist metadata:', error);
    return { title: 'Markdown Share Viewer', description: 'GitHub GistのMarkdownを美しく表示するビューアー' };
  }
}

// Gist IDを抽出する関数
function extractGistId(gistParam: string | null): string | null {
  if (!gistParam) return null;

  if (gistParam.includes('gist.github.com')) {
    const match = gistParam.match(/gist\.github\.com\/([^\/]+)\/([a-f0-9]+)/);
    if (match) {
      return match[2];
    }
  } else if (/^[a-f0-9]+$/i.test(gistParam)) {
    return gistParam;
  }

  return null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { gist?: string; gistId?: string; view?: string; share?: string };
}): Promise<Metadata> {
  const gistParam = searchParams.gist || searchParams.gistId;
  const isShareMode = searchParams.view === 'share' || searchParams.share === 'true';

  // 共有モードでGistが指定されている場合のみ、メタデータを動的に生成
  if (isShareMode && gistParam) {
    const gistId = extractGistId(gistParam);
    if (gistId) {
      const metadata = await getGistMetadata(gistId);
      const currentUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com';
      const shareUrl = `${currentUrl}?gist=${encodeURIComponent(gistParam)}&view=share`;

      return {
        title: metadata.title,
        description: metadata.description,
        openGraph: {
          title: metadata.title,
          description: metadata.description,
          url: shareUrl,
          type: 'website',
        },
        twitter: {
          card: 'summary',
          title: metadata.title,
          description: metadata.description,
        },
      };
    }
  }

  // デフォルトのメタデータ
  return {
    title: 'Markdown Share Viewer',
    description: 'GitHub GistのMarkdownを美しく表示するビューアー',
  };
}

export default function Home({
  searchParams,
}: {
  searchParams: { gist?: string; gistId?: string; view?: string; share?: string };
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}
