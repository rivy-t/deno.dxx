// spell-checker:ignore (jargon) bikeshed ; (js) gmsu imsu msu ; (libs) micromatch picomatch ; (names) SkyPack ; (options) globstar nobrace noquantifiers nocase nullglob ; (utils) xargs

// ToDO: review checks for progression in splits => continue to use an assert? what do we guarantee about returned 'token'?

// ToDO: add support for end-of-expansion token (eg, `--#`); all subsequent tokens are passed through in their raw, unexpanded form
//   ... the end-of-expansion token must be in bare unquoted form on the original command line (any end-of-expansion tokens generated by expansion are ignored)

// ref: [bash shell expansion](https://tldp.org/LDP/Bash-Beginners-Guide/html/sect_03_04.html) @@ <https://archive.is/GFMJ1>
// ref: [GNU ~ bash shell expansions](https://www.gnu.org/software/bash/manual/html_node/Shell-Expansions.html) @@ <https://archive.is/lHgK6>
// ref: [GNU ~ bash quote removal](https://www.gnu.org/software/bash/manual/html_node/Quote-Removal.html) @@ <https://archive.is/sAYie>

// ESM conversion refs
// ref: <https://esbuild.github.io/plugins>
// ref: <https://github.com/postui/esm.sh/blob/master/server/build.go>
// ref: <https://github.com/postui/esm.sh>
// ref: <https://esbuild.github.io/plugins/#resolve-results>
// ref: <https://dev.to/ije/introducing-esm-cdn-for-npm-deno-1mpo> // `esm` client?
// ref: <https://github.com/remorses/esbuild-plugins>
// ref: <https://github.com/snowpackjs/rollup-plugin-polyfill-node>
// ref: <https://esbuild.github.io/plugins/#resolve-callbacks>
// ref: <https://www.google.com/search?q=using+esbuild+polyfill&oq=using+esbuild+polyfill&aqs=chrome..69i57.7740j0j1&sourceid=chrome&ie=UTF-8>
// ref: <https://github.com/evanw/esbuild/issues/298>
// ref: <https://github.com/evanw/esbuild/blob/03a33e6e007467d99989ecf82fad61bd928a71aa/CHANGELOG.md#0717>
// ref: <https://stackoverflow.com/questions/64557638/how-to-polyfill-node-core-modules-in-webpack-5>
// ref: <https://www.npmjs.com/package/path-browserify>
// ref: <https://github.com/evanw/esbuild/issues/85>
// ref: <https://stackoverflow.com/questions/61821038/how-to-use-npm-module-in-deno>
// ref: <https://jspm.org/docs/cdn>

import { assert, FS, OSPaths, Path } from './$deps.ts';

const { exists, existsSync } = FS;

import { walk, walkSync } from './xWalk.ts';

import * as Braces from './xBraces.ts';

export { expand as braceExpand } from './xBraces.ts';

// esm.sh
// import Braces from 'https://cdn.esm.sh/braces@3.0.2';
// import Micromatch from 'https://cdn.esm.sh/micromatch@4.0.2';
// import Picomatch from 'https://cdn.esm.sh/picomatch@2.2.2';
// esm.sh (un-minimized, readable source)
// import Braces from 'https://cdn.esm.sh/braces@3.0.2?dev';
// import Micromatch from 'https://cdn.esm.sh/micromatch@4.0.2?dev';
// import Picomatch from 'https://cdn.esm.sh/picomatch@2.2.2?dev';

// // jspm.io
// import BracesM from 'https://ga.jspm.io/npm:braces@3.0.2/index.js';
// import MicromatchM from 'https://ga.jspm.io/npm:micromatch@4.0.2/index.js';
// import PicomatchM from 'https://ga.jspm.io/npm:picomatch@2.2.2/index.js';
// jspm.dev
// import * as BracesT from 'https://cdn.jsdelivr.net/gh/DefinitelyTyped/DefinitelyTyped@7121cbff79/types/braces/index.d.ts';
// import * as MicromatchT from 'https://cdn.jsdelivr.net/gh/DefinitelyTyped/DefinitelyTyped@7121cbff79/types/micromatch/index.d.ts';
import * as PicomatchT from 'https://cdn.jsdelivr.net/gh/DefinitelyTyped/DefinitelyTyped@7121cbff79/types/picomatch/index.d.ts';
// import BracesM from 'https://jspm.dev/npm:braces@3.0.2';
// import MicromatchM from 'https://jspm.dev/npm:micromatch@4.0.2';
import PicomatchM from 'https://jspm.dev/npm:picomatch@2.3.0';
// const Braces = BracesM as typeof BracesT;
// const Micromatch = MicromatchM as typeof MicromatchT;
const Picomatch = PicomatchM as typeof PicomatchT; // noSonar ; disable "type assertion not necessary"; needed for correct typings as 'picomatch' develops

