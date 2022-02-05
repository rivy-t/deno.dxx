// spell-checker:ignore (js/ts) gmsu
// spell-checker:ignore (names) Deno
// spell-checker:ignore (people) Roy Ivy III * rivy
// spell-checker:ignore (shell/CMD) PATHEXT
// spell-checker:ignore (vars) ARGX

import { $path } from './$deps.ts';
import {
	deQuote,
	env,
	intoURL,
	isWinOS,
	pathEquivalent,
	toCommonCase,
	traversal,
} from './$shared.ts';

import * as $commandLine from '../lib/commandLine.ts';
import * as $args from '../lib/xArgs.ts';

//===

// ToDO? : make this a configurable option (with default == `!isWinOS`); OTOH, current usage should be correct 99+% of the time
const caseSensitiveFiles = !isWinOS;

const execPathExtensions = isWinOS
	? Deno.env.get('PATHEXT')?.split($path.delimiter).filter(Boolean).map(toCommonCase) ?? []
	: undefined;

// const pathsOfPATH = env('PATH')?.split($path.delimiter) ?? [];

//===

// assumptions/configuration
// * These are assumptions (of varying _fragility_) based on current (2021-12-28) practice of the Deno executable.
// * If the runner (ie, `deno`) would supply `argv0`, the raw args, and the args supplied to itself, much of this fragility would evaporate
// * and compatibility with other runners (such as NodeJS) should be more achievable.
const runnerNameReS = '^deno(?:[.]exe)?$'; // *note*: using a runner with a different, unexpected name will cause failures at multiple points
const isDenoEvalReS = `${$path.SEP_PATTERN.source}[$]deno[$]eval[.]js$`;
const enhancedShell = new RegExp('[\\\/][^\\\/]*?sh$', 'ms'); // (sh, bash, dash, ...)
const removableExtensions = (execPathExtensions ?? []).concat(
	'.cjs',
	'.mjs',
	'.js',
	'.ts',
	'.deno.ts',
);
// *
// `underEnhancedShell` == process has been executed by a modern shell (sh, bash, ...) which supplies correctly expanded arguments to the process (via `Deno.args()`)
const underEnhancedShell = ((env('SHELL') || '').match(enhancedShell) || []).length > 0;

const defaultRunner = 'deno';
const defaultRunnerArgs = ['run', '-A'];

const shimEnvPrefix = ['DENO_SHIM_', 'SHIM_'];
const shimEnvBaseNames = ['URL', 'TARGET', 'ARG0', 'ARGS', 'ARGV0', 'PIPE', 'EXEC'];

//===

/** * process was invoked by direct execution */
export const isDirectExecution = !$path.basename(Deno.execPath()).match(runnerNameReS);
/** * process was invoked as an eval script (eg, `deno eval ...`) */
export const isEval = !!Deno.mainModule.match(isDenoEvalReS);

//===

// NOTE: when multiple sources of process information are available, enhanced-shim supplied information is given priority
// * enhanced-shim supplied data will generally have the most accurate/cleanest information, especially the best `argv0`

//===

// shim-supplied process information

// ... TARGET and ARGS could be avoided if Deno supplies raw argument text or Win32 `GetCommandLine()` is available and full text formatting control of sub-process arguments is enabled
// ref: [🐛/🙏🏻 CLI apps need original command line (WinOS)](https://github.com/denoland/deno/issues/9871)
// ref: [The quotation in cmd of Deno.run](https://github.com/denoland/deno/issues/8852)
// ... b/c `deno` runs scripts either directly or via a shim; ARG0 still has value to assist the target process to reveal true executable text (needed when generating correct help text)
// ref: [🙏🏻 [feat/req] supply $0/%0 to shimmed scripts (cross-platform)](https://github.com/denoland/deno/issues/9874

// ToDO? ~ decide whether to check permissions and error/warn or gracefully degrade; if unable to set (and clear) SHIM env variables, should we proceed? is using SHIM_TARGET good enough? what about calling self?

