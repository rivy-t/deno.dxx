// spell-checker:ignore (vars) arr gmsu

import * as xArgs from './lib/xArgs.ts';
import * as Me from './lib/xProcess.ts';

// console.warn(Me.name, { Me });

Me.warnIfImpaired();

// const { arg: targetPath, tailOfArgExpansion, tailOfArgsText } = await (async () => {
// 	const it = xArgs.argsIt(Me.argsText || Deno.args);
// 	const itNext = await it.next();
// 	return !itNext.done ? itNext.value : { arg: '', tailOfArgExpansion: [], tailOfArgsText: '' };
// })();

// // console.warn(Me.name, { targetPath, CWD: Deno.cwd() });
// if (!targetPath) {
// 	console.error(`${Me.name}: err!: no target name supplied (use \`${Me.name} TARGET\`)`);
// 	Deno.exit(1);
// } else {
// 	const iteratedArgTail = (await Promise.all(tailOfArgExpansion.flatMap(async (it) => {
// 		const arr: string[] = [];
// 		for await (const a of it) arr.push(a);
// 		return arr;
// 	})))
// 		.flat();

// // console.warn(Me.name, { tailOfArgExpansion, iteratedArgTail });

const args = Me.args();
const targetPath = args.shift() || '';

let targetURL;
try {
	targetURL = (new URL(targetPath, 'file://' + Deno.cwd() + '/')).href;
} catch {
	targetURL = '';
}
// console.warn(Me.name, { CWD: Deno.cwd(), targetPath, targetURL });

// const targetArgs = [...iteratedArgTail, tailOfArgsText].join(' ');

const targetArgs = args;
const denoOptions = ['run', '-A'];
const runOptions: Deno.RunOptions = {
	cmd: ['deno', ...denoOptions, targetPath, ...targetArgs],
	stderr: 'inherit',
	stdin: 'inherit',
	stdout: 'inherit',
	env: {
		DENO_SHIM_ARG0: `${
			Me.shimArg0 ? Me.shimArg0 : ['deno', ...denoOptions].join(' ')
		} ${targetPath}`,
		DENO_SHIM_ARGS: targetArgs.map(xArgs.reQuote).join(' '),
		DENO_SHIM_URL: targetURL,
	},
};
// console.warn(Me.name, { runOptions });
const process = Deno.run(runOptions);
const status = await process.status();
Deno.exit(status.success ? 0 : status.code);
// }