// import Braces from 'http://localhost/braces@3.0.2?bundle';
// import Micromatch from 'http://localhost/micromatch@4.0.2?bundle';
// import Picomatch from 'http://localhost/picomatch@2.2.2?bundle';

// import Braces from 'http://smtp-lan:8080/braces@3.0.2?bundle';
// import Micromatch from 'http://smtp-lan:8080/micromatch@4.0.2?bundle';
// import Picomatch from 'http://smtp-lan:8080/picomatch@2.2.2?bundle';

// * skypack imports fail due to missing polyfills
// import Braces from 'https://cdn.skypack.dev/braces@3.0.2?dts';
// import Micromatch from 'https://cdn.skypack.dev/micromatch@4.0.2?dts';
// import Picomatch from 'https://cdn.skypack.dev/picomatch@2.2.2?dts';

const isWinOS = Deno.build.os === 'windows';

// ToDO: add ArgsOptions = {
//    endExpansionToken (default == '-+'; setting this also sets partialExpansion to true)
//    partialExpansionAllowed (default == false)
//    }

// const endExpansionToken = '-~'; // ToDO: bikeshed best alternative for an end-of-expansion token
// const endExpansionToken = '-.'; // ToDO: bikeshed best alternative for an end-of-expansion token
const endExpansionToken = '-+'; // ToDO: bikeshed best alternative for an end-of-expansion token
// const endExpansionToken = '--++'; // ToDO: bikeshed best alternative for an end-of-expansion token

export const portablePathSepReS = '[\\/]';

const DQ = '"';
const SQ = "'";
const DQStringReS = `${DQ}[^${DQ}]*(?:${DQ}|$)`; // double-quoted string (unbalanced at end-of-line is allowed)
const SQStringReS = `${SQ}[^${SQ}]*(?:${SQ}|$)`; // single-quoted string (unbalanced at end-of-line is allowed)
// const DQStringStrictReS = '"[^"]*"'; // double-quoted string (quote balance is required)
// const SQStringStrictReS = "'[^']*'"; // single-quoted string (quote balance is required)

const ANSICStringReS = '[$]' + SQStringReS;

// const pathSepRe = /[\\/]/;
const globChars = ['?', '*', '[', ']'];
const globCharsReS = globChars.map((c) => '\\' + c).join('|');

// const sep = Path.sep;
// const sepReS = Path.SEP_PATTERN;
const sepReS = `[\\\\\\/]`;

const QReS = `[${DQ}${SQ}]`; // double or single quote character
// const nonGlobReS = `(?:(?!${globCharsReS}).)`;
// const nonGlobQReS = `(?:(?!${globCharsReS}|${QReS}).)`;
const nonGlobQSepReS = `(?:(?!${globCharsReS}|${QReS}|${sepReS}).)`;

const cNonQReS = `(?:(?!${QReS}).)`; // non-(double or single)-quote character
const cNonQWSReS = `(?:(?!${QReS}|\\s).)`; // non-quote, non-whitespace character

export function splitByBareWSo(s: string): Array<string> {
	// parse string into tokens separated by unquoted-whitespace
	// * supports both single and double quotes
	// * no character escape sequences are recognized
	// * unbalanced quotes are allowed (parsed as if EOL is a completing quote)
	const arr: Array<string> = [];
	s = s.replace(/^\s+/msu, ''); // trim leading whitespace
	// console.warn('xArgs.splitByBareWSo()', { s });
	const tokenRe = new RegExp(`^((?:${DQStringReS}|${SQStringReS}|${cNonQWSReS}+)*)(.*$)`, 'msu');
	while (s) {
		const m = s.match(tokenRe);
		if (m) {
			arr.push(m[1]);
			s = m[2] ? m[2].replace(/^\s+/msu, '') : ''; // trim leading whitespace
		} else {
			s = '';
		}
		// console.warn({ _: 'splitByBareWSo()', s, m, arr });
	}
	return arr;
}

const WordReS = {
	bareWS: new RegExp(`^((?:${DQStringReS}|${SQStringReS}|${cNonQWSReS}+))(\\s+)?(.*$)`, 'msu'), // == (tokenFragment)(bareWS)?(restOfString),
	quoteBasic: new RegExp(`^((?:${DQStringReS}|${SQStringReS}|${cNonQReS}+))(.*?$)`, 'msu'), // == (tokenFragment)(restOfString)
	quote: new RegExp(
		`^((?:${ANSICStringReS}|${DQStringReS}|${SQStringReS}|${cNonQReS}+))(.*?$)`,
		'msu',
	), // == (tokenFragment)(restOfString)
};

