/**
 * The tiny script that runs before the first paint, so a dark-mode user never sees a white flash.
 * It must run before React loads, so it is a string placed in <head> by app/layout.tsx, and this
 * file deliberately imports nothing from React (layout.tsx is a server component).
 * It repeats the decision made by resolveScheme() in colorScheme.ts.
 */

export const COLOR_STORAGE_KEY = "color-scheme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export const NO_FLASH_SCRIPT = `(function(){try{var p=localStorage.getItem("${COLOR_STORAGE_KEY}");var dark=p==="dark"||(p!=="light"&&window.matchMedia("${DARK_QUERY}").matches);var respondent=location.pathname.indexOf("/to/")===0;document.documentElement.dataset.theme=dark&&!respondent?"dark":"light"}catch(e){}})();`;