/** * summary of information transmitted by 'shim'-executable initiating the main script, when available */
export const shim = (() => {
	const parts: {
		/** * path/URL of script targeted by shim */
		TARGET?: string;
		/** * original `argv[0]` which invoked this process (if/when available) */
		ARGV0?: string;
		/** * original argument text string */
		ARGS?: string;
		// useful ~ for Windows modification of parent environment (needed for creation of equivalents for enhanced-`cd` (`enhan-cd`, `goto`, `scd`, ...) and `source` applications) // spell-checker:ignore enhan
		// ... PIPE is used to allow passage of ENV variable and CWD changes back up to the parent SHIM process (needed for utilities like `cdd`, `source`, etc.)
		/** * path of pipe file (an escape hatch which allows modification of parent environment (variables and CWD)) */
		PIPE?: string;
		// implementation detail // ToDO? remove as implementation detail?
		// ... EXEC is really an implementation detail (for maximum command line content flexibility within a no-'Terminate batch job (Y/N)?' formulated batch file)
		/** * executable path of secondary shim (when needed; generally defined only for Windows) */
		EXEC?: string;
		/** * URL of process script targeted by enhanced-shim process data
		(used to gate shim-provided information to the correct process, avoiding interpretation of information passed through xProcess-naive intermediary processes)
		*/
		targetURL?: string;
		runner?: string;
		runnerArgs?: string[];
		scriptName?: string;
		scriptArgs?: string[];
	} = {};
	parts.TARGET = env('SHIM_TARGET') || env('SHIM_URL') || env('DENO_SHIM_URL');
	parts.ARGV0 = env('SHIM_ARGV0') ?? env('SHIM_ARG0') ?? env('DENO_SHIM_ARG0');
	parts.ARGS = env('SHIM_ARGS') ?? env('DENO_SHIM_ARGS');
	parts.PIPE = env('SHIM_PIPE') ?? env('DENO_SHIM_PIPE');
	parts.EXEC = env('SHIM_EXEC') ?? env('DENO_SHIM_EXEC');
	//
	parts.runner = undefined;
	parts.runnerArgs = undefined;
	parts.scriptName = undefined;
	parts.scriptArgs = undefined;
	parts.targetURL = intoURL(deQuote(parts.TARGET))?.href;
	if (parts.targetURL && pathEquivalent(parts.targetURL, Deno.mainModule)) {
		// shim is targeting current process
		parts.runner = parts.ARGV0;
		parts.runnerArgs = [];
	} else if (parts.targetURL && pathEquivalent(parts.targetURL, Deno.execPath())) {
		// shim is targeting runner
		if (!parts.ARGS) parts.runner = parts.ARGV0;
		// o/w assume execution in `deno` style as `<runner>` + `<options..> run <options..> script_name <script_options..>`
		// * so, find *second* non-option in ARGS
		const words = parts.ARGS ? $args.wordSplitCLText(parts.ARGS) : [];
		let idx = 0;
		let nonOptionN = 0;
		for (const word of words) {
			idx++;
			if (!deQuote(word)?.startsWith('-')) nonOptionN++;
			if (nonOptionN > 1) {
				parts.runner = parts.ARGV0;
				parts.runnerArgs = words.slice(0, idx - 1);
				parts.scriptName = words.slice(idx - 1, idx)[0];
				parts.scriptArgs = words.slice(idx);
				break;
			}
		}
	}
	return parts;
})();

// ToDO?: evaluate the proper course for shim info targeted at other processes
// consume/reset SHIM environment variables to avoid interpretation by a subsequent process
const envVarNames = shimEnvPrefix.flatMap((prefix) =>
	shimEnvBaseNames.map((base) => prefix + base)
);
envVarNames.forEach((name) => Deno.env.delete(name));

//===

export const isEnhancedShimTarget = pathEquivalent(shim.targetURL, Deno.mainModule);

//===

// command line data for current process

/** * process command line, when available */
export const commandLine = $commandLine.GetCommandLine();
/** * process command line ~ split into semantic parts */
export const commandLineParts = (() => {
	// note: algorithm requires finding non-option words, so final text is a reconstruction instead of verbatim (though it should only differ in whitespace between words, if at all)
	// * necessary b/c `deno`, which already does this work, doesn't/won't supply the raw args
	const parts: {
		runner?: string;
		runnerArgs?: string[];
		scriptName?: string;
		scriptArgs?: string[];
	} = {};
	const words = commandLine ? $args.wordSplitCLText(commandLine) : undefined;
	if (words == null) return parts;
	if (isDirectExecution) {
		parts.scriptName = words.slice(0, 1)[0];
		parts.scriptArgs = words.slice(1);
	} else {
		// o/w assume execution in `deno` style as `<runner> <options..> run <options..> script_name <script_options..>`
		// * so, find *third* non-option
		let idx = 0;
		let nonOptionN = 0;
		for (const word of words) {
			idx++;
			if (!deQuote(word)?.startsWith('-')) nonOptionN++;
			if (nonOptionN > 2) {
				parts.runner = words.slice(0, 1)[0];
				parts.runnerArgs = words.slice(1, idx - 1);
				parts.scriptName = words.slice(idx - 1, idx)[0];
				parts.scriptArgs = words.slice(idx);
				break;
			}
		}
	}
	return parts;
})();

//===

/** * executable text string which initiated/invoked execution of the current process */
export const argv0 = shim.runner ?? commandLineParts.runner ?? Deno.execPath();
/** * runner specific command line options */
export const execArgv = [...(shim.runnerArgs ?? commandLineParts.runnerArgs ?? [])];

