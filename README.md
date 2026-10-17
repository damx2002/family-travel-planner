# Family Travel Planner

給家庭自由行使用的手機優先行程工具。純 HTML、CSS、Vanilla JavaScript，無後端、帳號、API、第三方框架或追蹤程式。

## 使用與本機預覽

以靜態 HTTP 伺服器開啟專案即可，不需要安裝應用程式依賴：

```sh
cd /workspace/family-travel-planner
python -m http.server 8000 --bind 127.0.0.1
```

在本機瀏覽器開啟該伺服器。也可用任何靜態網站伺服器。建議使用 HTTP / HTTPS；直接開啟 `file://` 時，各瀏覽器的 localStorage 行為可能不同。

首次開啟載入「神戶大阪家庭旅行」示範資料（2026/10/20–10/25、4 大 2 小），可直接修改。之後讀取同一瀏覽器與網站來源的儲存資料。

## 功能

- 編輯旅程基本資料，自動產生每日卡片與天數 / 夜數。
- 今日或下一個旅程日摘要，Day 展開 / 收合。
- 行程新增、編輯、刪除、上移、下移、跨日移動；順序由使用者決定，不按時間自動重排。
- 住宿與交通的新增、編輯、刪除。
- 支出新增、編輯、刪除，按幣別分開顯示總支出、已付款與未付款，以整數分計算摘要避免一般小數加總誤差。
- 待辦新增、編輯、刪除、完成勾選。
- JSON 備份下載及驗證後匯入；匯入會確認覆蓋，清除需兩次確認。
- 旅程日期縮短前保護範圍外的行程，需先移動或刪除；最多 366 天。
- 匯入檔案最多 5 MB，驗證版本、日期、欄位型別、列舉、唯一 ID、金額與日期連續性；拒絕無效檔案並保留原資料。
- 儲存失敗會提示且不將編輯當作已儲存。已存內容損壞時進入保護模式，不自動覆寫原資料；匯入有效備份或清除資料可解除。

清除後是空白旅程，不會重新填入 Demo。資料沒有跨裝置同步。無痕模式、清除網站資料或更換網址來源均可能失去資料，請定期匯出。JSON 包含訂位編號等私人內容，請自行妥善保存。

## localStorage schema

唯一 key：`family-travel-planner.v1`。值為以下 JSON 文件：

```json
{
  "version": 1,
  "trip": {
    "name": "我的家庭旅行",
    "destination": "日本",
    "startDate": "2026-10-20",
    "endDate": "2026-10-20",
    "adults": 4,
    "children": 2,
    "notes": ""
  },
  "days": [
    {
      "date": "2026-10-20",
      "items": [
        {
          "id": "unique-event-id",
          "time": "09:00",
          "name": "出發",
          "type": "交通",
          "location": "機場",
          "notes": "",
          "status": "預計"
        }
      ]
    }
  ],
  "lodging": [
    {
      "id": "unique-lodging-id",
      "name": "飯店",
      "checkIn": "2026-10-20",
      "checkOut": "2026-10-21",
      "address": "",
      "booking": "",
      "notes": ""
    }
  ],
  "transport": [
    {
      "id": "unique-transport-id",
      "type": "飛機",
      "name": "航空公司",
      "datetime": "2026-10-20T09:00",
      "from": "出發機場",
      "to": "抵達機場",
      "booking": "",
      "notes": ""
    }
  ],
  "expenses": [
    {
      "id": "unique-expense-id",
      "category": "機票",
      "name": "來回機票",
      "amount": 45000,
      "currency": "TWD",
      "paid": true
    }
  ],
  "todos": [{ "id": "unique-todo-id", "name": "買旅平險", "done": false }]
}
```

`days` 按日期排序，包含旅程範圍內每一天；`items` 陣列順序即畫面順序。日期使用 `YYYY-MM-DD`，時間 `HH:mm`，交通時間為目的地自行輸入的當地時間（無時區轉換）。幣別接受三碼英文字母，儲存為大寫。金額非負，最多兩位小數。所有項目 ID 必須唯一。

`app.js` 依 state / storage、驗證、rendering、共用表單、各類資料操作與 import/export 分區。主要儲存函式為 `createDefaultData()`、`loadData()`、`saveData()`。使用者文字輸出前進行 HTML escaping。

## GitHub Pages 部署

1. 將這五個檔案提交並推送至 GitHub repository 的 `main` 分支根目錄。
2. 開啟 repository → **Settings → Pages**。
3. **Build and deployment → Source** 選 **Deploy from a branch**。
4. Branch 選 `main`，資料夾選 `/ (root)`，按 **Save**。
5. 等待 Pages 部署完成後，使用 GitHub 提供的正式網站網址。

所有資源使用 `./` 相對路徑，支援 repository 子路徑，不需設定 build command。`.nojekyll` 關閉 Jekyll 處理。開發環境、Pages 網址及自訂網域的 localStorage 各自獨立，切換前請先匯出。

## 驗證

語法檢查：`node --check app.js`（Node 僅用於開發檢查，網站執行不需要 Node）。

瀏覽器測試涵蓋首次 Demo、旅程修改、行程 CRUD / 上下移動 / 跨日移動、重新整理保留、住宿與交通新增、TWD / JPY 分開加總、待辦完成、JSON 匯出還原、拒絕無效匯入、清除雙重確認、日期縮短保護，以及 320 / 390 / 768 / 1280px 無水平捲動、手機 dialog 範圍與 JavaScript 錯誤檢查。測試結果另見交付回報。

## V2 可考慮

多趟旅程切換、手動輸入匯率、列印行程、離線安裝 PWA、搜尋與篩選。上述功能均未加入 V1。
