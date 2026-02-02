import { test, expect, type Page } from '@playwright/test';

// This file uses a real authenticated session (Clerk) and mutates user threads.
// Run serially to avoid cross-test interference.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

/**
 * E2E tests for core AI Assistant (chat) flows.
 *
 * Authentication:
 * - These tests require a real signed-in Clerk session (backend requires Clerk JWT).
 * - Recommended: create a storageState.json by logging in once, then set:
 *   PLAYWRIGHT_STORAGE_STATE=./e2e/.auth/storageState.json
 *
 * How to create storageState (one-time, local):
 * - Start dashboard (`npm run dev`) and API.
 * - Run: PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright open --config=playwright.config.ts
 * - Log in, then in the Inspector: “Save storage state” to ./e2e/.auth/storageState.json
 */

const selectors = {
  sidebar: '[data-testid="chat-thread-sidebar"]',
  newChat: '[data-testid="chat-new-chat"]',
  search: '[data-testid="chat-thread-search"]',
  threadList: '[data-testid="chat-thread-list"]',
  threadItem: '[data-testid="chat-thread-item"]',
  threadTitle: '[data-testid="chat-thread-title"]',
  threadEdit: '[data-testid="chat-thread-edit"]',
  threadDelete: '[data-testid="chat-thread-delete"]',
  renameInput: '[data-testid="chat-thread-rename-input"]',

  composer: '[data-testid="chat-composer"]',
  messageInput: '[data-testid="chat-message-input"]',
  send: '[data-testid="chat-send"]',
  message: '[data-testid="chat-message"]',
};

async function ensureAuthedOnChat(page: Page) {
  await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 120_000 });

  // If not authenticated/allowlisted, middleware will redirect to /login or /access-pending.
  // Bail early with a helpful error instead of timing out on missing chat selectors.
  await page.waitForLoadState('domcontentloaded');
  const path = new URL(page.url()).pathname;
  if (path.startsWith('/login') || path.startsWith('/sign-in')) {
    throw new Error(
      'Not authenticated. Provide PLAYWRIGHT_STORAGE_STATE with a logged-in Clerk session.'
    );
  }
  if (path.startsWith('/access-pending')) {
    throw new Error(
      'User not allowlisted (redirected to /access-pending). Use an allowlisted Clerk user for E2E.'
    );
  }
}