/** * path string of main script file (best guess from all available sources) */
export const pathURL = intoURL(deQuote(shim.scriptName))?.href ??
	(isDirectExecution
		? Deno.execPath()
		: (intoURL(deQuote(commandLineParts.scriptName))?.href ?? Deno.mainModule));

/** * base name (eg, NAME.EXT) of main script file (from best guess path) */
const pathUrlBase = $path.parse(pathURL).base;
/** * determine if base has a removable extension and return it (note: longer extensions have priority) */
const removableExtension = removableExtensions.sort((a, b) => b.length - a.length).find((e) =>
	caseSensitiveFiles ? pathUrlBase.endsWith(e) : toCommonCase(pathUrlBase).endsWith(toCommonCase(e))
);

/** * name of main script file (from best guess path) */
export const name = decodeURIComponent(
	removableExtension ? pathUrlBase.slice(0, removableExtension.length * -1) : pathUrlBase,
);

/** * executable string which can be used to re-run current application; eg, `Deno.run({cmd: [ runAs, ... ]});` */
export const runAs = shim.runner
	? ([shim.runner, ...shim.runnerArgs ?? [], shim.scriptName].filter(Boolean).join(' '))
	: commandLineParts.runner
	? ([commandLineParts.runner, ...commandLineParts.runnerArgs ?? [], commandLineParts.scriptName]
		.filter(Boolean)
		.join(' '))
	: isDirectExecution
	? ([commandLineParts.scriptName].filter(Boolean).join(' '))
	: [
		defaultRunner,
		...defaultRunnerArgs,
		$args.reQuote(
			decodeURIComponent(traversal(pathURL)?.replace(/^-/, '.' + $path.SEP + '-') ?? ''),
		),
	]
		.join(' ');

//===

/** * calculated or supplied `argv0` is available for interpretation/expansion */
export const haveSuppliedArgv0 = Boolean(
	shim.ARGV0 || commandLineParts.runner || isDirectExecution,
);

// ref: [🐛/🙏🏻? ~ CLI apps need original command line (WinOS)](https://github.com/denoland/deno/issues/9871)
/** * raw arguments are available for interpretation/expansion OR an "advanced" runner/shell is assumed to have already done correct argument expansion */
export const haveEnhancedArgs = Boolean(isEnhancedShimTarget || commandLine || underEnhancedShell);
/** impaired '$0' and/or argument resolution, ie:
- process name (eg, '$0') is not supplied and must be determined heuristically
- and/or only *processed* arguments are available (via `Deno.args()`) which have *lost quote-context* and cannot distinguish `...` from `"..."`
*/
export const impaired = isWinOS
	? !(haveEnhancedArgs && haveSuppliedArgv0)
	: /* POSIX-like */ !haveSuppliedArgv0;

export const impairedWarningMessage = () => {
	return impaired
		? `degraded capacity (faulty ` + [
			!haveSuppliedArgv0
				? '"$0"'
				: '',
			!haveEnhancedArgs ? 'argument' : '',
		]
			.filter(Boolean)
			.join(' and ') +
			` resolution); full/correct function requires an enhanced runner or shim (use \`dxr\` or install with \`dxi\`)`
		: undefined;
};

export const warnIfImpaired = (
	writer: (...args: unknown[]) => void = (args) => console.warn(`WARN/[${name}]:`, args),
) => {
	const msg = impairedWarningMessage();
	if (msg != undefined) writer(msg);
};

//===

/** * Promise for an array of 'shell'-expanded arguments; simple pass-through of `Deno.args` for non-Windows platforms */
export const argsAsync = async () => {
	if (!isWinOS || underEnhancedShell) return [...Deno.args]; // pass-through of `Deno.args` for non-Windows platforms // ToDO: investigate how best to use *readonly* Deno.args
	return await $args.argsAsync(
		shim.scriptArgs ?? shim.ARGS ?? commandLineParts.scriptArgs ?? Deno.args,
	); // ToDO: add type ArgsOptions = { suppressExpansion: boolean } == { suppressExpansion: false }
};

/** * array of 'shell'-expanded arguments; simple pass-through of `Deno.args` for non-Windows platforms */
export const argsSync = () => {
	if (!isWinOS || underEnhancedShell) return [...Deno.args]; // pass-through of `Deno.args` for non-Windows platforms // ToDO: investigate how best to use *readonly* Deno.args
	return $args.argsSync(shim.scriptArgs ?? shim.ARGS ?? commandLineParts.scriptArgs ?? Deno.args); // ToDO: add type ArgsOptions = { suppressExpansion: boolean } == { suppressExpansion: false }
};

/** * array of 'shell'-expanded arguments; simple pass-through of `Deno.args` for non-Windows platforms */
export const args = argsSync;
