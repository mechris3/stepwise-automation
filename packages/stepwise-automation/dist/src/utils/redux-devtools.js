"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findReduxDevToolsExtension = findReduxDevToolsExtension;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Finds the Redux DevTools extension path on the system.
 * Searches common browser extension directories for Chrome and Brave.
 *
 * @returns The path to the Redux DevTools extension, or undefined if not found
 */
function findReduxDevToolsExtension() {
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
        }
        catch {
            // Skip inaccessible paths
        }
    }
    return undefined;
}
//# sourceMappingURL=redux-devtools.js.map