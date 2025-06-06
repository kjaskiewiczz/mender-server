// Copyright 2021 Northern.tech AS
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

import test, { expect } from '../fixtures/fixtures.ts';
import { compareImages, isEnterpriseOrStaging } from '../utils/commands.ts';
import { selectors, timeouts } from '../utils/constants.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const search = `const transfer = '[{"content":`;
const checkDownloadedReplayForSecret = async (path, secret) => {
  const fileStream = fs.createReadStream(path);
  const lines = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  for await (const line of lines) {
    if (!line.includes(search)) {
      continue;
    }
    const transferContent = line.substring(line.indexOf('['), line.lastIndexOf(']') + 1);
    let candidates = [];
    try {
      candidates = JSON.parse(transferContent);
    } catch (error) {
      console.error('checkDownloadedReplayForSecret - content parsing failed with', error);
      throw error;
    }
    const { hadContent, containedSecret } = candidates.reduce(
      (accu, { content: encodedText }) => {
        const jsonContent = Buffer.from(encodedText, 'base64').toString();
        if (jsonContent === 'undefined') {
          // pure delay entries will have undefined content, ignore those
          return accu;
        }
        let content;
        let decodedContent;
        try {
          content = JSON.parse(jsonContent);
          decodedContent = String.fromCharCode(...content.data);
        } catch (error) {
          console.log('checkDownloadedReplayForSecret', error);
          console.log('checkDownloadedReplayForSecret - encodedText', encodedText);
        }
        return { hadContent: accu.hadContent || !!decodedContent, containedSecret: accu.containedSecret || decodedContent.includes(secret) };
      },
      { hadContent: false, containedSecret: false }
    );
    expect(hadContent).toBeTruthy();
    expect(containedSecret).toBeFalsy();
    fileStream.close();
    return;
  }
  fileStream.close();
};

test.describe('Auditlogs', () => {
  let navbar;
  test.beforeEach(async ({ page }) => {
    navbar = page.locator('.leftFixed.leftNav');
  });

  const secret = 'super secret something text';
  test('will track remote terminal sessions', async ({ browser, browserName, environment, page }) => {
    test.skip(!isEnterpriseOrStaging(environment));
    await navbar.getByRole('link', { name: /Devices/i }).click({ force: browserName === 'webkit' });
    await page.locator(`css=${selectors.deviceListItem} div:last-child`).last().click();
    await page.getByText(/troubleshooting/i).click();
    // the deviceconnect connection might not be established right away
    await page.getByText(/Session status/i).waitFor({ timeout: timeouts.tenSeconds });
    const connectionButton = await page.getByRole('button', { name: /connect/i });
    await connectionButton.first().click();
    await page.getByText('Connection with the device established').waitFor({ timeout: timeouts.tenSeconds });
    await expect(page.locator(selectors.terminalElement)).toBeVisible();

    // the terminal content might take a bit to get painted - thus the waiting
    await page.click(selectors.terminalElement, { timeout: timeouts.default });

    const terminalText = await page.locator(`css=${selectors.terminalText}`);
    await terminalText.fill('passwd');
    await page.keyboard.press('Enter');
    const expectedPath = path.join(__dirname, '..', 'test-results', 'diffs', 'terminalSecretContent.png');
    const elementHandle = await page.$(selectors.terminalElement);
    await elementHandle.screenshot({ path: expectedPath });
    await page.waitForTimeout(timeouts.oneSecond);
    await terminalText.pressSequentially(secret);

    const screenShotPath = path.join(__dirname, '..', 'test-results', 'diffs', 'terminalSecretContent-actual.png');
    await elementHandle.screenshot({ path: screenShotPath });
    const { pass } = compareImages(expectedPath, screenShotPath);
    expect(pass).toBeTruthy();
    await terminalText.fill('top');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(timeouts.oneSecond);
    await page.click('[aria-label="close"]'); // short-form
    await navbar.getByRole('link', { name: /audit log/i }).click();

    await page.click(`.auditlogs-list-item :text('CLOSE_TERMINAL')`);
    const drawer = page.locator(`.MuiDrawer-paper`);
    await expect(drawer.locator(`a:has-text('Download'), button:has-text('Download')`)).toBeVisible();
    await drawer.getByRole('button', { name: 'Play', exact: true }).click();
    const downloadPromise = page.waitForEvent('download', { timeout: timeouts.fifteenSeconds });
    await page.waitForTimeout(timeouts.default);
    await drawer.getByText(/download/i).click();
    const download = await downloadPromise;
    const downloadTargetPath = await download.path();
    expect(downloadTargetPath).toBeTruthy();

    await checkDownloadedReplayForSecret(downloadTargetPath, 'secret something');

    const localPage = await browser.newPage();
    localPage.on('pageerror', exception => {
      console.log(`Error initializing terminal replay: "${exception}"`);
      expect(exception).toBeFalsy();
    });
    fs.renameSync(downloadTargetPath, `${downloadTargetPath}.html`);
    await localPage.goto(`file://${downloadTargetPath}.html`);
    await expect(localPage.getByText('Terminal playback')).toBeVisible();
    await localPage.getByRole('button', { name: /start/i }).click();
  });
});
