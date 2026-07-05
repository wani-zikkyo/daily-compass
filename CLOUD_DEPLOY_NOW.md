# 外出先スマホ利用のためのクラウド化手順

Status: 2026-07-05 にクラウド化を再開。

ローカルだけの設定では、外出先スマホ回線からこのアプリを直接開けません。外から使うには、公開URLを持つクラウド上で `serve.py` を動かします。

## 推奨ルート

Render の Web Service と Persistent Disk を使う。

理由:

- Web Service は `onrender.com` の公開URLを発行できる。
- `serve.py` は `0.0.0.0` と `PORT` 環境変数に対応済み。
- Persistent Disk に `app-state.json` を置くと、再起動や再デプロイで進捗が消えにくい。
- `DAILY_COMPASS_PASSWORD` を設定するとログイン画面で保護できる。

## Renderで設定する値

Build Command:

```text
pip install -r requirements.txt
```

Start Command:

```text
python serve.py --host 0.0.0.0
```

Health Check Path:

```text
/healthz
```

Persistent Disk:

```text
Mount path: /var/data
```

Environment Variables:

```text
DAILY_COMPASS_PASSWORD=自分だけが知っているログインパスワード
DAILY_COMPASS_SECRET=長いランダム文字列
DAILY_COMPASS_COOKIE_SECURE=1
DAILY_COMPASS_STATE_FILE=/var/data/app-state.json
DAILY_COMPASS_STATE_BACKUP_DIR=/var/data/state-backups
```

`DAILY_COMPASS_PASSWORD` を設定し忘れた場合、Render上ではアプリを使えないようにしています。公開URLでログインなしの状態にならないための安全ガードです。

## 初回データ移行

1. ローカル版の履歴画面で「エクスポート」を押す。
2. 出てきたJSONをコピーする。
3. クラウド版URLをスマホかPCで開き、ログインする。
4. 履歴画面のテキストエリアへ貼り付ける。
5. 「バックアップ取り込み」を押す。

この方法で、完了履歴、日付設定、追加クエスト、除外理由、クエスト調整、週クエスト調整、週次回答、Codexメモをマージする。

## 絶対に避けること

- `.env` をGitHubへ上げない。
- `app-state.json` を公開リポジトリへ上げない。
- Persistent Diskなしで本運用を始めない。
- ログインパスワードなしで公開URLを使わない。
- デプロイのために既存の進捗や調整データを初期化しない。

## 公開後の使い方

スマホでは Render が発行した `https://...onrender.com/` を開く。初回だけログインし、以降はブラウザにセッションCookieが残る。
