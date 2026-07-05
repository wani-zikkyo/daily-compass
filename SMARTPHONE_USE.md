# Daily Compass Smartphone Use

外出先のスマホから使うための最短手順です。

## いま準備済みのもの

- ログイン保護つきサーバー
- 状態保存APIの保護
- `.env`、`app-state.json`、ログ、バックアップのURL公開防止
- ログイン失敗の回数制限
- GitHub/Renderへ上げるためのローカルGitコミット
- デプロイ用ZIP: `daily-compass-cloud-source.zip`

## スマホで使えるようにする手順

1. GitHubで非公開リポジトリを作る
2. このフォルダのGitコミットをその非公開リポジトリへpushする
3. RenderでWeb Serviceを作る
4. GitHubの非公開リポジトリを接続する
5. RuntimeはPythonを選ぶ
6. Start Commandは `python serve.py --host 0.0.0.0`
7. Persistent Diskを追加し、Mount Pathを `/var/data` にする
8. RenderのEnvironmentに以下を設定する

```text
DAILY_COMPASS_PASSWORD=自分だけが知っているログインパスワード
DAILY_COMPASS_SECRET=長いランダム文字列
DAILY_COMPASS_COOKIE_SECURE=1
DAILY_COMPASS_STATE_FILE=/var/data/app-state.json
DAILY_COMPASS_STATE_BACKUP_DIR=/var/data/state-backups
```

9. デプロイ後、Renderの公開URLをスマホで開く
10. パスワードでログインする

## 初回データ移行

ローカル版とクラウド版は別URLなので、最初だけデータ移行が必要です。

1. ローカル版の履歴画面で「エクスポート」を押す
2. 表示されたJSONをコピーする
3. クラウド版をスマホまたはPCで開いてログインする
4. 履歴画面のテキストエリアにJSONを貼る
5. 「バックアップ取り込み」を押す

## 注意

- `.env` はGitHubへ上げない
- `app-state.json` はGitHubへ上げない
- RenderでPersistent Diskを設定しないと、再起動や再デプロイで進捗が消える可能性がある
- 公開URLは他人に共有しない