export function shiftCLTextWord(
	s: string,
	options: { autoQuote: boolean } = { autoQuote: true },
): [string, string] {
	// parse string into a token + restOfString separated by unquoted-whitespace
	// * supports both single and double quotes
	// * no character escape sequences are recognized
	// * unbalanced quotes are allowed (parsed as if EOL is a completing quote)
	const { autoQuote } = options;
	const initialS = s;
	// console.warn('xArgs.shiftCLTextWord()', { s, options, initialS });
	s = s.replace(/^\s+/msu, ''); // trim leading whitespace // ToDO: remove? allow leading WS in first token?
	const wordRe = WordReS.bareWS; // == (tokenFragment)(bareWS)?(restOfString)
	let foundFullToken = false;
	let token = '';
	while (s && !foundFullToken) {
		const m = s.match(wordRe);
		if (m) {
			let matchStr = m[1];
			if (matchStr.length > 0) {
				const firstChar = matchStr[0];
				if (firstChar === DQ || firstChar === SQ) {
					// "..." or '...'
					if (autoQuote && matchStr[matchStr.length - 1] !== firstChar) {
						matchStr += firstChar;
					}
					// } else if ((matchStr.length > 1) && firstChar === '$' && matchStr[1] === SQ) {
					// 	// $'...'
					// 	matchStr = decodeANSIC(matchStr.split(SQ)[1]);
				}
			}
			token += matchStr;
			s = m[3] ? m[3].replace(/^\s+/msu, '') : ''; // trim leading whitespace
			if (m[2] || !s) {
				foundFullToken = true;
			}
		} else {
			// possible branch?
			foundFullToken = true;
			token += s;
			s = '';
		}
	}
	assert(!initialS || (s !== initialS), 'non-progression of `shiftCLTextWord()`'); // assert progress has been made o/w panic
	return [token, s];
}

export function wordSplitCLTextByShift(
	s: string,
	options: { autoQuote: boolean } = { autoQuote: true },
): Array<string> {
	// parse string into tokens separated by unquoted-whitespace
	// * supports both single and double quotes
	// * no character escape sequences are recognized
	// * unbalanced quotes are allowed (parsed as if EOL is a completing quote)
	// * note: by bench-test, this (`wordSplitCLTextByShift()`) is approx 10% slower than `wordSplitCLText()` (~3.3µs vs ~2.9µs)
	const arr: Array<string> = [];
	s = s.replace(/^\s+/msu, ''); // trim leading whitespace
	while (s) {
		const [token, restOfString] = shiftCLTextWord(s, options);
		arr.push(token);
		assert(s !== restOfString, 'non-progression of `wordSplitCLTextByShift()`'); // assert progress has been made o/w panic
		s = restOfString;
	}
	return arr;
}

export function wordSplitCLText(
	s: string,
	options: { autoQuote: boolean } = { autoQuote: true },
): Array<string> {
	// parse string into tokens separated by unquoted-whitespace
	// * supports both single and double quotes
	// * no character escape sequences are recognized
	// * unbalanced quotes are allowed (parsed as if EOL is a completing quote)
	const { autoQuote } = options;
	const arr: Array<string> = [];
	s = s.replace(/^\s+/msu, ''); // trim leading whitespace
	// console.warn('xArgs.wordSplitCLText()', { s });
	const wordRe = WordReS.bareWS; // == (tokenFragment)(bareWS)?(restOfString)
	let text = '';
	while (s) {
		const m = s.match(wordRe);
		if (m) {
			let matchStr = m[1];
			if (matchStr.length > 0) {
				const firstChar = matchStr[0];
				if (firstChar === DQ || firstChar === SQ) {
					// "..." or '...'
					if (autoQuote && matchStr[matchStr.length - 1] !== firstChar) {
						matchStr += firstChar;
					}
					// } else if ((matchStr.length > 1) && firstChar === '$' && matchStr[1] === SQ) {
					// 	// $'...'
					// 	matchStr = decodeANSIC(matchStr.split(SQ)[1]);
				}
			}
			text += matchStr;
			s = m[3] ? m[3].replace(/^\s+/msu, '') : ''; // trim leading whitespace
			if (m[2] || !s) {
				arr.push(text);
				text = '';
			}
		} else {
			// possible?
			arr.push(text);
			text = s = '';
		}
	}
	return arr;
}

