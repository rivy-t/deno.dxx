// spell-checker:ignore (jargon) distro falsey truthy
// spell-checker:ignore (js/ts) gmsu
// spell-checker:ignore (names) Alacritty Cmder ConEmu Deno EditorConfig
// spell-checker:ignore (modules) stringz
// spell-checker:ignore (yargs) positionals

import { $cliffyTable, $colors, $fs, $path } from './$deps.ts';

//===

import * as $consoleSize from './consoleSize.ts';

//===

export const projectName: string | undefined = 'dxx';
export const VERSION = '0.0.12';

// FixME: revise `projectURL` for bundled/compiled scripts which are not embedded within surrounding projects, ie, where `projectURL` would be nonsensical
export const projectURL = new URL('../..', import.meta.url); // note: `new URL('.', ...)` => dirname(...); `new URL('..', ...) => dirname(dirname(...))
export const projectPath =
	((url: URL) => (url.protocol === 'file:') ? $path.fromFileUrl(url) : url.pathname)(projectURL);
export const projectLocations = {
	benchmarks: $path.join(projectPath, 'bench'),
	editorconfig: $path.join(projectPath, '.editorconfig'),
	examples: $path.join(projectPath, 'eg'),
	readme: $path.join(projectPath, 'README.md'),
	source: $path.join(projectPath, 'src'),
	tests: $path.join(projectPath, 'tests'),
	vendor: $path.join(projectPath, 'vendor'),
	version: $path.join(projectPath, 'VERSION'),
};

// // ToDO: investigate best practice for portability of PATH_SEP_PATTERN // note: WinOS => /[\\/]+/ ; *nix => /\/+/
// // * currently, treating paths as WinOS-compatible with both backslash and forward-slash as path separators (on both WinOS and *nix platforms)
// export const PATH_SEP_PATTERN = /[\\/]+/;

//===

/** Host platform is a Windows OS. */
export const isWinOS = Deno.build.os === 'windows';

// ref: <https://medium.com/deno-the-complete-reference/textencoder-and-textdecoder-in-deno-cfca83be1792> @@ <https://archive.is/tO0rE>
// export { decode, encode } from 'https://deno.land/std@0.85.0/encoding/utf8.ts'; // 'utf8.ts' was removed via commit 5bc18f5d86
export const decoder = new TextDecoder(); // default == 'utf=8'
export const encoder = new TextEncoder(); // *always* 'utf-8'
export const decode = (input?: Uint8Array): string => decoder.decode(input);
export const encode = (input?: string): Uint8Array => encoder.encode(input);

//===

const DQ = '"';
const SQ = "'";

// const DQStringReS = `${DQ}[^${DQ}]*(?:${DQ}|$)`; // double-quoted string (unbalanced at end-of-line is allowed)
// const SQStringReS = `${SQ}[^${SQ}]*(?:${SQ}|$)`; // single-quoted string (unbalanced at end-of-line is allowed)
// const DQStringStrictReS = '"[^"]*"'; // double-quoted string (quote balance is required)
// const SQStringStrictReS = "'[^']*'"; // single-quoted string (quote balance is required)

const deDQStringReS = `${DQ}([^${DQ}]*)(?:${DQ}|$)`; // sub-match/extractor for contents of double-quoted string (unbalanced at end-of-line is allowed)
const deSQStringReS = `${SQ}([^${SQ}]*)(?:${SQ}|$)`; // sub-match/extractor for contents of single-quoted string (unbalanced at end-of-line is allowed)

const deQuoteRx = new RegExp(`([^${DQ}${SQ}]+)|${deDQStringReS}|${deSQStringReS}`, 'gmsu');

// `deQuote()`
/** Remove quotes from text string (`s`). */
export function deQuote(s?: string) {
	if (!s) return s;
	return s.replace(deQuoteRx, '$1$2$3');
}

//===

// `env()`
/** Return the value of the environment variable `varName`; `undefined` if non-existent or not-allowed access (ie, *non-throwing*) */
export function env(varName: string) {
	try {
		return Deno.env.get(varName);
	} catch (_) {
		return undefined;
	}
}

