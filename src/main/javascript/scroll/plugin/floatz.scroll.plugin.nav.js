import DOM from "../../dom/floatz.dom.dom.js";
import {DOMElement} from "../../dom/floatz.dom.dom.js";
import {ScrollPlugin} from "../floatz.scroll.scroller.js";

/**
 * Scroll navigation plugin.
 */
export class ScrollNavPlugin extends ScrollPlugin {

	/**
	 * Constructor.
	 *
	 * @param scroller Reference to scroller
	 * @param options Plugin options
	 */
	constructor(scroller, options = {}) {
		super(scroller, options);

		// Default options
		this.options().selector = options.selector || "header li > a";

		// Add click handlers to navigation items
		this._navItems = _prepareNavItems(this);
	}

	/**
	 * Scroll handler.
	 */
	onScroll() {
		console.info("scrolled");
	}

	navItems() {
		return this._navItems;
	}
}

/**
 * Prepare navigation items.
 *
 * @param plugin Reference to plugin
 * @return Navigation items
 * @private
 */
function _prepareNavItems(plugin) {
	let navItems = DOM.query(plugin.options().selector);
	let header = DOM.queryUnique("header");

	navItems.forEach((navItem) => {
		navItem.addEvent("click", (event) => {
			event.preventDefault();

			// Remove header offset for slideout header
			if(header.hasClass("flz-header-fixed-slideout")) {
				plugin.scroller().options().offset = 0;
			}

			// Scroll to section the menu navigation item points to
			plugin.scroller().scrollTo(navItem.attr("href"), {
				complete: () => {
					_handleScrollComplete(plugin, navItem);
				},
			});
		});
	});

	return navItems;
}

/**
 * Scroll complete handler.
 *
 * @param plugin Reference to plugin
 * @param {DOMElement} navItem Navigation item
 * @private
 */
function _handleScrollComplete(plugin, navItem) {
	// TODO Replace with specific menu item objects
	// Unselect previous navigation item
	let navItems = plugin.navItems();
	navItems.forEach((item) => {
		if(item.parent().hasClass("flz-nav-selected")) {
			item.parent().removeClass("flz-nav-selected");
		}
	});

	// Select current navigation item
	navItem.parent().addClass("flz-nav-selected");
}