// spell-checker: ignore ANSIC

// ref: <https://stackoverflow.com/questions/8936984/uint8array-to-string-in-javascript>
// ref: <https://stackoverflow.com/questions/17191945/conversion-between-utf-8-arraybuffer-and-string/22373135>
// ref: <https://stackoverflow.com/questions/13356493/decode-utf-8-with-javascript/22373061>
// ref: <https://flaviocopes.com/javascript-unicode> @@ <https://archive.is/hZMLw>
// ref: <https://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html> @@ <https://archive.is/SeXLl>
// ref: <https://en.wikipedia.org/wiki/Escape_sequences_in_C> @@ <https://archive.is/8OPBU>
// ref: <https://kevin.burke.dev/kevin/node-js-string-encoding> @@ <https://archive.is/JGXQg>
// ref: <https://mathiasbynens.be/notes/javascript-unicode> @@ <https://archive.is/Uqi1y>
// ref: <https://mathiasbynens.be/notes/javascript-encoding> @@ <https://archive.is/yNnof>
// ref: <http://speakingjs.com/es5/ch24.html> @@ <https://archive.is/X7YJf>
// ref: <https://www.whoishostingthis.com/resources/ascii> @@ <https://archive.is/92sIR>
const ANSICDecodeTable: Record<string, string> = {};
ANSICDecodeTable['\\'] = '\\';
ANSICDecodeTable["'"] = "'";
ANSICDecodeTable['?'] = '?';
ANSICDecodeTable['a'] = '\x07';
ANSICDecodeTable['b'] = '\b';
ANSICDecodeTable['e'] = '\x1b';
ANSICDecodeTable['E'] = '\x1b'; // bash-ism
ANSICDecodeTable['f'] = '\f';
ANSICDecodeTable['n'] = '\n';
ANSICDecodeTable['r'] = '\r';
ANSICDecodeTable['t'] = '\t';
ANSICDecodeTable['v'] = '\v';
// control characters
{
	let i;
	const baseCharCode = '@'.charCodeAt(0);
	for (i = 0; i <= 0x1f; i++) {
		const iToChar = String.fromCharCode(baseCharCode + i);
		ANSICDecodeTable['c' + iToChar.toLowerCase()] = ANSICDecodeTable['c' + iToChar.toUpperCase()] =
			String.fromCharCode(i);
	}
	ANSICDecodeTable['c?'] = '\x7f';
}

// console.warn('xArgs', { ANSICDecodeTable });

function decodeANSIC(s: string) {
	// * return value is always a valid UTF-8 string (lossy with 'Replacement Character's, as needed)
	// console.warn('xArgs.decodeANSIC()', { s });
	// note: sequential hex/octal codes are collected as one and then decoded as a UTF-8 string (lossy method using 'Replacement Character')
	s = s.replace(
		// spell-checker:disable-next
		/\\([abeEfnrtv]|c.|u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8}|(?:(?:[0-7]{1,3}|x[0-9a-fA-F]{2})(?:\\([0-7]{1,3}|x[0-9a-fA-F]{2}))*))/gmsu,
		(escapeString) => {
			const escapeCode = escapeString.slice(1);
			const escapeCodeType = escapeCode[0];
			let decoded = '';
			if ((escapeCodeType === 'u') || (escapeCodeType === 'U')) {
				const decodedCharCode = parseInt(escapeCode.slice(1), 16);
				decoded = String.fromCharCode(decodedCharCode);
			} else if ((escapeCodeType === 'x') || (escapeCodeType.match(/[0-9]/))) {
				// hex (`\x..`) or octal (`\nnn`) sequences may result in a non-UTF string
				// * all sequential escapes are collected as one into a Uint8Array and the converted to UTF-8 via a no-error lossy conversion
				const splitSep = '\\';
				const codesText = escapeString.split(splitSep).slice(1);
				const codesRaw = codesText.map((codeText) => {
					const parseBase = (codeText[0] === 'x') ? 16 : 8;
					return parseInt(codeText[0] === 'x' ? codeText.slice(1) : codeText, parseBase);
				});
				const codes = new Uint8Array(codesRaw);
				decoded = new TextDecoder().decode(codes);
				// console.warn('xArgs.decodeANSIC', { escapeString, codesText, codesRaw, codes, decoded });
			} else {
				decoded = ANSICDecodeTable[escapeCode.toLowerCase()];
			}

			// console.warn('xArgs.decodeANSIC()', {
			// 	escapeString,
			// 	escapeCode,
			// 	escapeCodeType,
			// 	decoded: decoded,
			// });

			return decoded ? decoded : escapeString;
		},
	);
	return s;
}

