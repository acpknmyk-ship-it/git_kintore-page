# 筋トレ記録（画面）

iPhone のホーム画面に置いて使う、筋トレの記録アプリの画面。GitHub Pages で公開する**公開リポジトリ**。
記録を預かる GAS と PC 側のプログラムは、非公開の `git_kintore_kiroku_test` にある。

## 公開リポジトリとして守ること

- 記録・合言葉・送り先の URL・個人の情報を入れない（合言葉と URL は、アプリの設定画面から端末に保存する）
- コミットのメールアドレスは GitHub の noreply のもの（このリポジトリの `git config user.email` に設定済み。変えない）
- `img/irasutoya/` は「いらすとや」の素材。**素材としての再配布は不可**。元の絵のイメージを変える加工をしない（大きさをそろえるだけ）。足すときは irasutoya.com の各ページから取る
- `img/line/` と `img/body.svg` は自作（線画は `node tools/make_line.mjs img/line` で作り直せる。サイドレイズだけ手書き）。いらすとやに似せた絵は描かない

## つくり

- ビルド道具なし。HTML・CSS・素の JavaScript モジュールをそのまま公開する
- `store.js`：記録の入れ物と計算（画面にも通信にも依存しない）。`app.js`：画面と通信。`sw.js`：電波が無いときに画面を開く仕組み
- `exercises.json`：種目の一覧。**id は一度使ったら変えない・消さない**（記録が id で種目を指す。PC 側もこのファイルを読む）
- 重さの意味：バーベル＝バーを含む合計 kg、ダンベル＝片手 1 個の kg、自重＝重さなし。プランクは回数の代わりに秒
- 公開 URL は `/<リポジトリ名>/` の下になる。ファイルの参照は必ず相対パスで書く
- 記録は端末（localStorage）に保存し、アプリを開いている間に送る。iPhone は裏で自動送信できない
- 送信は `Content-Type: text/plain` の POST（ブラウザの事前確認を避けるため）。合言葉は本文に入れ、URL には入れない

## 確認

- `npm test`（`node --test test/store.test.mjs`）
- 画面：`node tools/serve.mjs` → http://localhost:5183/git_kintore-page/ をスマホ幅で開き、記録・直す・消す・メモ・履歴を確かめる
- 送受信：非公開側の `node tools/fake-gas.mjs`（GAS のまね）を起動し、設定画面にその URL と試験用の合言葉を入れる
- 画面を変えたら `app.js` の `APP_VERSION` を上げる
