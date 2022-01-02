// spell-checker:ignore (names) Deno

import { Colors } from '../$deps.ts';

let supportsUnicode = true;

if ((await Deno.permissions.query({ name: 'env' })).state === 'granted') {
	supportsUnicode = supportsUnicode &&
		(!!Deno.env.get('CI') || Deno.env.get('TERM') === 'xterm-256color');
}

export const symbolStrings: Record<string, Record<string, string>> = {
	// ASCII (ie, ANSI high-bit reset) character fallback prefixes
	ascii: {
		debug: Colors.yellow('@'),
		die: Colors.red('!'),
		error: Colors.red('!'),
		failure: Colors.red('x'),
		info: Colors.brightCyan('i'),
		note: Colors.cyan(Colors.blue('#')),
		success: Colors.green('+'),
		trace: Colors.brightYellow('.'),
		warning: Colors.magenta('*'),
	},
	// emoji glyph prefixes
	// * note: selected emoji are double-wide "emoji-style" characters (implemented using emoji-variation codes where needed)
	// ref: <https://www.unicode.org/reports/tr51/tr51-21.html#Emoji_Variation_Sequences> @@ <https://archive.md/BT41I>
	// ref: <https://unicode.org/emoji/charts/emoji-variants.html> @@ <https://archive.md/mI8co>
	// ref: <http://www.iemoji.com> (note double-width "emoji-style" versions [vs single width "text-style"])
	// ref: <https://r12a.github.io/app-conversion> (conversions between various types of character encodings)
	// * note: use `String.fromCodePoint(codePointValue)` or `'\u{HEX}` to convert UTF-32 code points to internal UTF-8 format
	// ref: <https://mathiasbynens.be/notes/javascript-escapes> @@ <https://archive.is/Dcfol>
	// ref: <https://gitlab.freedesktop.org/terminal-wg/specifications/-/issues/9>
	emoji: {
		debug: Colors.yellow('⚙\ufe0f'), // ⚙️/U+2699+UFE0F (aka ⚙/U+2699 as single width text-style)
		die: Colors.red('🔥'), // 🔥/U+1F525 or 💥/U+1F4A5 or 🧨/U+1F9E8 or 💣/U+1F4A3 or 💀/U+1F480 or ☠️/U+2620+U+FE0F (aka ☠/U+2620 as single-width text-style) or ⚰️/U+26B0+U+FE0F (aka ⚰/U+26B0 as single width text-style)
		error: Colors.red('❗'), // ❗/U+2757
		failure: Colors.red('❌'), // ❌/U+274C or ⮾/U+2BBE+U+FE0F or ⮿/U+2BBF+U+FE0F or 🛑/U+1F6D1 or 🔴/U+1f534 or ⬤/U+2b24+U+fe0f (in double-width 'emoji-style')
		info: Colors.cyan('🛈️'), // 🛈️/U+1f6c8+U+fe0f or ℹ️/U+2139+U+FE0F
		note: Colors.blue('⊛️'), // ⊛️/U+229b+UFE0F or 📋/U+1F4CB or 🔔/U+1F514 or ✉️/U+2709 or 📝/U+1F4DD or 🧾/U+1F9FE or 🗉/U+1F5C9 or 📓/U+1F4D3 or 🗊/U+1F5CA or ♪/U+266A or ♯/U+266F or ⧆/U+29C6 or ⊛/U+229B or ✨/U+2728 or 📄/U+1F4C4
		success: Colors.green('✔️'), // ✔️/U+2714+U+FE0F (aka ✔/U+2714 as single width text-style)
		trace: Colors.brightYellow('🔎'), // 🔎/U+1F50E or 🩺/U+1FA7A
		warning: Colors.yellow('⚠️'), // ⚠️/U+26A0+UFE0F (aka ⚠/U+26A0 as single width text-style) or 🛆/U+1F6C6
	},
	// unicode character (single-width) prefixes
	// ref: <https://www.compart.com/en/unicode>
	unicode: {
		debug: Colors.yellow('•'), // debug sigil => "•" == "bullet"/U+2022 or "●" == "black circle"/U+25cf or "⊙" == "circled dot operator"/U+2299 "●" == "black circle"/U+25cf or "◉" == "fisheye"/U+25c9
		die: Colors.red('‼'),
		error: Colors.red('!'),
		failure: Colors.red('×'), // failure sigil => "×" == "multiplication"/U+00d7 or "●" == "black circle"/U+25cf or "⬤" == "black large circle"/U+2b24
		info: Colors.brightCyan('i'),
		note: Colors.cyan('#'),
		success: Colors.green('✓'), // success sigil => "✓" == "check mark"/U+2713
		trace: Colors.brightYellow('▪'), // trace sigil => "▪" == "black small square"/U+25aa or "●" == "black circle"/U+25cf or "•" == "bullet"/U+2022
		warning: Colors.magenta('◬'), // warning sigil => "up-pointing triangle with dot"/U+25ec
	},
};

export const symbols = supportsUnicode ? symbolStrings.unicode : symbolStrings.ascii;