export function reQuote(s: string) {
	// re-quote string protect from later re-expansion
	const specialChars = ['*', '?', '{', '}', '$', "'", '"', '[', ']'];
	const hasSpecialChar = specialChars.find((c) => s.includes(c));
	const hasWhiteSpace = s.match(/\s/msu);
	if (hasSpecialChar || hasWhiteSpace) {
		s = "'" + s.replaceAll("'", '"\'"') + "'";
	}
	return s;
}

export function deQuote(s: string) {
	// de-quote string
	// * supports both single and double quotes
	// * supports ANSI-C quotes
	// * no character escape sequences are recognized
	// * unbalanced quotes are allowed (parsed as if EOL is a completing quote)
	// console.warn('xArgs.deQuote()', { s });
	const tokenRe = WordReS.quote; // == (ANSIC/DQ/SQ/non-Q-tokenFragment)(tailOfString)
	let text = '';
	while (s) {
		const m = s.match(tokenRe);
		if (m) {
			// console.warn('xArgs.deQuote()', { m });
			let matchStr = m[1];
			if (matchStr.length > 0) {
				if (matchStr[0] === DQ || matchStr[0] === SQ) {
					// "..." or '...'
					const qChar = matchStr[0];
					const spl = matchStr.split(qChar);
					matchStr = spl[1];
				} else if ((matchStr.length > 1) && matchStr[0] === '$' && matchStr[1] === SQ) {
					// $'...'
					const spl = matchStr.split(SQ);
					// console.warn('xArgs.deQuote()', { s, matchStr, spl });
					matchStr = decodeANSIC(spl[1]);
				}
			}
			text += matchStr;
			s = m[2]; // (tailOfString)
		} else {
			text += s;
			s = '';
		}
	}
	return text;
}

export function tildeExpand(s: string): string {
	// tilde expand a string
	// * any leading whitespace is removed
	// ToDO?: handle `~USERNAME` for other users
	s = s.replace(/^\s+/msu, ''); // trim leading whitespace
	// console.warn('xArgs.tildeExpand()', { s });
	// const sepReS = portablePathSepReS;
	const username = Deno.env.get('USER') || Deno.env.get('USERNAME') || '';
	const usernameReS = username.replace(/(.)/gmsu, '\\$1');
	const caseSensitive = !isWinOS;
	const re = new RegExp(`^\s*(~(?:${usernameReS})?)(${sepReS}|$)(.*)`, caseSensitive ? '' : 'i');
	const m = s.match(re);
	if (m) {
		s = OSPaths.home() + (m[2] ? m[2] : '') + (m[3] ? m[3] : '');
	}
	return s;
}

export function shellExpand(_s: string): Array<string> {
	throw 'unimplemented';
}