//===

// `isFileURL()`
/** Determine if `url` is a file-type URL (ie, uses the 'file:' protocol), naming a local file resource. */
export function isFileURL(url: URL) {
	return (url.protocol === 'file:');
}

// `isValidURL()`
/** Determine if the supplied text string (`s`) is a valid URL. */
export function isValidURL(s: string, base: URL = $path.toFileUrl(Deno.cwd() + $path.SEP)) {
	return !!validURL(s, base);
}

// `validURL()`
/** Convert the supplied text string (`s`) into a valid URL (or `undefined` if `s` [relative to `base`] isn't a valid URL). */
export function validURL(s: string, base: URL = $path.toFileUrl(Deno.cwd() + $path.SEP)) {
	return intoURL(s, base);
}

//===

// `intoPath()`
/** Extract a path string from a path string (as an identity function) or URL. */
export function intoPath(path?: string | URL) {
	if (!(path instanceof URL)) return path;
	return (path.protocol === 'file:') ? $path.fromFileUrl(path) : path.pathname;
}

// ref: <https://en.wikipedia.org/wiki/Uniform_Resource_Identifier> , <https://stackoverflow.com/questions/48953298/whats-the-difference-between-a-scheme-and-a-protocol-in-a-url>
export type IntoUrlOptions = {
	driveLetterSchemes?: boolean; // interpret single letter URL schemes as drive letters for Windows-style paths
};
const IntoUrlOptionsDefault: Required<IntoUrlOptions> = { driveLetterSchemes: true };

// `intoURL()`
/** Convert a `path` string into an URL, relative to a `base` reference URL.
@param [path]
@param [base] • baseline URL reference point ~ defaults to `$path.toFileUrl(Deno.cwd()+$path.SEP)`; _note_: per usual relative URL rules, if `base` does not have a trailing separator, determination of path is relative the _the parent of `base`_
@param [options] ~ defaults to `{driveLetterSchemes: true}`
*/
export function intoURL(path?: string, base?: URL, options?: IntoUrlOptions): URL | undefined;
export function intoURL(path: string, options: IntoUrlOptions): URL | undefined;
export function intoURL(path?: string, ...args: unknown[]) {
	if (path == undefined) return undefined;
	const base = (args?.length > 0 && (args[0] instanceof URL))
		? args.shift() as URL
		: $path.toFileUrl(Deno.cwd() + $path.SEP);
	const options = {
		...IntoUrlOptionsDefault,
		...(args?.length > 0) ? args.shift() as IntoUrlOptions : {},
	};
	const scheme = (path.match(/^[A-Za-z][A-Za-z0-9+-.]*(?=:)/) || [])[0]; // per [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986#section-3.1) @@ <https://archive.md/qMjTD#26.25%>
	if (options.driveLetterSchemes && scheme?.length == 1) {
		path = 'file://' + $path.normalize(path);
	}
	// normalize slashes ~ replace all double-slashes with singles except for leading (for WinOS network paths) and those following schemes
	path = path.replaceAll('\\', '/').replaceAll(/(?<!^|[A-Za-z][A-Za-z0-9+-.]*:\/?)\/\/+/gmsu, '/');
	// console.warn({ path, base, options });
	try {
		return new URL(path, base);
	} catch (_error) {
		return undefined;
	}
}

//===

// `traversal()`
/** Determine the traversal path to `goal` from `base`.
- _Returned path will be relative to `base` iff `goal` shares a common origin/prefix with `base`, o/w it will be an absolute path_
- _Relative `goal` or `base` paths are evaluated as relative to the `Deno.cwd()` directory_
@param [goal] • target path
@param [base] • starting path ~ defaults to `$path.toFileUrl(Deno.cwd()+$path.SEP)`; _note_: per usual relative URL rules, if `base` does not have a trailing separator, determination of path is relative the _the parent of `base`_
*/
export function traversal(
	goal: string | URL,
	base: string | URL = $path.toFileUrl(Deno.cwd() + $path.SEP),
) {
	const url = (goal instanceof URL) ? goal : intoURL(goal);
	const baseURL = (base instanceof URL) ? base : intoURL(base);
	const commonOrigin = url && baseURL &&
		(url.origin.localeCompare(baseURL.origin, undefined, { sensitivity: 'accent' }) == 0);
	// console.warn({ goal, source, url, baseURL, commonOrigin });
	if (url && baseURL && commonOrigin) {
		return decodeURIComponent($path.relative(baseURL.pathname, url.pathname));
	} else {
		return url ? decodeURIComponent(url.href) : undefined;
	}
}

