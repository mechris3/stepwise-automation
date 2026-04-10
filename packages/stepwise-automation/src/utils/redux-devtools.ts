import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Finds the Redux DevTools extension path on the system.
 * Searches common browser extension directories for Chrome and Brave.
 *
 * @returns The path to the Redux DevTools extension, or undefined if not found
 */
export function findReduxDevToolsExtension(): string | undefined {
  const extensionId = 'lmhkpmbekcpmknklioeibfkpmmfibljd';
  const homedir = os.homedir();

  const searchPaths = [
    path.join(homedir, 'Library/Application Support/Google/Chrome/Default/Extensions', extensionId),
    path.join(homedir, 'Library/Application Support/BraveSoftware/Brave-Browser/Default/Extensions', extensionId),
    path.join(homedir, '.config/google-chrome/Default/Extensions', extensionId),
    path.join(homedir, 'AppData/Local/Google/Chrome/User Data/Default/Extensions', extensionId),
  ];

  for (const basePath of searchPaths) {
    try {
      if (fs.existsSync(basePath)) {
        const versions = fs
          .readdirSync(basePath)
          .filter(v => fs.statSync(path.join(basePath, v)).isDirectory());
        if (versions.length > 0) {
          return path.join(basePath, versions[0]);
        }
      }
    } catch {
      // Skip inaccessible paths
    }
  }

  return undefined;
}
