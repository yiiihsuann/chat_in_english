# Chat in English — AI 英文會話練習

一個簡單的英文會話練習網頁。選擇情境後，和 Gemini AI 練習對話；AI 會提供自然的英文回應、修正建議和簡短說明。可在 GitHub Pages 免費託管，學生各自使用自己的 Gemini API Key。

## 開始練習

部署完成後，開啟：**https://yiiihsuann.github.io/chat_in_english/**

如果網址尚未開啟，請先照下方「部署到 GitHub Pages」設定；首次部署通常需要幾分鐘才會生效。

1. 到 [Google AI Studio](https://aistudio.google.com/app/apikey) 取得自己的 Gemini API Key。
2. 開啟練習網站，把 Key 貼到頁面上方並按 **Save key**。
3. 選一個角色扮演情境，例如餐廳、飯店或工作面試。
4. 用英文打字或按麥克風說話，按 **Send** 開始練習。
5. 右側可看英文修正和小提示。按 **Replay corrected sentence** 或對話旁的 **Listen** 重播句子。
6. 用 **New chat** 開始新的對話；按 **Clear** 可從這個瀏覽器刪除已儲存的 Key。

## 部署到 GitHub Pages

1. 前往此 repository 的 **Settings → Pages**。
2. 在 **Build and deployment** 選 **Deploy from a branch**。
3. Branch 選 **main**，資料夾選 **/ (root)**，再按 **Save**。
4. 等 GitHub Pages 顯示已發布後，開啟上方網址。

若 Pages 設定中沒有可選的部署來源，請確認 repository 的可見度和 GitHub 帳號方案是否支援 Pages。私人 repository 的 Pages 權限可能受方案限制。

## 功能

- Gemini AI 英文對話與友善的英文修正
- Everyday、餐廳、飯店入住、工作面試角色扮演
- 每則 AI 回覆可單獨重播；修正句也可重播
- 瀏覽器語音輸入與深色模式
- API Key 由每位使用者自行提供，存在該瀏覽器的 `localStorage`
- 手機與桌面版響應式介面

## API Key 與隱私

這是純前端網站，沒有自建後端。Key 不在程式碼或 GitHub repository 中，但會由使用者瀏覽器直接送到 Google Gemini API，並儲存在同一瀏覽器的 `localStorage`。請只在自己的裝置使用自己的 Key；不要共用或公開 Key。使用公用電腦後，請按 **Clear**。API 使用量及相關限制依 Google AI Studio 帳戶與方案為準。

## 語音支援

語音輸入使用瀏覽器的 Web Speech API，支援情形會依瀏覽器、裝置和權限不同；請在安全的 HTTPS 網站並允許麥克風權限。若無法使用麥克風，可直接打字。AI 回覆朗讀使用瀏覽器內建語音合成功能。

## 本機預覽

直接用瀏覽器開啟 `index.html` 通常可檢視介面；語音功能和 API 呼叫建議透過 HTTPS 網站（例如 GitHub Pages）使用。網站不需要建置步驟或安裝套件。

## 專案檔案

- `index.html` — 網頁結構
- `style.css` — 版面與樣式
- `app.js` — 對話、Gemini API、語音及瀏覽器設定
