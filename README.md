# TETRIO 練習ミニゲーム

ブラウザで動くシンプルなテトリス練習用ページです。40 Lines クリアまでのタイムを計測できます。

## 起動

```bash
python3 -m http.server 4173
```

その後 `http://localhost:4173` を開いてください。

## 操作

- ←→: 移動（Configで変更可）
- ↑: 右回転（Configで変更可）
- Z: 左回転（Configで変更可）
- ↓: ソフトドロップ（Configで変更可）
- Space: ハードドロップ（Configで変更可）
- C: ホールド（Configで変更可）

## Config再現

サイドバーから以下を変更して保存できます（localStorage保存）。

- **DAS**: 横移動の初回遅延
- **ARR**: 横移動の連続入力間隔（0で瞬間横移動）
- **SDF**: ソフトドロップ速度
- **ARE**: ピース確定後の次ピース出現までの遅延
- キーバインド: Left/Right/SoftDrop/HardDrop/CW/CCW/Hold

`Config初期化` でデフォルトに戻せます。


## スマホ操作

画面下のタッチボタンから以下の操作ができます。

- ◀ / ▶: 左右移動
- ▼: ソフトドロップ
- ⟳ / ⟲: 回転
- HOLD: ホールド
- HARD: ハードドロップ
