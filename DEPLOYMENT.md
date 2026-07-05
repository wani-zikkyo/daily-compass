# Daily Compass Cloud Deployment

個人用クラウド版として外出先から使うための配置メモです。公開URLにはなりますが、`DAILY_COMPASS_PASSWORD` を設定するとログイン画面で保護されます。

すぐに外出先スマホ利用へ進める場合は、先に `CLOUD_DEPLOY_NOW.md` を見てください。このファイルは詳細メモです。

## 先に必ずバックアップ

ローカルの最新状態は、以下を残してからクラウド化します。

- 履歴画面の「エクスポート」で作ったJSON
- `app-state.json`
- `backups/backup-...` フォルダ

今回の作業では `backups/backup-20260623-205009` を作成済みです。

## 推奨構成

- アプリ本体: このリポジトリ/フォルダの静的ファイル
- サーバー: `serve.py`
- 認証: `DAILY_COMPASS_PASSWORD`
- 保存先: `DAILY_COMPASS_STATE_FILE`
- 自動バックアップ先: `DAILY_COMPASS_STATE_BACKUP_DIR`

## 必須環境変数

```text
DAILY_COMPASS_PASSWORD=自分だけが知っているログインパスワード
DAILY_COMPASS_SECRET=長いランダム文字列
DAILY_COMPASS_COOKIE_SECURE=1
DAILY_COMPASS_STATE_FILE=/var/data/app-state.json
DAILY_COMPASS_STATE_BACKUP_DIR=/var/data/state-backups
```

`DAILY_COMPASS_PASSWORD_HASH` に `sha256:<hash>` を設定すると、平文パスワードの代わりにSHA-256ハッシュでも運用できます。

## Renderで動かす場合の例

1. GitHubの非公開リポジトリにこのフォルダを入れる
2. RenderでWeb Serviceを作成する
3. RuntimeはPythonを選ぶ
4. Start Commandは `python serve.py --host 0.0.0.0`
5. Persistent Diskを作り、マウント先を `/var/data` にする
6. 上記の環境変数を設定する
7. デプロイ後、発行されたURLを開いてログインする

Renderの通常ファイルシステムは再デプロイや再起動で消えるため、進捗保存にはPersistent Diskが必要です。Persistent Diskなしで動かすと、アプリは開けても `app-state.json` の変更が失われる可能性があります。

## 初回データ移行

クラウドURLはローカルURLと別の保存領域になるため、初回は次のどちらかでデータを移します。

### アプリ画面で移す

1. ローカル版の履歴画面で「エクスポート」を押す
2. 表示されたJSONをコピーする
3. クラウド版にログインする
4. 履歴画面のテキストエリアに貼り付ける
5. 「バックアップ取り込み」を押す

この方法は、完了履歴、予定変更、追加クエスト、除外理由、詳細調整、Codexメモをマージします。

### ファイルで移す

クラウドの永続ディスクへ直接置ける場合は、ローカルの `app-state.json` を `DAILY_COMPASS_STATE_FILE` の場所へ置きます。

## 守ること

- アプリ更新で `app-state.json` を消さない
- クラウドの永続ディスクを無効にしない
- コード変更とユーザーデータを混ぜない
- 大きな変更前は履歴エクスポートを取る