//===

export type Truthy = false | string;
// isFalsey()
function _isFalsey(s: string): boolean {
	return !isTruthy(s);
}
// isTruthy()
export function isTruthy(s: string): boolean {
	if ((s == '') || (s == 'f') || (s == 'false') || (s == 'no') || (s == 'off')) {
		return false;
	}
	return true;
}
// toTruthy()
export function toTruthy(
	s?: string,
	falseyValues: string[] = ['', 'f', 'false', 'n', 'no', 'off'],
): Truthy {
	if (!s || falseyValues.includes(s)) {
		return false;
	}
	return s;
}

//===

// ToDO: investigate [`stringz`](https://github.com/sallar/stringz)

// ref: <https://coolaj86.com/articles/how-to-count-unicode-characters-in-javascript> @@ <https://archive.is/5nzNP>
// ref: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length#unicode> @@ <https://archive.is/DdIu6>
// ToDO: benchmark `getCharacterLength()` vs `s.length()`
export function getCharacterLength(s: string) {
	// The string iterator that is used here iterates over characters, not mere UTF-16 code units
	return [...s].length;
}

export function toCommonCase(s: string) {
	return s.toLocaleLowerCase();
}

//===

function existsSync(path: string) {
	try {
		return $fs.existsSync(path);
	} catch {
		return false;
	}
}

export function firstPathContaining(goal: string, paths: string[]) {
	for (const path of paths) {
		const p = $path.join(path, goal);
		if (existsSync(p)) return path;
	}
}

// function _firstExisting(base: string, paths: string[]) {
// 	for (const path of paths) {
// 		const p = $path.join(path, base);
// 		if (existsSync(p)) return p;
// 	}
// }

// function pathToPOSIX(path: string) {
// 	// normalize to POSIX-type separators (forward slashes)
// 	return path.replaceAll('\\', '/');
// }

// function pathNormalizeSlashes(path: string) {
// 	// normalize to POSIX-type separators (forward slashes)
// 	// * replace all doubled-slashes with singles except for leading (for WinOS network paths) and those following schemes
// 	// * note: 'scheme' is defined per [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986#section-3.1) @@ <https://archive.md/qMjTD#26.25%>
// 	return path.replaceAll(/(?<!^|[A-Za-z][A-Za-z0-9+-.]*:\/?)([\\\/])[\\\/]+/gmsu, '$1');
// }

export function pathEquivalent(a?: string, b?: string) {
	// console.warn({ a, b });
	// console.warn({ aURL: intoURL(a), bURL: intoURL(b) });
	return (a === b) || (intoURL(a)?.href === intoURL(b)?.href);
}
//===