function escapeRegExp(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export type FilenameExpandOptions = { nullglob: boolean };
export async function* filenameExpandIter(
	s: string,
	options: FilenameExpandOptions = { nullglob: false },
): AsyncIterableIterator<string> {
	// filename (glob) expansion
	const parsed = parseGlob(s);

	// console.warn('xArgs.filenameExpandIter()', { parsed });

	let found = false;
	if (parsed.glob) {
		const resolvedPrefix = Path.resolve(parsed.prefix);
		// console.warn('xArgs.filenameExpandIter()', { parsed, resolvedPrefix });
		if (await exists(resolvedPrefix)) {
			// normalize prefix to have a trailing separator
			const normalizedPrefix = resolvedPrefix +
				(resolvedPrefix.endsWith('/') || resolvedPrefix.endsWith('\\') ? '' : Path.SEP);
			const globEscapedPrefix = escapeRegExp(normalizedPrefix).replace(/\\\\|\//g, '[\\\\/]');
			// some paths are resolved to paths with trailing separators (eg, network paths) and some are not
			// const trailingSep = globEscapedPrefix.endsWith('[\\\\/]');
			// deno-lint-ignore no-explicit-any
			const maxDepth: number = (parsed.globScanTokens as unknown as any).reduce(
				(acc: number, value: { value: string; depth: number; isGlob: boolean }) =>
					acc + (value.isGlob ? value.depth : 0),
				0,
			);
			const re = new RegExp(
				'^' + globEscapedPrefix + parsed.globAsReS + '$',
				isWinOS ? 'imsu' : 'msu',
			);
			// console.warn('xArgs.filenameExpandIter()', { normalizedPrefix, globEscapedPrefix, maxDepth, re });
			// note: `walk` match re is compared to the full path during the walk
			const walkIt = walk(resolvedPrefix, { match: [re], maxDepth: maxDepth ? maxDepth : 1 });
			for await (const e of walkIt) {
				const p = e.path.replace(new RegExp('^' + globEscapedPrefix), '');
				if (p) {
					found = true;
					yield Path.join(parsed.prefix, p);
				}
			}
		}
	}

	if (!found && !options.nullglob) {
		yield s;
	}
}

export function* filenameExpandIterSync(
	s: string,
	options: FilenameExpandOptions = { nullglob: false },
) {
	// filename (glob) expansion
	const parsed = parseGlob(s);

	// console.warn('xArgs.filenameExpandIter()', { parsed });

	let found = false;
	if (parsed.glob) {
		const resolvedPrefix = Path.resolve(parsed.prefix);
		// console.warn('xArgs.filenameExpandIter()', { parsed, resolvedPrefix });
		if (existsSync(resolvedPrefix)) {
			// normalize prefix to have a trailing separator
			const normalizedPrefix = resolvedPrefix +
				(resolvedPrefix.endsWith('/') || resolvedPrefix.endsWith('\\') ? '' : Path.SEP);
			const globEscapedPrefix = escapeRegExp(normalizedPrefix).replace(/\\\\|\//g, '[\\\\/]');
			// some paths are resolved to paths with trailing separators (eg, network paths) and some are not
			// const trailingSep = globEscapedPrefix.endsWith('[\\\\/]');
			// deno-lint-ignore no-explicit-any
			const maxD = (parsed.globScanTokens as unknown as any).reduce(
				(acc: number, value: { value: string; depth: number; isGlob: boolean }) =>
					acc + (value.isGlob ? value.depth : 0),
				0,
			);
			const re = new RegExp(
				'^' + globEscapedPrefix + parsed.globAsReS + '$',
				isWinOS ? 'imsu' : 'msu',
			);
			// console.warn('xArgs.filenameExpandIter()', { normalizedPrefix, globEscapedPrefix, maxD, re });
			// note: `walkSync` match re is compared to the full path during the walk
			const walkIt = walkSync(resolvedPrefix, { match: [re], maxDepth: maxD ? maxD : 1 });
			for (const e of walkIt) {
				const p = e.path.replace(new RegExp('^' + globEscapedPrefix), '');
				if (p) {
					found = true;
					yield Path.join(parsed.prefix, p);
				}
			}
		}
	}

	if (!found && !options.nullglob) {
		yield s;
	}
}

export async function filenameExpand(
	s: string,
	options: FilenameExpandOptions = { nullglob: false },
) {
	// filename (glob) expansion
	const arr = [];
	for await (const e of filenameExpandIter(s, options)) {
		arr.push(e);
	}
	return arr;
}
export function filenameExpandSync(
	s: string,
	options: FilenameExpandOptions = { nullglob: false },
) {
	// filename (glob) expansion
	const arr = [];
	for (const e of filenameExpandIterSync(s, options)) {
		arr.push(e);
	}
	return arr;
}

function pathToPosix(p: string) {
	return p.replace(/\\/g, '/');
}
// function pathToWindows(p: string) {
// 	return p.replace(/\//g, '\\');
// }

// ToDO: handle long paths, "\\?\...", and UNC paths
// ref: [1][MSDN - Windows: Naming Files, Paths, and Namespaces] http://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx @@ https://archive.today/DgH7i

export function parseGlob(s: string) {
	// options.os => undefined (aka portable), 'windows', 'posix'/'linux'
	const options: { os?: string } = {};
	let prefix = '';
	let glob = '';

	// console.warn('xArgs.parseNonGlobPathPrefix()', { globCharsReS, SEP: Path.SEP, SEP_PATTERN: Path.SEP_PATTERN });

	// for 'windows' or portable, strip any leading `\\?\` as a prefix
	if (!options.os || options.os === 'windows') {
		const m = s.match(/^(\\\\\?\\)(.*)/);
		if (m) {
			prefix = m[1] ? m[1] : '';
			s = m[2] ? m[2] : '';
		}
	}

	const re = new RegExp(
		`^((?:${DQStringReS}|${SQStringReS}|${nonGlobQSepReS}+)*(?:${sepReS}+|$))(.*$)`,
	);
	// console.warn('xArgs.parseGlob()', { re });
	while (s) {
		const m = s.match(re);
		// console.warn('xArgs.parseGlob()', { s, m });
		if (m) {
			prefix += m[1] ? m[1] : '';
			glob = m[2];
			s = m[1] && m[2] ? m[2] : '';
		} else {
			glob = s || '';
			s = '';
		}
		// console.warn('xArgs.parseGlob()', { prefix, glob });
	}

	const pJoin = Path.join(prefix, glob);
	const pJoinToPosix = pathToPosix(pJoin);
	// console.warn('xArgs.parseGlob()',
	//  {
	// 	prefix,
	// 	glob,
	// 	pJoin,
	// 	pJoinToPosix,
	// 	pJoinParsed: Path.parse(pJoin),
	// 	pJoinToPosixParsed: Path.parse(pJoinToPosix),
	// });
	const globAsReS = glob && globToReS(glob);
	// console.warn('xArgs.parseGlob()', { globAsReS });
	// const globScan: any = Picomatch.scan(Path.join(prefix, glob), {
	// console.warn('xArgs.parseGlob()', { prefix, glob, pathJoin: Path.posix.join(prefix, glob) });
	// * 'picomatch' has incomplete typing => ignore no-explicit-any
	// deno-lint-ignore no-explicit-any
	const globScan: any = Picomatch.scan(pJoinToPosix, {
		windows: true,
		dot: false,
		nobrace: true,
		noquantifiers: true,
		posix: true,
		nocase: isWinOS,
		tokens: true,
		parts: true,
	});
	const globScanTokens = globScan.tokens;
	const globScanSlashes = globScan.slashes;
	const globScanParts = globScan.parts;
	// const globParsed = Picomatch.scan(glob, {
	// 	windows: true,
	// 	dot: false,
	// 	nobrace: true,
	// 	noquantifiers: true,
	// 	posix: true,
	// 	nocase: isWinOS,
	// 	tokens: true,
	// });
	// const globParsedTokens = ((globParsed as unknown) as any).tokens;
	// const globParsedParts = ((globParsed as unknown) as any).parts;

	return {
		prefix,
		glob,
		globAsReS,
		globScan,
		globScanTokens,
		globScanSlashes,
		globScanParts,
		// globParsed,
		// globParsedTokens,
		// globParsedParts,
	};
}

export function globToReS(s: string) {
	const tokenRe = new RegExp(`^((?:${DQStringReS}|${SQStringReS}|${cNonQReS}+))(.*?$)`, '');
	let text = '';
	while (s) {
		const m = s.match(tokenRe);
		if (m) {
			let matchStr = m[1];
			if (matchStr.length > 0) {
				const firstChar = matchStr[0];
				if (firstChar === DQ || firstChar === SQ) {
					// "..." or '...' => de-quote and `[.]` escape any special characters
					const spl = matchStr.split(firstChar);
					matchStr = spl[1];
					// * `[.]` escape glob characters
					matchStr = matchStr.replace(/([?*\[\]])/gmsu, '[$1]');
				}
			}
			text += matchStr;
			s = m[2];
		}
	}
	// convert PATTERN to POSIX-path-style by replacing all backslashes with slashes (backslash is *not* used as an escape)
	text = text.replace(/\\/g, '/');

	// console.warn('xArgs.globToReS()', { text });

	// windows = true => match backslash and slash as path separators
	const parsed = Picomatch.parse(text, {
		windows: true,
		dot: false,
		nobrace: true,
		noquantifiers: true,
		posix: true,
		nocase: isWinOS,
	});
	// console.warn('xArgs.globToReS()', { parsed });
	// deno-lint-ignore no-explicit-any
	return ((parsed as unknown) as any).output as string;
}

export type ArgsOptions = { nullglob: boolean };

// `args()`
/** parse (if needed) and 'shell'-expand argument string(s)

- Performs `bash`-like expansion (compatible with the Bash v4.3 specification).
- Quotes (single or double) are used to protect braces, tildes, and globs from expansion;
	unbalanced quotes are allowed (and parsed as if completed by the end of the string).
  Otherwise, no character escape sequences are recognized.
- Brace expansion is fully implemented (including nested braces and ["brace bomb"](https://github.com/micromatch/braces/blob/master/README.md#brace-matching-pitfalls) protections).
- Glob expansion supports `globstar` and full extended glob syntax.

Uses the [*braces*](https://github.com/micromatch/braces) and [*picomatch*](https://github.com/micromatch/picomatch) JS modules.

@returns Iterator of argument expansions (possibly empty)
@example
```js
const argsText = '{.,}* "text string" ./src/file_{1..10..2}_*.ts';
const expansion: string[] = args(argsText);
```
*/
export function args(argsText: string | string[], options: ArgsOptions = { nullglob: false }) {
	const arr = Array.isArray(argsText) ? argsText : wordSplitCLText(argsText);
	const idx = arr.findIndex((v) => v === endExpansionToken);
	const expand = arr.length ? (arr.slice(0, (idx < 0 ? undefined : (idx + 1)))) : [];
	const raw = (arr.length && (idx > 0) && (idx < arr.length)) ? arr.slice(idx + 1) : [];
	// console.warn('xArgs.args()', { arr, idx, expand, raw });
	return expand
		.flatMap(Braces.expand)
		.map(tildeExpand)
		.flatMap((e) => filenameExpandSync(e, options))
		.map(deQuote)
		.concat(raw);
}

export type ArgIncrement = {
	arg: string;
	tailOfArgExpansion: AsyncIterableIterator<string>[];
	tailOfArgsText: string;
};
export type ArgIncrementSync = {
	arg: string;
	tailOfArgExpansion: string[][];
	tailOfArgsText: string;
};

// `argsIt`
/** incrementally parse and 'shell'-expand argument text; returning a lazy iterator of ArgIncrementSync's

- Performs `bash`-like expansion (compatible with the Bash v4.3 specification).
- Quotes (single or double) are used to protect braces, tildes, and globs from expansion;
	unbalanced quotes are allowed (and parsed as if completed by the end of the string).
  Otherwise, no character escape sequences are recognized.
- Brace expansion is fully implemented (including nested braces and "brace bomb" protections).
- Glob expansion supports `globstar` and full extended glob syntax.

Uses the [*braces*](https://github.com/micromatch/braces) and [*picomatch*](https://github.com/micromatch/picomatch) JS modules.

@returns Iterator of expansions with corresponding remaining argument string (ie, `[arg, restOfArgS]`)
@example
```js
// eg, for `deno`, `dxr`, `env`, `xargs`, ...
const argsText = '--processOptions ... targetExecutable {.,}* "text*string" ./src/file_{1..10..2}_*.ts';
const argIt = argsIt(argsText);
const processArgs = [];
let targetArgsText = '';
let options = null;
for await (const [arg, restOfArgsText] in argIt) {
	processArgs.push(arg);
	options = getOptions(processArgs);
	if (options.targetExecutable) {
		targetArgsText = restOfArgsText;
		break;
	}
}
if (options.targetExecutable) {
	// run `targetExecutable` with `targetArgsText` (un-processed argument text)
}
```
*/
export async function* argsIt(
	argsText: string,
	options: ArgsOptions = { nullglob: false },
): AsyncIterableIterator<ArgIncrement> {
	let continueExpansions = true;
	while (argsText) {
		let argText = '';
		[argText, argsText] = shiftCLTextWord(argsText);
		if (argText === endExpansionToken) continueExpansions = false;
		const argExpansions = continueExpansions
			? [argText].flatMap(Braces.expand).map(tildeExpand).map((e) => filenameExpandIter(e, options))
			: [(async function* () {
				yield argText;
			})()];
		for (let idx = 0; idx < argExpansions.length; idx++) {
			const argExpansion = argExpansions[idx];
			let current = await argExpansion.next();
			while (!current.done) {
				const next = await argExpansion.next();
				// const tail = [argExpansion]
				yield {
					arg: deQuote(current.value),
					tailOfArgExpansion: [
						...(!next.done
							? [(async function* () {
								yield next.value;
								for await (const e of argExpansion) yield e;
							})()]
							: []),
						...argExpansions.slice(idx + 1),
					],
					tailOfArgsText: argsText,
				};
				current = next;
			}
		}
	}
}
// `argItSync`
export function* argsItSync(
	argsText: string,
	options: ArgsOptions = { nullglob: false },
): IterableIterator<ArgIncrementSync> {
	const continueExpansions = false;
	while (argsText) {
		let argText = '';
		[argText, argsText] = shiftCLTextWord(argsText);
		// if (argText === endExpansionToken) continueExpansions = false;
		const argExpansions = continueExpansions
			? [argText].flatMap(Braces.expand).map(tildeExpand).map((e) => filenameExpandSync(e, options))
			: [[argText]];
		for (let idx = 0; idx < argExpansions.length; idx++) {
			const argExpansion = argExpansions[idx];
			for (let jdx = 0; jdx < argExpansion.length; jdx++) {
				yield {
					arg: deQuote(argExpansion[jdx]),
					tailOfArgExpansion: [argExpansion.slice(jdx + 1), ...argExpansions.slice(idx + 1)],
					tailOfArgsText: argsText,
				};
			}
		}
	}
}
