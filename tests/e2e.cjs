/* 로컬 E2E 스모크 테스트 (Playwright)
 * 실행: BASE_URL=http://localhost:3010 NODE_PATH=<playwright-core 경로> node tests/e2e.cjs
 */
const { chromium } = require("playwright-core");
const fs = require("fs");

// 사용법:
//   npm i -D playwright-core   (또는 npx playwright install chromium)
//   CHROME_PATH=/path/to/chrome node tests/e2e.cjs [BASE_URL]
const EXEC = process.env.CHROME_PATH || undefined;
const BASE = process.env.BASE_URL || process.argv[2] || "http://localhost:3000";
const OUT = process.env.SHOT_DIR || "tests/shots";
fs.mkdirSync(OUT, { recursive: true });

const readAccount = (page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem("lst:account:v1");
    return raw ? JSON.parse(raw) : null;
  });

(async () => {
  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
    if (msg.type() === "warning") errors.push("WARN: " + msg.text());
  });
  page.on("pageerror", (err) => errors.push("PAGEERROR: " + err.message));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(14000);

  const body = await page.locator("body").innerText();
  console.log(
    "FEED",
    JSON.stringify({
      live: body.includes("실시간"),
      demo: body.includes("데모 시세로 동작 중"),
      polling: body.includes("폴링"),
      binance: body.includes("Binance REST 폴링"),
      okxLive: body.includes("OKX 무기한 선물 실시간"),
    }),
  );
  const mark = await page.locator("text=마크가격").first().locator("..").innerText();
  console.log("MARK_CARD", JSON.stringify(mark));
  console.log("FEED_STATUS", JSON.stringify(await page.getByTestId("feed-status").innerText()));
  await page.screenshot({ path: `${OUT}/01-home-desktop.png`, fullPage: false });

  // ---- 시장가 롱 ----
  await page.getByTestId("order-qty").fill("0.01");
  await page.getByRole("button", { name: /롱 \(Long\)/ }).click();
  await page.waitForTimeout(1200);
  let account = await readAccount(page);
  console.log(
    "MARKET_LONG",
    JSON.stringify({
      toast: (await page.locator("body").innerText()).includes("시장가 진입 완료"),
      wallet: account?.walletBalance,
      pos: account?.positions?.[0] && {
        qty: account.positions[0].qty,
        entry: Number(account.positions[0].entryPrice.toFixed(1)),
        margin: Number(account.positions[0].margin.toFixed(2)),
        liq: Number(account.positions[0].liquidationPrice.toFixed(1)),
        lev: account.positions[0].leverage,
        mode: account.positions[0].marginMode,
      },
    }),
  );

  // ---- 호가 클릭 → 지정가 가격 자동 입력 ----
  await page.getByRole("button", { name: "지정가", exact: true }).click();
  const ask = page.locator('button[title="클릭하면 지정가 주문 가격으로 입력됩니다"]').first();
  const askText = (await ask.innerText()).split("\n")[0];
  await ask.click();
  await page.waitForTimeout(300);
  const priceVal = await page.getByTestId("order-price").inputValue();
  console.log(
    "ORDERBOOK_TO_LIMIT",
    JSON.stringify({ askText, priceVal, matches: priceVal.replace(/,/g, "") === askText.replace(/,/g, "") }),
  );

  // ---- TP/SL 지정가 주문 (현재가 위 매수 → 다음 틱 체결) ----
  const last = Number((await readAccount(page))?.positions?.[0]?.entryPrice || 0);
  const limitPrice = Math.round((askText ? Number(askText.replace(/,/g, "")) : last) * 1.001 * 10) / 10;
  await page.getByTestId("order-price").fill(String(limitPrice));
  await page.getByTestId("order-qty").fill("0.002");
  if ((await page.locator('input[placeholder="익절 가격"]').count()) === 0) {
    await page.getByRole("button", { name: /TP \/ SL 동시 설정/ }).click();
  }
  await page.getByRole("button", { name: "TP", exact: true }).click();
  await page.getByRole("button", { name: "SL", exact: true }).click();
  const tpInput = page.locator('input[placeholder="익절 가격"]').first();
  const slInput = page.locator('input[placeholder="손절 가격"]').first();
  await tpInput.fill(String(Math.round(limitPrice * 1.03)));
  await slInput.fill(String(Math.round(limitPrice * 0.97)));
  await page.getByRole("button", { name: /롱 \(Long\)/ }).click();
  await page.waitForTimeout(2500);
  account = await readAccount(page);
  console.log(
    "LIMIT_TP_SL",
    JSON.stringify({
      orders: account?.orders?.length,
      pos: account?.positions?.[0] && {
        qty: account?.positions?.[0]?.qty,
        tp: account?.positions?.[0]?.tp,
        sl: account?.positions?.[0]?.sl,
      },
      fills: account?.trades?.filter((t) => t.action === "OPEN").length,
    }),
  );
  await page.screenshot({ path: `${OUT}/02-after-trades.png`, fullPage: true });

  // ---- 부분 종료 / 전체 종료 ----
  await page.getByRole("button", { name: "50% 종료" }).first().click();
  await page.waitForTimeout(700);
  const half = await readAccount(page);
  await page.getByRole("button", { name: "전체 종료" }).first().click();
  await page.waitForTimeout(700);
  const flat = await readAccount(page);
  console.log(
    "CLOSE",
    JSON.stringify({
      afterHalfQty: half?.positions?.[0]?.qty,
      afterAllPositions: flat?.positions?.length,
      trades: flat?.trades?.length,
    }),
  );

  // ---- 채팅 ----
  const chat = page.locator('input[placeholder="메시지를 입력하세요 (Enter 전송)"]').first();
  await chat.fill("E2E 테스트 메시지입니다");
  await chat.press("Enter");
  await page.waitForTimeout(600);
  console.log("CHAT", (await page.locator("body").innerText()).includes("E2E 테스트 메시지입니다"));

  // ---- 자산 탭: 시드 리필 ----
  await page.getByRole("button", { name: /^자산/ }).click();
  await page.waitForTimeout(400);
  const before = (await readAccount(page))?.walletBalance;
  await page.getByRole("button", { name: /무료 시드 \+10,000 USDT/ }).click();
  await page.waitForTimeout(900);
  const after = (await readAccount(page))?.walletBalance;
  console.log("REFILL", JSON.stringify({ before, after }));
  await page.screenshot({ path: `${OUT}/03-assets.png`, fullPage: false });

  // ---- 커뮤니티 글쓰기 ----
  await page.goto(BASE + "/community", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "글쓰기" }).click();
  await page.getByPlaceholder(/^제목 \(예:/).fill("E2E 포지션 인증 테스트");
  await page.locator("textarea").first().fill("E2E 테스트 본문입니다. 롱숏톡 커뮤니티 글쓰기 검증.");
  await page.getByRole("button", { name: "등록" }).click();
  await page.waitForTimeout(800);
  const community = await page.locator("body").innerText();
  console.log("COMMUNITY_POST", community.includes("E2E 포지션 인증 테스트"));
  await page.screenshot({ path: `${OUT}/04-community.png`, fullPage: true });

  // ---- 랭킹 / 가이드 ----
  await page.goto(BASE + "/ranking", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/05-ranking.png`, fullPage: true });
  console.log("RANKING", (await page.locator("body").innerText()).includes("주간 수익률"));

  await page.goto(BASE + "/guide", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const guideText = await page.locator("body").innerText();
  console.log(
    "GUIDE",
    JSON.stringify({
      calc: guideText.includes("청산가 계산기"),
      faq: guideText.includes("자주 묻는 질문"),
      liqRow: guideText.includes("-4.6%"),
    }),
  );
  await page.screenshot({ path: `${OUT}/06-guide.png`, fullPage: false });
  await page.locator("#calculator").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/07-guide-calc.png`, fullPage: false });

  // ---- 모바일 ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${OUT}/08-home-mobile.png`, fullPage: false });
  await page.getByRole("button", { name: "주문", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/09-mobile-order.png`, fullPage: false });
  const mobile = await page.locator("body").innerText();
  console.log("MOBILE_ORDER_TAB", mobile.includes("롱 (Long)"));

  console.log("CONSOLE_ERRORS", JSON.stringify(errors.slice(0, 14)));
  await browser.close();
})();
