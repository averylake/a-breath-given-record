import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base = process.env.BREATH_DEPENDENCIES || path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
if(!existsSync(path.join(base,'node_modules')))throw Error('Dependencies missing. Run npm install in this project, or set BREATH_DEPENDENCIES to a reviewed dependency directory.');
export const require = createRequire(path.join(base,'package.json'));
export const dependencyRoot = base;
