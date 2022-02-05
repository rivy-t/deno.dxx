// spell-checker:ignore (names) Deno ; (vars) ARGX LOGLEVEL PATHEXT arr gmsu ; (utils) dprint dprintrc ; (yargs) nargs positionals

import { /* $colors, */ $fs, $semver, $yargs, YargsArguments } from './lib/$deps.ts';
import { $version, decode, env, mightUseUnicode, restyleYargsHelp } from './lib/$shared.ts';

import { $me } from './lib/$locals.ts';
import { $logger, logger as log /* initialized to the suspended state */ } from './lib/$shared.ts';

//===

log.debug(`logging to *STDERR*`);

$me.warnIfImpaired((msg) => log.warn(msg)); // WARN if executing with impaired command line capability
log.trace({ $me });
log.trace({ $version });
log.trace('Deno', { execPath: Deno.execPath(), main: Deno.mainModule, denoArgs: Deno.args });

const logLevelFromEnv = $logger.logLevelFromEnv() ?? (env('DEBUG') ? 'debug' : undefined);
log.debug(
	`(potential) log level of '${logLevelFromEnv}' generated from environment variables (LOG_LEVEL/LOGLEVEL or DEBUG)`,
);

const version = $version.v();
const runAsName = $me.runAs;

// const useColor = mightUseColor();
const useUnicode = mightUseUnicode();

log.mergeMetadata({
	authority: $me.name,
	Humane: {
		showLabel: true,
		showSymbol: useUnicode ? 'unicodeDoubleWidth' : false,
		// note: `prefixFormatFn` should assume `s` is a unicode string (with possible surrogate pairs, not simple UTF-16 characters) and may contain ANSI escape codes
		// prefixFormatFn: (s: string) => ($colors.inverse(s.replace(/:$/, ''))),
	},
});

//===

// ref: <https://devhints.io/yargs> , <https://github.com/yargs/yargs/tree/v17.0.1-deno/docs>
const app = $yargs(/* argv */ undefined, /* cwd */ undefined)
	.scriptName($me.name)
	.epilog('* Copyright (c) 2021-2022 * Roy Ivy III (MIT license)')
	.usage(`$0 ${version}\n
Auto-format project files (using \`dprint\` and/or \`deno\`).\n
Usage:\n  ${runAsName} [OPTION..] [-- [FORMAT_OPTION..]] [FILE..]`)
	// ref: <https://github.com/yargs/yargs/blob/59a86fb83cfeb8533c6dd446c73cf4166cc455f2/locales/en.json>
	.updateStrings({ 'Positionals:': 'Arguments:' })
	.positional('OPTION', { describe: 'OPTION(s) as listed here (below)' })
	.positional('FORMAT_OPTION', { describe: 'FORMAT_OPTION(s) delegated to the formatter command' })
	.positional('FILE', {
		describe: `FILE(s) to format (when missing, format all project files [formatter-defined])`,
	})
	.fail((msg: string, err: Error, _: ReturnType<typeof $yargs>) => {
		if (err) throw err;
		throw new Error(msg);
	})
	.wrap(/* columns */ undefined)
	// help and version setup
	.help(false)
	.version(false)
	.option('help', {
		describe: 'Write help text to STDOUT and exit (with exit status = 1)',
		type: 'boolean',
	})
	.alias('help', 'h')
	.option('version', {
		describe: 'Write version number to STDOUT and exit (with exit status = 1)',
		type: 'boolean',
	})
	.alias('version', 'V')
	// logging options
	.option('log-level', {
		alias: ['\b\b\b\b LOG_LEVEL'], // *hack* use backspaces to fake an option argument description (ref: <https://github.com/yargs/yargs/issues/833>)
		choices: ['error', 'warning', 'warn', 'notice', 'info', 'debug', 'trace'],
		describe: `Set logging level to LOG_LEVEL (overrides any prior setting)`,
		type: 'string',
	})
	.option('silent', {
		describe: `Silent mode; suppress non-error messages (sets 'error' level logging)`,
		type: 'boolean',
	})
	.option('quiet', {
		describe: `Quiet mode; suppress informational messages (sets 'warn' level logging)`,
		type: 'boolean',
	})
	.option('verbose', { describe: `Set 'info' level logging`, type: 'boolean' })
	.option('debug', { describe: `Set 'debug' level logging`, type: 'boolean' })
	.option('trace', { describe: `Set 'trace' (high-detail 'debug') level logging`, type: 'boolean' })
	.group([], 'Options:')
	.group(['log-level', 'silent', 'quiet', 'verbose', 'debug', 'trace'], '*Logging:')
	.group(['help', 'version'], '*Help/Info:')
	// ref: <https://github.com/yargs/yargs/blob/59a86fb83cfeb8533c6dd446c73cf4166cc455f2/locales/en.json>
	.updateStrings({
		'Unknown argument: %s': { 'one': 'Unknown option: %s', 'other': 'Unknown options: %s' },
	})
	// ref: <https://github.com/yargs/yargs-parser#configuration>
	.parserConfiguration({
		'camel-case-expansion': true,
		'short-option-groups': true,
		'strip-aliased': true,
		'strip-dashed': true,
		// 'halt-at-non-option': true,
		// 'unknown-options-as-args': true,
	})
	// .example(`\`${runAsName} FILE\``, 'Format FILE')
	/* Options... */
	.strictOptions(/* enable */ true)
	.option('formatter', {
		alias: ['f', '\b\b\b\b COMMAND'], // *hack* use backspaces to fake an option argument description
		choices: ['default', 'all', 'deno', 'dprint'],
		// default: 'default',
		describe: `Select COMMAND as the code formatter ('default' => 'dprint')`,
		nargs: 1,
		type: 'string',
	});

//===

