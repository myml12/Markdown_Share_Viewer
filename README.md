# Markdown Share Viewer

GitHub GistのMarkdownファイルを美しく表示するWebアプリケーションです。

## 機能

- GitHub GistのURLまたはIDからMarkdownを取得して表示
- シンタックスハイライト対応
- XSS対策（DOMPurifyによるサニタイズ）
- ダークモード対応
- レスポンシブデザイン

## 使い方

### 開発環境で起動

```bash
# 依存関係のインストール
npm install

# 開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

### Gistを表示する方法

1. **URLクエリパラメータで指定**
   ```
   http://localhost:3000?gist=https://gist.github.com/username/abc123
   ```
   または
   ```
   http://localhost:3000?gistId=abc123
   ```

2. **フォームから入力**
   - ページ上部の入力欄にGist URLまたはIDを入力
   - 「表示」ボタンをクリック

## 技術スタック

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **marked.js** - Markdownパーサー
- **DOMPurify** - XSS対策
- **highlight.js** - シンタックスハイライト

## セキュリティ

- すべてのHTML出力はDOMPurifyでサニタイズされています
- 許可されたタグと属性のみが表示されます
- 外部リンクの安全性もチェックされます

## デプロイ

Vercelにデプロイする場合:

```bash
npm run build
```

その後、Vercelにプロジェクトをインポートするか、Vercel CLIを使用します。

## ライセンス

MIT