export async function restyleYargsHelp(helpText: string, options?: { consoleWidth: number }) {
	// performance.mark('restyleYargsHelp():start');
	const Cell: typeof $cliffyTable.Cell = $cliffyTable.Cell;
	const Table: typeof $cliffyTable.Table = $cliffyTable.Table;
	// FixME: [2021-11-22; rivy] function needs significant cleanup of technical debt and refactoring for general use
	const optionTextIndentSize = 2;
	const endOfLinePadding = 1;
	const border = false;
	const maxWidth = options?.consoleWidth ?? (await $consoleSize.consoleSize())?.columns ?? 80; // `consoleSize()` may take ~ 150 ms if fallback to shell scripts are needed
	const maxWidths = [maxWidth / 6, 1, 1, maxWidth / 6, 1, 3 * maxWidth / 6];
	const minWidths = [4, 0, 0, 8, 0, 3 * maxWidth / 6];
	const sectionTable = new Table()
		.maxColWidth(maxWidths)
		.minColWidth(minWidths)
		.border(border)
		.padding(0)
		.indent(optionTextIndentSize - 1);
	// performance.mark('restyleYargsHelp():helpLines:start');
	const helpLines = helpText.replace(/\r?\n$/, '').split(/\r?\n/);
	// performance.mark('restyleYargsHelp():helpLines:stop');
	// logger.trace(durationText('restyleYargsHelp():helpLines'));
	// console.warn({ helpLines });
	const help: string[] = [];
	const titleLine = helpLines.shift();
	if (titleLine == undefined) return [];
	// 1st line == name + version
	help.push($colors.italic(titleLine));
	while ((helpLines.length > 0) && helpLines[0].length === 0) {
		help.push(helpLines.shift() as string);
	}
	// console.warn({ helpLines, help });
	let state: undefined | 'arguments' | 'examples' | 'options' | 'other' = 'other';
	// performance.mark(`restyleYargsHelp():linesOfHelpLines:start`);
	const lineRegExp = {
		// :sad: ... no change to execution speed by using "precompiled" regexps
		// *However*, NOT using unicode-flagged regexps ... 100 ms => 5 ms total rendering time
		// unicode case folding is *expensive*, avoid it!; ref: <http://www.guido-flohr.net/unicode-regex-pitfalls> @@ <https://archive.is/szfPd>
		// ref: <https://mathiasbynens.be/notes/es6-unicode-regex> @@ <https://archive.md/cJYO2>
		sectionHeader: new RegExp(/^\S.*:$/u),
		sectionArguments: new RegExp(/^(?:arguments|positionals):$/i),
		sectionExamples: new RegExp(/^examples:$/i),
		sectionOptions: new RegExp(/^options:$/i),
		sectionArgumentsLines: new RegExp(/^\s*(\S+)\s+(.*)$/mu),
		sectionExamplesLines: new RegExp(/^\s*(\S.*?)\s\s+(.*)$/u),
		sectionOptionsLines: new RegExp(/^\s+(-.*?)(\s\s+)([\S\s]*?)(\s+)((?:\s?\[.*?\])+)$/mu),
	};
	for (const line of helpLines) {
		// const initialState: typeof state = state;
		// console.warn({ length: line.length, line });
		if (line.length === 0) {
			if (sectionTable.length) {
				// performance.mark(`restyleYargsHelp():renderTable(${initialState})`);
				// console.warn(`render table for ${initialState}`, { sectionTable });
				let realMaxWidths = sectionTable.getMaxColWidth();
				let realMinWidths = sectionTable.getMinColWidth();
				// console.warn({ realMaxWidths, realMinWidths });
				let tableLines = sectionTable.toString().split(/\r?\n/);
				// console.warn({ tableLines });
				const maxLineLength = (() => {
					let max = 0;
					for (const line of tableLines) {
						const arrOfChars = [...$colors.stripColor(line)];
						max = (arrOfChars.length > max) ? arrOfChars.length : max;
					}
					return max;
				})();
				if (maxLineLength < maxWidth) {
					if (Array.isArray(realMaxWidths)) {
						realMaxWidths = [...realMaxWidths];
						realMaxWidths[realMaxWidths.length - 1] += maxWidth - maxLineLength - endOfLinePadding;
						if (Array.isArray(realMinWidths)) {
							realMinWidths = [...realMinWidths];
							realMinWidths[realMinWidths.length - 1] = realMaxWidths[realMaxWidths.length - 1];
						}
						tableLines = sectionTable
							.maxColWidth(realMaxWidths, true)
							.minColWidth(realMinWidths, true)
							.toString()
							.split(/\r?\n/);
					}
				}
				// console.warn({ tableLines });
				help.push(...tableLines.filter(Boolean).filter((s) => s.match(/\S/)));
				sectionTable.length = 0;
				sectionTable.maxColWidth(maxWidths, true).minColWidth(minWidths, true);
				// performance.mark(`restyleYargsHelp():renderTable(${initialState})`);
				// await logger.trace(durationText(`restyleYargsHelp():renderTable(${initialState})`));
				// performance.clearMarks(`restyleYargsHelp():renderTable(${initialState})`);
			}
			help.push('');
			continue;
		}
		if (line.match(lineRegExp.sectionHeader)) {
			// section header
			// console.warn(`new section`);
			if (line.match(lineRegExp.sectionArguments)) {
				state = 'arguments';
			} else if (line.match(lineRegExp.sectionExamples)) {
				state = 'examples';
			} else if (line.match(lineRegExp.sectionOptions)) {
				state = 'options';
			} else state = 'other';
			help.push($colors.dim($colors.italic(line)));
			continue;
		}
		if (state === 'arguments') {
			const matchOption = line.match(lineRegExp.sectionArgumentsLines);
			if (matchOption == null) {
				help.push(line);
			} else {
				const [_s, item, desc] = matchOption as RegExpMatchArray;
				// console.warn(state, s, item, desc);
				sectionTable.push([
					Cell.from(item).colSpan(1),
					Cell.from('').colSpan(1),
					Cell.from(desc).colSpan(4),
				]);
			}
			continue;
		}
		if (state === 'examples') {
			const matchOption = line.match(lineRegExp.sectionExamplesLines);
			if (matchOption == null) {
				if (line.match(/^\s+/)) {
					sectionTable.push([Cell.from(line.replace(/^\s*/, '')).colSpan(6)]);
				} else help.push(line);
			} else {
				const [_s, item, desc] = matchOption as RegExpMatchArray;
				// console.warn({ state, line, _s, item, desc });
				sectionTable.push([Cell.from(item).colSpan(6)], [
					Cell.from('').colSpan(1),
					Cell.from('*').colSpan(1),
					Cell.from(desc).colSpan(4),
				]);
			}
			continue;
		}
		if ((state === 'options') || (state === 'other')) {
			const matchOption = line.match(lineRegExp.sectionOptionsLines);
			if (matchOption == null) {
				help.push(line);
			} else {
				const [_s, item, _sep, desc, _sep2, info] = matchOption as RegExpMatchArray;
				const i = info.replace(
					/\[(.*?)\]/g,
					(_: string, content: string) => $colors.dim(`{${content}}`),
				);
				if ((item.length > (maxWidth / 6)) || (info.length > (maxWidth / 6))) {
					sectionTable.push([Cell.from(item).colSpan(6)], [
						Cell.from('').colSpan(1),
						Cell.from(i).colSpan(5),
					], [Cell.from('').colSpan(1), Cell.from('*').colSpan(1), Cell.from(desc).colSpan(4)]);
				} else {
					sectionTable.push([
						Cell.from(item).colSpan(1),
						Cell.from('').colSpan(1),
						Cell.from(i).colSpan(2),
						Cell.from('*').colSpan(1),
						Cell.from(desc).colSpan(1),
					]);
				}
			}
			continue;
		}
	}
	// performance.mark(`restyleYargsHelp():linesOfHelpLines:stop`);
	// logger.trace(durationText('restyleYargsHelp():linesOfHelpLines'));
	if (sectionTable.length > 0) {
		let realMaxWidths = sectionTable.getMaxColWidth();
		let realMinWidths = sectionTable.getMinColWidth();
		// console.warn({ realMaxWidths, realMinWidths });
		let tableLines = sectionTable.toString().split(/\r?\n/);
		// console.warn({ tableLines });
		const maxLineLength = (() => {
			let max = 0;
			for (const line of tableLines) {
				const arrOfChars = [...$colors.stripColor(line)];
				max = (arrOfChars.length > max) ? arrOfChars.length : max;
			}
			return max;
		})();
		if (maxLineLength < maxWidth) {
			if (Array.isArray(realMaxWidths)) {
				realMaxWidths = [...realMaxWidths];
				realMaxWidths[realMaxWidths.length - 1] += maxWidth - maxLineLength - endOfLinePadding;
				if (Array.isArray(realMinWidths)) {
					realMinWidths = [...realMinWidths];
					realMinWidths[realMinWidths.length - 1] = realMaxWidths[realMaxWidths.length - 1];
				}
				tableLines = sectionTable
					.maxColWidth(realMaxWidths, true)
					.minColWidth(realMinWidths, true)
					.toString()
					.split(/\r?\n/);
			}
		}
		// console.warn({ tableLines });
		help.push(...tableLines.filter(Boolean).filter((s) => s.match(/\S/)));
		help.push('');
		sectionTable.length = 0;
		sectionTable.maxColWidth(maxWidths, true).minColWidth(minWidths, true);
	}

	// performance.mark('restyleYargsHelp():stop');
	// logger.trace(durationText('restyleYargsHelp()'));
	return help.join('\n');
}