const bakedArgs = $me.args();

const optionArgs = bakedArgs;
const nonOptionArgs: typeof bakedArgs = [];

log.trace({ optionArgs, nonOptionArgs });

const argv = ((() => {
	try {
		return app.parse(optionArgs) as YargsArguments;
	} catch (e) {
		log.error(e.message);
		return;
	}
})());
if (argv && Array.isArray(argv._)) {
	argv._.push(...nonOptionArgs);
}

log.trace({ bakedArgs, argv });

const possibleLogLevels = ((defaultLevel = 'notice') => {
	const levels = [
		logLevelFromEnv,
		(argv?.silent) ? 'error' : undefined,
		(argv?.quiet) ? 'warn' : undefined,
		(argv?.verbose) ? 'info' : undefined,
		(argv?.debug) ? 'debug' : undefined,
		(argv?.trace) ? 'trace' : undefined,
	]
		.filter(Boolean);
	const logLevelFromArgv =
		(Array.isArray(argv?.logLevel)
			? argv?.logLevel as string[]
			: [argv?.logLevel as string | undefined])
			.pop();
	log.trace({ logLevelFromEnv, levels, logLevelFromArgv });
	return [log.logLevelDetail(logLevelFromArgv)?.levelName]
		.concat(
			(levels.length > 0 ? levels : [defaultLevel])
				.map((s) => log.logLevelDetail(s)?.levelNumber)
				.filter(Boolean)
				.sort()
				.reverse()
				.map((n) => log.logLevelDetail(n)?.levelName),
		)
		.filter(Boolean);
})();
const logLevel = possibleLogLevels.length > 0 ? possibleLogLevels[0] : Infinity;

log.trace({ possibleLogLevels });

log.mergeMetadata({ Filter: { level: logLevel } });
log.debug(`log level set to '${logLevel}'`);

await log.resume();

//===

if (argv == undefined) {
	console.warn(`\nUse \`${runAsName} --help\` to show full usage and available options`);
	Deno.exit(1);
}

//===

// ref: <https://stackoverflow.com/questions/50565408/should-bash-scripts-called-with-help-argument-return-0-or-not-zero-exit-code>
if (argv.help) {
	const yargsHelp = await app.getHelp();
	const help = await restyleYargsHelp(yargsHelp);
	console.log(help);
	Deno.exit(1);
}
if (argv.version) {
	console.log(version);
	Deno.exit(1);
}

//=== ***

const args = argv._.map(String);

//===

// if (args.length < 1) {
// 	await log.error(`... argument(s) required`);
// 	const yargsHelp = await app.getHelp();
// 	const usage = (await restyleYargsHelp(yargsHelp) as string).match(/\n(.*?usage.*?\n)\n/ims)?.[1];
// 	console.warn(`${usage}\nUse \`${runAsName} --help\` to show full usage and available options`);
// 	Deno.exit(1);
// }

//=== ***

const files = args;
const formatter = argv.formatter as string | undefined ?? 'dprint';

const denoVersion = await haveDenoVersion();
const denoFmtHasConfig = denoVersion != undefined && $semver.gte(denoVersion, '1.14.0');
const denoConfigPaths = ['deno.json', 'tsconfig.json'];
const denoConfigPath = denoConfigPaths.filter($fs.existsSync);
const haveDenoConfig = denoConfigPath.length > 0;

const dprintVersion = await haveDprintVersion();
const dprintConfigPaths = ['.dprint.json', 'dprint.json', '.dprintrc.json'];
const dprintConfigPath = dprintConfigPaths.filter($fs.existsSync);
const haveDprintConfig = dprintConfigPath.length > 0;

await log.trace({ denoVersion, dprintVersion });

const runOptions: Partial<{ [key in 'deno' | 'dprint']: Deno.RunOptions }> = {};

runOptions['deno'] = {
	cmd: ['deno', 'fmt'].concat((denoFmtHasConfig && haveDenoConfig
		? ['--config', denoConfigPath[0]]
		: [])
		.concat([...files])),
	stderr: 'inherit',
	stdin: 'inherit',
	stdout: 'inherit',
};

runOptions['dprint'] = {
	cmd: ['dprint', 'fmt'].concat((haveDprintConfig
		? ['--config', dprintConfigPath[0]]
		: [])
		.concat([...files])),
	stderr: 'inherit',
	stdin: 'inherit',
	stdout: 'inherit',
};

await log.trace({ runOptions });

if (['all', 'deno'].includes(formatter)) {
	await log.info('Formatting with `deno`');
	const process = Deno.run(runOptions['deno']);
	const status = await process.status();
	if (!status.success) Deno.exit(status.code);
}

if (['default', 'all', 'dprint'].includes(formatter)) {
	await log.info('Formatting with `dprint`');
	const process = Deno.run(runOptions['dprint']);
	const status = await process.status();
	if (!status.success) Deno.exit(status.code);
}

Deno.exit(0);

//===

function haveDprintVersion() {
	try {
		const process = Deno.run({
			cmd: ['dprint', '--version'],
			stdin: 'null',
			stderr: 'null',
			stdout: 'piped',
		});
		return (process.output())
			.then((output) => decode(output).match(/^dprint\s+(\d+([.]\d+)*)/im)?.[1])
			.finally(() => process.close());
	} catch (_) {
		return Promise.resolve(undefined);
	}
}

function haveDenoVersion() {
	try {
		const process = Deno.run({
			cmd: ['deno', '--version'],
			stdin: 'null',
			stderr: 'null',
			stdout: 'piped',
		});
		return (process.output())
			.then((output) => decode(output).match(/^deno\s+(\d+([.]\d+)*)/im)?.[1])
			.finally(() => process.close());
	} catch (_) {
		return Promise.resolve(undefined);
	}
}
