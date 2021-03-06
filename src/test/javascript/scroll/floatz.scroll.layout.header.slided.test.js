/**
 * Please note:
 * ------------------------------------------------------------------------------------------------------
 * In order to make this test run successfully the screen size has to be 1440 x 900 px (Laptop with HDPI)
 * ------------------------------------------------------------------------------------------------------
 */

import DOM from "../../../main/javascript/dom/floatz.dom.dom.js";
import {Scroller} from "../../../main/javascript/scroll/floatz.scroll.scroller.js";
import {ScrollHeaderPlugin} from "../../../main/javascript/scroll/plugin/floatz.scroll.plugin.header.js";
import {ScrollAnchorPlugin} from "../../../main/javascript/scroll/plugin/floatz.scroll.plugin.anchor.js";

DOM.addEvent(window, "DOMContentLoaded", () => {

	let scroller = new Scroller();
	scroller
		.plugin(new ScrollAnchorPlugin())
		.plugin(new ScrollHeaderPlugin())
		.onScrollBackward((scroller) => {
			// console.info("scrolled backward");
		})
		.onScrollForward((scroller) => {
			// console.info("scrolled forward");
		})
	;
});