//===

// ref: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat>
export function formatDuration(
	durationInMS: number,
	options: Intl.NumberFormatOptions = { minimumFractionDigits: 3, maximumFractionDigits: 5 },
): string {
	const [unit, n] = (durationInMS > 1000) ? ['s', durationInMS / 1000] : ['ms', durationInMS];
	return (new Intl.NumberFormat(undefined, options).format(n)) + ' ' + unit;
}
export function formatN(
	n: number,
	options: Intl.NumberFormatOptions = { minimumFractionDigits: 3, maximumFractionDigits: 5 },
): string {
	return (new Intl.NumberFormat(undefined, options).format(n));
}

export function durationText(tag: string): string | undefined {
	try {
		const performanceEntries = (() => {
			let entries = performance.getEntriesByName(tag, 'mark');
			if (entries.length > 1) return entries;
			entries = entries.concat(performance.getEntriesByName(tag + ':begin'));
			entries = entries.concat(performance.getEntriesByName(tag + ':start'));
			entries = entries.concat(performance.getEntriesByName(tag + ':end'));
			entries = entries.concat(performance.getEntriesByName(tag + ':stop'));
			if (entries.length > 1) return entries;
			return undefined;
		})();
		if ((performanceEntries == undefined) || performanceEntries.length < 2) return undefined;
		const now = performance.now();
		const duration = (performanceEntries.pop()?.startTime ?? now) -
			(performanceEntries.shift()?.startTime ?? now);
		return `${tag} done (duration: ${formatDuration(duration, { maximumFractionDigits: 3 })})`;
	} catch (_) {
		return undefined;
	}
}