function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe('Chat Threads', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthedOnChat(page);

    // Ensure the chat UI is present.
    await expect(page.locator(selectors.newChat)).toBeVisible({ timeout: 60_000 });
  });

  test('open AI Assistant page', async ({ page }) => {
    // /chat is the AI Assistant page.
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.locator(selectors.sidebar)).toBeVisible();
  });

  test('create new chat, send first message, and verify title auto-updates in sidebar', async ({ page }) => {
    const firstMessage = `Hello from E2E ${Date.now()} - this message should become the title.`;

    await page.click(selectors.newChat);

    // Wait until chat interface is active.
    await expect(page.locator(selectors.composer)).toBeVisible({ timeout: 30_000 });

    await page.fill(selectors.messageInput, firstMessage);
    await page.click(selectors.send);

    // Ensure message renders.
    await expect(page.locator(selectors.message).filter({ hasText: firstMessage })).toBeVisible();

    // Sidebar should refresh and show auto-generated title.
    // Backend uses LLM or heuristic. Wait for title to change from "New chat".
    // We search for a thread item that is NOT "New chat" and matches the current active thread logic if possible,
    // but simpler is to wait for the first item's title to update.
    const firstThreadTitle = page.locator(selectors.threadItem).first().locator(selectors.threadTitle);
    
    // Wait for title to NOT be "New chat"
    await expect(firstThreadTitle).not.toHaveText('New chat', { timeout: 30_000 });
    
    // Verify it has some text
    const titleText = await firstThreadTitle.textContent();
    expect(titleText?.length).toBeGreaterThan(0);
  });

  test('rename thread via edit button', async ({ page }) => {
    const firstMessage = `Rename flow seed ${Date.now()} - becomes title.`;
    const newName = uniqueTitle('Renamed thread');

    await page.click(selectors.newChat);
    await expect(page.locator(selectors.composer)).toBeVisible();

    await page.fill(selectors.messageInput, firstMessage);
    await page.click(selectors.send);
    await expect(page.locator(selectors.message).filter({ hasText: firstMessage })).toBeVisible();

    // Select the first thread item in list (most recent).
    const firstThread = page.locator(selectors.threadItem).first();
    await expect(firstThread).toBeVisible({ timeout: 15_000 });
    await firstThread.click();

    // Hover to reveal action buttons.
    await firstThread.hover();
    await expect(firstThread.locator(selectors.threadEdit)).toBeVisible({ timeout: 5_000 });
    await firstThread.locator(selectors.threadEdit).click();

    const renameInput = firstThread.locator(selectors.renameInput);
    await expect(renameInput).toBeVisible();
    await renameInput.fill(newName);
    await renameInput.press('Enter');

    await expect(firstThread.locator(selectors.threadTitle)).toHaveText(newName, { timeout: 10_000 });
  });

  test('search thread by title', async ({ page }) => {
    const seededTitle = uniqueTitle('Searchable thread');

    // Create a new chat and rename it so it is deterministic for searching.
    await page.click(selectors.newChat);
    const firstThread = page.locator(selectors.threadItem).first();
    await expect(firstThread).toBeVisible({ timeout: 15_000 });
    await firstThread.hover();
    await expect(firstThread.locator(selectors.threadEdit)).toBeVisible({ timeout: 5_000 });
    await firstThread.locator(selectors.threadEdit).click();
    await firstThread.locator(selectors.renameInput).fill(seededTitle);
    await firstThread.locator(selectors.renameInput).press('Enter');
    await expect(firstThread.locator(selectors.threadTitle)).toHaveText(seededTitle);

    // Search by the seeded title.
    await page.fill(selectors.search, seededTitle);

    // Should show only matching threads; at minimum, the renamed thread is visible.
    await expect(page.locator(selectors.threadTitle).filter({ hasText: seededTitle })).toBeVisible();
  });

  test('delete thread and confirm it disappears', async ({ page }) => {
    const title = uniqueTitle('Thread to delete');

    await page.click(selectors.newChat);
    const firstThread = page.locator(selectors.threadItem).first();
    await expect(firstThread).toBeVisible({ timeout: 15_000 });
    await firstThread.hover();
    await expect(firstThread.locator(selectors.threadEdit)).toBeVisible({ timeout: 5_000 });
    await firstThread.locator(selectors.threadEdit).click();
    await firstThread.locator(selectors.renameInput).fill(title);
    await firstThread.locator(selectors.renameInput).press('Enter');
    await expect(firstThread.locator(selectors.threadTitle)).toHaveText(title);

    // Delete it.
    await firstThread.hover();
    await expect(firstThread.locator(selectors.threadDelete)).toBeVisible({ timeout: 5_000 });
    await firstThread.locator(selectors.threadDelete).click();

    // It should be removed from the thread list.
    await expect(page.locator(selectors.threadTitle).filter({ hasText: title })).toHaveCount(0, { timeout: 10_000 });
  });
});

test.describe('Chat Compaction', () => {
  test('shows compaction warning when API returns compaction_required', async ({ page }) => {
    await ensureAuthedOnChat(page);

    // Force compaction_required by intercepting the send message request.
    // This avoids relying on a tiny token budget in the backend.
    await page.route('**/api/v1/chat/threads/*/messages', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: null,
            message: null,
            compaction_required: true,
            token_usage: { total_tokens: 99999 },
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.click(selectors.newChat);
    await expect(page.locator(selectors.composer)).toBeVisible({ timeout: 30_000 });

    const msg = 'Trigger compaction';
    await page.fill(selectors.messageInput, msg);
    await page.click(selectors.send);

    await expect(page.locator(selectors.message).filter({ hasText: msg })).toBeVisible();
    await expect(
      page
        .locator(selectors.message)
        .filter({ hasText: 'Percakapan sudah cukup panjang' })
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
