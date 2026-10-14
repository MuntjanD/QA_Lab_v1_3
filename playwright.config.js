const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  webServer: { command: 'node server.js', url: 'http://localhost:3100/api/v1/health', reuseExistingServer: true },
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'ui', testDir: './tests/ui', use: { browserName: 'chromium' } },
  ],
});