//===

// ref: <https://stackoverflow.com/questions/3104410/identify-cygwin-linux-windows-using-environment-variables> , <https://stackoverflow.com/questions/714100/os-detecting-makefile>
// ref: <https://stackoverflow.com/questions/38086185/how-to-check-if-a-program-is-run-in-bash-on-ubuntu-on-windows-and-not-just-plain>
// ref: [CLI and emojis](https://news.ycombinator.com/item?id=25311114) @@ <https://archive.is/xL2BL>

// `isWSL()`
/** Determine if OS platform is 'Windows Subsystem for Linux'. */
export function isWSL() {
	// ref: <https://stackoverflow.com/questions/38086185/how-to-check-if-a-program-is-run-in-bash-on-ubuntu-on-windows-and-not-just-plain> @@ <https://archive.is/KWV5a>
	// * POSIX-like and contains one of the WSL signal environment variables
	return (!isWinOS) &&
		(Boolean(Deno.env.get('IS_WSL')) || Boolean(Deno.env.get('WSL_DISTRO_NAME')));
}

// `canDisplayUnicode()`
/** Determine if unicode display is supported under the current platform and console constraint. */
export function canDisplayUnicode() {
	if (!isWinOS) {
		// POSIX-like
		// ref: <https://stackoverflow.com/questions/3104410/identify-cygwin-linux-windows-using-environment-variables> , <https://stackoverflow.com/questions/714100/os-detecting-makefile>
		// ref: <https://stackoverflow.com/questions/38086185/how-to-check-if-a-program-is-run-in-bash-on-ubuntu-on-windows-and-not-just-plain>
		const isOldTerminal = ['cygwin', 'linux'].includes(Deno.env.get('TERM') ?? '');
		const isWSL_ = isWSL();
		return !isOldTerminal && // fail for old terminals
		(( // * not isWSL
			!isWSL_ &&
			Boolean(
				Deno
					.env
					.get('LC_ALL')
					?.match(/[.]utf-?8$/i) || Deno.env.get('LANG')?.match(/[.]utf-?8$/i),
			) /* LC_ALL or LANG handles UTF-8? */
		) || ( // * isWSL
			isWSL_ && Boolean(Deno.env.get('WT_SESSION')) // only MS Windows Terminal is supported; 'alacritty' and 'ConEmu/cmder' hosts not detectable
		));
	}

	// WinOS
	// note: 'alacritty' will, by default, set TERM to 'xterm-256color'
	return (['alacritty', 'xterm-256color'].includes(Deno.env.get('TERM') ?? '')) || // [alacritty](https://github.com/alacritty/alacritty)
		Boolean(Deno.env.get('ConEmuPID')) || // [ConEmu](https://conemu.github.io) and [cmder](https://cmder.net)
		Boolean(Deno.env.get('WT_SESSION')); // MS Windows Terminal
}

