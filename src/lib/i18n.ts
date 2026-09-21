/**
 * Every user-facing string in the app. British English and Hungarian;
 * Hungarian uses the formal address (magázás).
 */

export type Lang = 'en' | 'hu';

const en = {
	title: 'Mirror',
	step1: 'Turn your screen brightness all the way up.',
	step2: 'Stand the phone 30–40 cm away, screen facing you.',
	step3: 'Tap Start mirror. Pinch to zoom, drag to move the picture.',
	privacy: 'The picture stays on this screen. Nothing is recorded, saved or sent.',
	start: 'Start mirror',
	retry: 'Try again',
	exit: 'Exit',
	errDenied:
		'Camera access is off. Allow the camera for this site in your browser settings, then tap Try again.',
	errNoCamera: 'No front camera found on this device.',
	errInUse: 'Another app is using the camera. Close it, then tap Try again.',
	errInsecure: 'The camera needs a secure (https) connection.',
	errUnsupported: "This browser can't show the camera. Open the page in Safari or Chrome.",
	installHint: 'For a full-screen mirror, add this page to your Home Screen.',
	dismiss: 'Dismiss',
	lightOff: 'Light: off',
	lightSoft: 'Light: soft',
	lightBright: 'Light: bright',
	zoomReset: 'Zoom {n}×, tap to reset',
	locked: 'Centre locked',
	paused: 'Tracking paused. Drag to set the centre again.'
} as const;

export type StringKey = keyof typeof en;
export type Strings = Record<StringKey, string>;

const hu: Strings = {
	title: 'Tükör',
	step1: 'Állítsa a képernyő fényerejét maximumra.',
	step2: 'Tegye a telefont állványra, 30–40 cm-re, képernyővel maga felé.',
	step3: 'Koppintson a Tükör indítása gombra. Két ujjal nagyíthat, egy ujjal mozgathatja a képet.',
	privacy: 'A kép ezen a képernyőn marad. Semmit nem rögzít, nem ment és nem küld el.',
	start: 'Tükör indítása',
	retry: 'Újra',
	exit: 'Kilépés',
	errDenied:
		'A kamera-hozzáférés ki van kapcsolva. Engedélyezze a kamerát ennek az oldalnak a böngésző beállításaiban, majd koppintson az Újra gombra.',
	errNoCamera: 'Ezen az eszközön nem található előlapi kamera.',
	errInUse: 'Egy másik alkalmazás használja a kamerát. Zárja be, majd koppintson az Újra gombra.',
	errInsecure: 'A kamerához biztonságos (https) kapcsolat kell.',
	errUnsupported:
		'Ez a böngésző nem tudja megjeleníteni a kamerát. Nyissa meg az oldalt Safariban vagy Chrome-ban.',
	installHint: 'Teljes képernyős tükörhöz tegye ki az oldalt a kezdőképernyőre.',
	dismiss: 'Bezárás',
	lightOff: 'Fény: ki',
	lightSoft: 'Fény: halvány',
	lightBright: 'Fény: erős',
	zoomReset: 'Nagyítás {n}×, koppintson a visszaállításhoz',
	locked: 'Középpont rögzítve',
	paused: 'A követés szünetel. Húzza a képet az új középpont beállításához.'
};

export const STRINGS: Record<Lang, Strings> = { en, hu };

/**
 * Hungarian for `hu` and `hu-*`, English for everything else. Compares the
 * primary subtag, so `hup` (Hupa) does not come out Hungarian.
 */
export function pickLang(language: string | null | undefined): Lang {
	return language?.toLowerCase().split('-')[0] === 'hu' ? 'hu' : 'en';
}

/** 1 → "1", 2.54 → "2.5". Shown with tabular figures, so the width is steady. */
export function formatZoom(zoom: number): string {
	return String(Math.round(zoom * 10) / 10);
}

/** Fills `{name}` placeholders. Unknown names are left alone. */
export function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
		name in values ? String(values[name]) : whole
	);
}
