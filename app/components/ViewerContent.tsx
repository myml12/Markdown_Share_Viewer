'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

// markedの設定
marked.setOptions({
  breaks: true,
  gfm: true,
});

// カスタムレンダラーでハイライトを設定
const renderer = new marked.Renderer();
renderer.code = function (code: string, language: string | undefined) {
  if (language && hljs.getLanguage(language)) {
    try {
      const highlighted = hljs.highlight(code, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    } catch (err) {
      console.error('Highlight error:', err);
    }
  }
  const highlighted = hljs.highlightAuto(code).value;
  return `<pre><code class="hljs">${highlighted}</code></pre>`;
};
marked.use({ renderer });

// Gist URL/IDからRaw URLを取得する関数
function getGistRawUrl(gistInput: string): string | null {
  try {
    // 完全なGist URLの場合
    if (gistInput.includes('gist.github.com')) {
      const match = gistInput.match(/gist\.github\.com\/([^\/]+)\/([a-f0-9]+)/);
      if (match) {
        const [, username, gistId] = match;
        return `https://gist.githubusercontent.com/${username}/${gistId}/raw/`;
      }
    }
    
    if (/^[a-f0-9]+$/i.test(gistInput)) {
      return `https://gist.githubusercontent.com/anonymous/${gistInput}/raw/`;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Gist URL:', error);
    return null;
  }
}

// Gist APIを使ってファイル一覧とメタデータを取得
async function getGistFiles(gistId: string): Promise<{ 
  files: { filename: string; raw_url: string }[];
  description: string;
  owner: string;
}> {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch Gist');
    }
    const data = await response.json();
    const files = Object.values(data.files as Record<string, { filename: string; raw_url: string }>);
    return {
      files: files.map(file => ({
        filename: file.filename,
        raw_url: file.raw_url,
      })),
      description: data.description || '',
      owner: data.owner?.login || 'unknown',
    };
  } catch (error) {
    console.error('Error fetching Gist files:', error);
    return { files: [], description: '', owner: 'unknown' };
  }
}

export default function ViewerContent() {
  const searchParams = useSearchParams();
  const [markdownHtml, setMarkdownHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [gistInput, setGistInput] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // 共有モードかどうかを判定
  const isShareMode = searchParams.get('view') === 'share' || searchParams.get('share') === 'true';

  useEffect(() => {
    const gistParam = searchParams.get('gist') || searchParams.get('gistId');
    if (gistParam) {
      setGistInput(gistParam);
      loadGist(gistParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadGist = async (input: string) => {
    setLoading(true);
    setError(null);
    
    try {
      let rawUrl: string | null = null;
      let gistId: string | null = null;

      // Gist URLまたはIDを解析
      if (input.includes('gist.github.com')) {
        const match = input.match(/gist\.github\.com\/([^\/]+)\/([a-f0-9]+)/);
        if (match) {
          gistId = match[2];
        }
      } else if (/^[a-f0-9]+$/i.test(input)) {
        gistId = input;
      }

      // Gist IDが取得できた場合は、API経由でファイル一覧を取得
      if (gistId) {
        const gistData = await getGistFiles(gistId);
        if (gistData.files.length === 0) {
          throw new Error('Gistが見つかりませんでした');
        }

        // Markdownファイルを優先的に探す
        const mdFile = gistData.files.find(f => f.filename.endsWith('.md') || f.filename.endsWith('.markdown'));
        if (mdFile) {
          rawUrl = mdFile.raw_url;
        } else {
          // Markdownファイルがない場合は最初のファイルを使用
          rawUrl = gistData.files[0].raw_url;
        }
      } else {
        // フォールバック: 直接Raw URLを構築
        rawUrl = getGistRawUrl(input);
        if (!rawUrl) {
          throw new Error('Gist URLまたはIDが無効です');
        }
      }

      if (!rawUrl) {
        throw new Error('GistのRaw URLを取得できませんでした');
      }

      // Rawファイルを取得
      const response = await fetch(rawUrl);
      if (!response.ok) {
        throw new Error('Markdownファイルの取得に失敗しました');
      }
      
      const markdown = await response.text();
      
      // MarkdownをHTMLに変換
      const html = await marked.parse(markdown);
      
      // XSS対策: DOMPurifyでサニタイズ
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'div', 'span'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      });
      
      setMarkdownHtml(sanitizedHtml);
      
      // 共有用URLを生成（元の入力形式を保持、view=shareを追加）
      const currentUrl = window.location.origin + window.location.pathname;
      const shareUrlParam = input; // 元の入力形式をそのまま使用
      const generatedShareUrl = `${currentUrl}?gist=${encodeURIComponent(shareUrlParam)}&view=share`;
      setShareUrl(generatedShareUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setMarkdownHtml('');
      setShareUrl('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gistInput.trim()) {
      loadGist(gistInput.trim());
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  // 共有モードの場合は、資料のみを表示
  if (isShareMode) {
    return (
      <div className="min-h-screen bg-white">
        {loading && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">読み込み中...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="max-w-3xl w-full p-6 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {markdownHtml && !loading && (
          <div
            className="markdown-content markdown-share-mode"
            dangerouslySetInnerHTML={{ __html: markdownHtml }}
          />
        )}
      </div>
    );
  }

  // 通常モード（編集画面）
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4 text-gray-900">
            Markdown Share Viewer
          </h1>
          <p className="text-gray-600 mb-4">
            GitHub GistのMarkdownを美しく表示します
          </p>
          
          <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
            <input
              type="text"
              value={gistInput}
              onChange={(e) => setGistInput(e.target.value)}
              placeholder="Gist URLまたはIDを入力 (例: https://gist.github.com/username/abc123 または abc123)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '読み込み中...' : '表示'}
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">読み込み中...</p>
          </div>
        )}

        {shareUrl && !loading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700 mb-2">共有用リンク:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    {copied ? 'コピー済み!' : 'コピー'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {markdownHtml && !loading && (
          <div
            className="markdown-content prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: markdownHtml }}
          />
        )}

        {!markdownHtml && !loading && !error && (
          <div className="text-center py-12 text-gray-500">
            <p>Gist URLまたはIDを入力してMarkdownを表示してください</p>
            <p className="mt-2 text-sm">
              例: <code className="bg-gray-100 px-2 py-1 rounded">?gist=https://gist.github.com/username/abc123</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