export function mightUseColor() {
	// respects `NO_COLOR` env var override; use 'truthy' values?
	// ref: <https://no-color.org> @@ <https://archive.is/Z5N1d>
	return !(Deno.env.get('NO_COLOR'));
}

export function mightUseFileSystemCase() {
	// * respects `USE_FS_CASE` env var override (for WinOS); use 'truthy' values?
	// POSIX is case-sensitive
	// WinOS is *usually* (~99+%) case-insensitive/case-preserving, but *can* be case-sensitive (on a directory-by-directory basis)
	// ref: <https://stackoverflow.com/questions/7199039/file-paths-in-windows-environment-not-case-sensitive> @@ <https://archive.is/i0xzb>
	// ref: <https://nodejs.org/en/docs/guides/working-with-different-filesystems> @@ <https://archive.is/qSRjE>
	// ref: <https://en.wikipedia.org/wiki/Filename> @@ <https://archive.is/cqe6g>
	return !isWinOS /* assumed to be POSIX-like */ || !(Deno.env.get('USE_FS_CASE'));
}

export function mightUseUnicode() {
	// respects `NO_UNICODE` and `USE_UNICODE` env var overrides (in that order of priority); use 'truthy' values?
	if (Deno.env.get('NO_UNICODE')) return false;
	if (Deno.env.get('USE_UNICODE')) return true;
	return canDisplayUnicode();
}

//===

// note: defined here to avoid circular dependency

// VERSION handler

// `fetch()` implementation (requires read [for local runs] or network permissions)
import { fetch } from './$deps.ts'; // 'file://'-compatible `fetch()`

// import { intoURL, projectLocations, projectURL } from '../../tests/$shared.ts';
// import { logger } from '../../tests/$shared.ts';

const newline = /\r?\n|\n/;
const versionURL = intoURL(projectLocations.version, projectURL);

// logger.trace({ projectURL, projectLocations, versionURL });

// projectVersionText == first non-empty line (EOL trimmed) from VERSION
const projectVersionTextViaFetch =
	(versionURL
		? (fetch(versionURL).then((resp) => resp.ok ? resp.text() : undefined).then((text) =>
			text?.split(newline).filter((s) => s)[0]
		))
		: Promise.resolve(undefined));

// `import ...` implementation (note: requires project-level synchronization tooling)
const projectVersionTextViaImport = VERSION;

function v() {
	return projectVersionTextViaImport;
}

export const $version = { versionURL, projectVersionTextViaFetch, projectVersionTextViaImport, v };

//=== * logger

export * as $logger from './axe/$mod.ts';

//===

import * as $logger from './axe/$mod.ts';

$logger.logger.suspend(); // initialize common/global logger to 'suspended' state to allow for local module use without unwanted outputs
export const logger = $logger.logger; // export logger (note: in the *suspended state*)
