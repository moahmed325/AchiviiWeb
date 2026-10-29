import base from './playwright.config';
export default { ...base, use: { ...base.use, channel: undefined, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } } };
