// Story Flow: open a scene from its node, detect broken connections after deleting a scene, jump to
// the broken action — and Duplicate Project from Project Settings and from the Welcome list.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { TMP, launchEditor } from './helpers';

const DIR = path.join(TMP, 'flow');

test('story flow: open, broken connections; duplicate project', async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  const { app, page, errors } = await launchEditor();
  await page.getByTestId('new-project-name').fill('Flow Test');
  await page.getByTestId('new-project-location').fill(path.join(DIR, 'projects'));
  await page.getByTestId('template-romance').click();
  await page.getByTestId('create-project').click();

  // Branches and choice connections are drawn; the node's Open button opens the scene.
  await page.getByTestId('nav-flow').click();
  await expect(page.locator('.react-flow__edge')).not.toHaveCount(0);
  await expect(page.getByTestId('flow-broken-count')).toHaveCount(0);
  await page.getByTestId('flow-open-The Date').click();
  await expect(page.getByTestId('current-scene')).toHaveText('The Date');

  // Delete a scene the story jumps to → the map reports the broken connection.
  await page.getByTestId('scene-Good Ending').hover();
  await page.getByTestId('scene-Good Ending').getByTitle('Delete scene').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('scene-Good Ending')).toHaveCount(0);
  await page.getByTestId('nav-flow').click();
  await expect(page.getByTestId('flow-broken-count')).toHaveText('⚠ 1 broken connection(s)');
  await expect(page.getByTestId('flow-node-broken-The Date')).toHaveText('⚠ 1');
  await page.getByTestId('flow-broken-count').click();
  await expect(page.getByTestId('flow-broken-0')).toContainText('The Date');
  await expect(page.getByTestId('flow-broken-0')).toContainText('Conditional Branch (if true)');
  await page.screenshot({ path: path.join(TMP, 'shots', 'k-flow-broken.png') });
  await page.getByTestId('flow-broken-0').click();
  await expect(page.getByTestId('current-scene')).toHaveText('The Date');
  await expect(page.locator('[data-type="conditional"].selected')).toHaveCount(1);
  // Export is blocked until it is fixed (existing project check).
  await page.getByTestId('nav-export').click();
  await expect(page.getByTestId('project-check')).toContainText('Jump target scene does not exist');

  // Duplicate Project from Project Settings: saves first, opens the copy.
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('duplicate-project').click();
  await expect(page.getByTestId('prompt-input')).toHaveValue('Flow Test copy');
  await page.getByTestId('prompt-ok').click();
  await expect(page.getByTestId('project-name')).toHaveText('Flow Test copy');
  expect(existsSync(path.join(DIR, 'projects', 'Flow Test copy', 'project.json'))).toBe(true);
  const original = JSON.parse(await fs.readFile(path.join(DIR, 'projects', 'Flow Test', 'project.json'), 'utf8'));
  const copy = JSON.parse(await fs.readFile(path.join(DIR, 'projects', 'Flow Test copy', 'project.json'), 'utf8'));
  expect(copy.id).not.toBe(original.id);
  expect(copy.scenes.map((s: { name: string }) => s.name)).toEqual(original.scenes.map((s: { name: string }) => s.name));
  expect(original.scenes.some((s: { name: string }) => s.name === 'Good Ending')).toBe(false); // the deletion was saved first

  // Duplicate from the Welcome screen's recent list.
  await page.getByTestId('close-project').click();
  await page.getByTestId('recent-item').filter({ hasText: 'Flow Test copy' }).first().getByTestId('recent-duplicate').click();
  await page.getByTestId('prompt-input').fill('Flow Test third');
  await page.getByTestId('prompt-ok').click();
  await expect(page.getByTestId('project-name')).toHaveText('Flow Test third');
  expect(existsSync(path.join(DIR, 'projects', 'Flow Test third', 'project.json'))).toBe(true);
  expect(errors).toEqual([]);
  await app.close();
});
