import DOM from "../dom/floatz.dom.dom.js";
import Easing from "../animation/floatz.animation.easing.js"
import {DOMElement} from "../dom/floatz.dom.dom.js";
import {EVENT_SCROLL} from "../dom/floatz.dom.events.js";
import Strings from "../util/floatz.util.strings.js";

/**
 * Notes:
 * ------
 * document.body.scrollTop / scrollLeft
 * containerElement.scrollTop / scrollLeft
 * childelement.offsetTop / offsetLeft => Position relative to document (fixed)
 * childelement.getClientBoundingRect.top / left => Position relative to _container (variable)
 */

// Constants for events
// Note: Symbols can´t be used because closure compiler will change names
const LOG_PREFIX_SCROLLER = "floatz | Scroller | ";
const LOG_PREFIX_SCROLLANIMATION = "floatz | ScrollAnimation | ";
const LOG_PREFIX_SCROLLPLUGIN = "floatz | ScrollPlugin | ";
export const SCROLL_EVENT_BEFORENAVGIATE = "flz-event-before-navigate";
export const SCROLL_EVENT_AFTERNAVGIATE = "flz-event-after-navigate";

/**
 * Scroll orientation enum.
 *
 * @type {Object}
 */
export const Orientation = Object.freeze({
	HORIZONTAL: Symbol("horizontal"),
	VERTICAL: Symbol("vertical")
});

/**
 * Scroll manager.
 */
export class Scroller {
	/**
	 * Constructor.
	 *
	 * @param {?(DOMElement|Object|string)} container Scroll container (default is window)
	 * @param {?Object} options Scroll container options
	 */
	constructor(container = window, options = {}) {
		this._options = options;
		this._options.orientation = options.orientation || Orientation.VERTICAL;
		this._options.offset = options.offset || 0;
		this._options.intersection = options.intersection || {};
		this._plugins = [];
		this._handlers = [];
		this._scrollStartHandlers = [];
		this._scrollEndHandlers = [];
		this._scrollInHandlers = [];
		this._scrollOutHandlers = [];
		this._observeHandlers = [];
		this._scrollHandler = null;
		this._container = container;
		this._scrolling = false;
		this._observer = null;
		// this._firstIntersection = true;
		this._isScrollToAction = false;

		if (DOM.isWindow(container)) {
			// Note: document.body does not work since Chrome 61
			this._options.scrollable = document.scrollingElement || document.documentElement;
		} else if (container instanceof DOMElement) {
			this._container = container.origNode();
			this._options.scrollable = this._container;
		} else if (Strings.isString(container)) {
			this._container = DOM.queryUnique(container).origNode();
			this._options.scrollable = this._container;
		} else {
			this._options.scrollable = this._container;
		}

		this._options.intersection.threshold = options.intersection.threshold || [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]; // Ensure firing at 0 and 100% visibility
		this._options.intersection.rootMargin = options.intersection.rootMargin;
		if (options.intersection.root) {
			this._options.intersection.root = options.intersection.root;
		} else if (!DOM.isWindow(this._container)) {
			this._options.intersection.root = this._container;
		}

		this._prevScrollPos = this.scrollPos();
	}

	/**
	 * Inject scroll plugin.
	 *
	 * @param plugin {ScrollPlugin} Scroll plugin
	 * @returns {Scroller} Scroller for chaining
	 */
	plugin(plugin) {
		if (!(plugin instanceof ScrollPlugin)) {
			throw "Plugin must extend class ScrollPlugin";
		}

		plugin.scroller(this);
		this._plugins.push(plugin);
		this.onScroll(() => {
			plugin.onScroll(this);
		});
		this.onScrollBackward(() => {
			plugin.onScrollBackward(this);
		});
		this.onScrollForward(() => {
			plugin.onScrollForward(this);
		});
		return this;
	}

	/**
	 * Get scroll container.
	 *
	 * @returns {!Element} Scroll container
	 */
	container() {
		return this._container;
	}

	/**
	 * Get scroll options.
	 *
	 * @returns Scroll options
	 */
	options() {
		return this._options;
	}

	/**
	 * Get / set scroll offset correction.
	 *
	 * @param {number=} offset Scroll offset correction
	 * @returns Scroller for chaining when used as setter
	 */
	offset(offset) {
		if (offset === undefined) {
			return this._options.offset;
		} else {
			this._options.offset = offset;
			return this;
		}
	}

	/**
	 * Scroll handler.
	 *
	 * @param {Function} handler Custom handler
	 * @returns {Scroller} Scroller for chaining
	 */
	onScroll(handler) {
		if (!this._scrollHandler) {
			this._scrollHandler = () => {
				// Adjust events to maximum of 60fps
				if (!this._scrolling) {
					window.requestAnimationFrame(() => {
						this._handlers.forEach((handler) => {
							handler(this);
						});

						// Set new position AFTER firing handlers!
						this._prevScrollPos = this.scrollPos();
						this._scrolling = false;
					});
					this._scrolling = true;
				}
			};
			DOM.addEvent(this._container, EVENT_SCROLL, this._scrollHandler);
		}

		this._handlers.push(() => {
			handler(this);
		});
		return this;
	}

	/**
	 * Scroll forward handler.
	 *
	 * @param {Function} handler Custom handler
	 * @returns {Scroller} Scroller for chaining
	 */
	onScrollForward(handler) {
		this._handlers.push(() => {
			if (this._prevScrollPos < this.scrollPos()) {
				handler(this);
			}
		});
		return this;
	}

	/**
	 * Scroll backward handler.
	 *
	 * @param {Function} handler Custom handler
	 * @returns {Scroller} Scroller for chaining
	 */
	onScrollBackward(handler) {
		this._handlers.push(() => {
			if (this._prevScrollPos > this.scrollPos()) {
				handler(this);
			}
		});
		return this;
	}

	/**
	 * Scroll start handler.
	 *
	 * @param {Function} handler Custom handler
	 * @returns {Scroller} Scroller for chaining
	 */
	onScrollStart(handler) {
		_registerScrollStartEndHandler(this);
		this._scrollStartHandlers.push(() => {
			handler(this);
		});
		return this;
	}

	/**
	 * Scroll end handler.
	 *
	 * @param {Function} handler Custom handler
	 * @returns {Scroller} Scroller for chaining
	 */
	onScrollEnd(handler) {
		_registerScrollStartEndHandler(this);
		this._scrollEndHandlers.push(() => {
			handler(this);
		});
		return this;
	}

	/**
	 * Scroll into viewport handler.
	 * Observe elements when they scroll into the viewport.
	 * <p>
	 *     The registered handler is executed as soon as the target element scrolls into the viewport.
	 *     TODO: Consider custom thresholds
	 *     TODO: Multiple targets (Array)
	 *     TODO: String selector as target
	 *     TODO: Node as target
	 * </p>
	 *
	 * @param {DOMElement|Array} target Observed target element(s)
	 * @param {Function} handler Custom handler
	 * @returns {Scroller} Scroller for chaining
	 */
	onScrollIn(target, handler) {
		// Remove redundant code - see onScrollOut, onScrollIntersected
		_initIntersectionObserver(this, target);
		let targets = Array.isArray(target) ? target : new Array(target);
		targets.forEach((target) => {
			this._scrollInHandlers.push({
				target: target,
				handler: handler
			});
		});
		return this;
	}

	/**
	 * Scroll out of viewport handler.
	 * Oberserv elements when they scroll out of the viewport.
	 * <p>
	 *     The registered handler is executed as soon as the target element scrolls out of the viewport.
	 *     TODO: Consider custom thresholds
	 *     TODO: Multiple targets (Array)
	 *     TODO: String selector as target
	 *     TODO: Node as target
	 * </p>
	 *
	 * @param {DOMElement|Array} target Observed target element(s)
	 * @param {Function} handler Custom handler
	 * @returns {Scroller} Scroller for chaining
	 */
	onScrollOut(target, handler) {
		_initIntersectionObserver(this, target);
		let targets = Array.isArray(target) ? target : new Array(target);
		targets.forEach((target) => {
			this._scrollOutHandlers.push({
				target: target,
				handler: handler
			});
		});
		return this;
	}

	/**
	 * Scroll intersected elements in viewport handler.
	 * Observe elements while they are visible in the viewport.
	 *
	 * @param {DOMElement|Array} target Observed target element(s)
	 * @param {Function} handler Custom handler
	 * @returns {Scroller} Scroller for chaining
	 */
	onScrollIntersected(target, handler) {
		_initIntersectionObserver(this, target);
		let targets = Array.isArray(target) ? target : new Array(target);
		targets.forEach((target) => {
			this._observeHandlers.push({
				target: target,
				handler: handler
			});
		});
		return this;
	}

	/**
	 * Scroll to element.
	 *
	 * @param {(Object|string)} target Target element or position
	 * @param {Object=} options Scroll options
	 * @returns {Scroller} Scroller for chaining
	 */
	scrollTo(target, options = {}) {
		this._options.duration = options.duration || 600;
		this._options.easing = options.easing || Easing.easeInOutQuad;
		this._options.complete = () => {
			_runScrollEndHandlers(this);
			if(options.complete) {
				options.complete();
				setTimeout(() => {
					this._isScrollToAction = false;
				}, 100) // Give browser some time to fire last scroll event (prevents firing start/end handlers again)
			}
		}
		this._isScrollToAction = true;
		_runScrollStartHandlers(this);
		new ScrollAnimation(this._container, target, this._options);
		return this;
	}

	/**
	 * Get scroll orientation configure via the constructor.
	 *
	 * @return {Object} Scroll Orientation
	 */
	orientation() {
		return this._options.orientation;
	}

	/**
	 * Get / set scroll position.
	 *
	 * @param {number=} position Optional scroll position
	 * @returns {number|Scroller} Scroll position in px or scroller for chaining if used as setter
	 */
	scrollPos(position) {
		if (position) {
			// console.log(position);
			if (this.orientation() === Orientation.VERTICAL) {
				this._options.scrollable.scrollTop = position;
			} else {
				this._options.scrollable.scrollLeft = position;
			}
			return this;
		} else {
			return this.orientation() === Orientation.VERTICAL ? this._options.scrollable.scrollTop : this._options.scrollable.scrollLeft;
		}
	}

	/**
	 * Get previous scroll position.
	 *
	 * @returns {*|number} Previous scroll position in px
	 */
	prevScrollPos() {
		return this._prevScrollPos;
	}

	/**
	 * Get size of scroll container (including all its scroll sections)
	 *
	 * @returns {number} Scroll container size in px
	 */
	scrollSize() {
		if (this.orientation() === Orientation.VERTICAL) {
			return this._options.scrollable.scrollHeight;
		} else {
			return this._options.scrollable.scrollWidth;
		}
	}

	/**
	 * Get size of scroll container viewport.
	 * @returns {number} Scroll container viewport size in px
	 */
	viewportSize() {
		if (this.orientation() === Orientation.VERTICAL) {
			if (DOM.isWindow(this._container)) {
				return this._container.innerHeight;
			} else {
				return this._container.getBoundingClientRect().height;
			}
		} else {
			if (DOM.isWindow(this._container)) {
				return this._container.innerWidth;
			} else {
				return this._container.getBoundingClientRect().width;
			}
		}
	}

	/**
	 * Get status who triggered the scrolling.
	 *
	 * @returns {boolean} true if triggered by scrollTo function, false if user is scrolling manually
	 */
	isScrollToAction() {
		return this._isScrollToAction;
	}
}

/**
 * Scroll animation.
 *
 * Inspired by:
 * http://callmecavs.com/jump.js/
 */
export class ScrollAnimation {

	/**
	 * Constructor.
	 *
	 * @param {Object} container Scroll container
	 * @param {(string|Object)} target Target element or position
	 * @param {Object} options Scroll options
	 */
	constructor(container, target, options) {
		this._container = null;      // Scroll container
		this._options = null;        // Scroll configuration
		this._element = null;        // Scroll target DOMElement
		this._start = null;          // Scroll start position in px
		this._stop = null;           // Scroll stop position in px
		this._distance = null;       // Scroll distance in px
		this._timeStart = null;      // Scroll start time in ms
		this._timeElapsed = null;    // Scroll time already elapsed ms
		this._next = null;           // Next scroll position in px

		this._container = container;
		this._options = options;

		// Convert target to DOMElement
		this._element = this.element(target);

		// Get start position
		this._start = this.startPos();

		// Get stop position
		this._stop = this.stopPos(target);

		// Get distance (Fix: will be calculated on the fly in animate() to get most resent offset value)
		// this._distance = this._stop - this._start + this._options.offset;
		// console.debug(`target: ${target}, stop: ${this._stop}, start: ${this._start}, offset: ${this._options.offset}, distance: ${this._distance}`);

		// Start scroll animation
		// Note: the arrow function sets context for usage of this in animate
		window.requestAnimationFrame((t) => this.animate(t, options));
	}

	/**
	 * Get start position.
	 *
	 * @returns {(number)} Start position
	 */
	startPos() {
		// Get scroll _start position depending on scroll orientation
		if (this._options.orientation === Orientation.VERTICAL) {
			return this._options.scrollable.scrollTop;
		} else {
			return this._options.scrollable.scrollLeft;
		}
	}

	/**
	 * Get stop position
	 *
	 * @param {(DOMElement|Object|string|number)} target Scroll target
	 * @returns {number} Stop position in px
	 */
	stopPos(target) {
		if (typeof target === 'number') {
			// Just use the px position of the target
			return target;
		} else {
			// Get scroll stop position depending on scroll orientation
			if (this._options.orientation === Orientation.VERTICAL) {
				return this._element.origNode().getBoundingClientRect().top + this._start;
			} else {
				return this._element.origNode().getBoundingClientRect().left + this._start;
			}
		}
	}

	// noinspection JSMethodCanBeStatic
	/**
	 * Convert target to DOMElement.
	 *
	 * @param {(DOMElement|Object|string)} target Target element or position
	 * @returns {*} DOMElement
	 */
	element(target) {
		let element = null;
		switch (typeof target) {
			case 'object':
				if(target instanceof DOMElement) {
					element = target;
				} else {
					element = new DOMElement(target);
				}
				break;
			case 'string':
				element = DOM.queryUnique(target);
				break;
		}
		return element;
	}

	/**
	 * Run scroll animation.
	 *
	 * @param {number} timeCurrent Current time from in µs
	 * @param {Object} options Original scroll options
	 */
	animate(timeCurrent, options) {

		// Remember time when scrolling started
		if (!this._timeStart) {
			this._timeStart = timeCurrent;
		}

		// Determine time spent for scrolling so far
		this._timeElapsed = timeCurrent - this._timeStart;

		// Calculate distance on the fly to ensure we always use the most recent value of offset
		this._distance = this._stop - this._start + options.offset;

		// Calculate _next scroll position
		this._next = this._options.easing(this._timeElapsed, this._start, this._distance,
			this._options.duration);

		// Change scroll position
		this.scroll(this._next);

		// Check progress
		if (this._timeElapsed < this._options.duration) {
			// Continue scroll animation
			// Note: the arrow function sets context for usage of this in animate
			window.requestAnimationFrame((t) => this.animate(t, options));
		} else {
			// Finish scroll animation
			this.done();
		}
	}

	/**
	 * Scroll to position.
	 *
	 * @param {number} position Scroll position
	 */
	scroll(position) {
		if (this._options.orientation === Orientation.VERTICAL) {
			this._options.scrollable.scrollTop = position;
		} else {
			this._options.scrollable.scrollLeft = position;
		}
	}

	/**
	 * Finish scroll animation.
	 */
	done() {
		// Account for time rounding inaccuracies in requestAnimationFrame
		this.scroll(this._start + this._distance);

		// Reset time for _next animation
		this._timeStart = false;

		// Run custom complete function
		this._options.complete();
	}
}

/**
 * Scroller plugin.
 */
export class ScrollPlugin {

	/**
	 * Constructor.
	 * @param {Object=} options Options
	 */
	constructor(options = {}) {
		this._scroller = null;
		this._options = options;
	}

	/**
	 * Get / set scroller.
	 *
	 * @param {Scroller=} scroller
	 * @returns {(Scroller|ScrollPlugin)} Scroller or ScrollPlugin for chaining when used as setter
	 */
	scroller(scroller) {
		if (scroller) {
			this._scroller = scroller;
			return this;
		} else {
			return this._scroller;
		}
	}

	/**
	 * Get options.
	 *
	 * @returns {Object}
	 */
	options() {
		return this._options;
	}

	/**
	 * Scroll handler.
	 */
	onScroll() {
	}

	/**
	 * Scroll backward handler.
	 */
	onScrollBackward() {
	}

	/**
	 * Scroll forward handler.
	 */
	onScrollForward() {
	}
}

/**
 * Register handler that is necessary for scroll start / end events.
 *
 * @param {Scroller} scroller Scroller
 * @see https://gomakethings.com/detecting-when-a-visitor-has-stopped-scrolling-with-vanilla-javascript/
 * @private
 */
function _registerScrollStartEndHandler(scroller) {
	if (scroller._scrollEndHandlers.length === 0 && scroller._scrollStartHandlers.length === 0) {
		let endScrollTimeout = null;

		DOM.addEvent(scroller._container, EVENT_SCROLL, () => {
			// console.log("EVENT_SCROLL");

			// Handle start/end handlers for manual scrolling only
			if(! scroller.isScrollToAction()) {

				// Run scroll start handlers
				if (endScrollTimeout === null) {
					_runScrollStartHandlers(scroller);
				}

				// Extend timeout for scroll end handlers throughout the scroll
				window.clearTimeout(endScrollTimeout);
				endScrollTimeout = setTimeout(() => {

					// Run scroll end handlers
					_runScrollEndHandlers(scroller);
					endScrollTimeout = null;

				}, 100); // Scrolling on iOS needs more time otherwise flickers!
			}
		});
	}
}

function _runScrollStartHandlers(scroller) {
	// console.log(">>> scroll start handlers")
	scroller._scrollStartHandlers.forEach((handler) => {
		handler(scroller);
	});
}

function _runScrollEndHandlers(scroller) {
	// console.log(">>> scroll end handlers")
	scroller._scrollEndHandlers.forEach((handler) => {
		handler(scroller);
	});
}

/**
 * Initialize intersection observer.
 * <p>
 *     Ensures that only one intersection observer is created and the observed target handler is registered.
 * </p>
 *
 * @param {Scroller} scroller Scroller
 * @param {DOMElement|Array} target Observed target element(s)
 * @private
 */
function _initIntersectionObserver(scroller, target) {
	if (scroller._observer === null) {
		// FIXME Consider fixed header offsets
		scroller._observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {

				// console.log(entry);

				// Run handlers for observed elements
				scroller._observeHandlers.filter(handler => handler.target.origNode() === entry.target)
					.forEach((handler) => {
						handler.handler(entry);
					})
				;

				if (entry.isIntersecting && entry.intersectionRatio > 0.1 /* Fix: Avoid firing to early - see issue #27 */ ) {
					// Run scroll-in handlers
					scroller._scrollInHandlers.filter(handler => handler.target.origNode() === entry.target)
						.forEach((handler) => {
							handler.handler(entry);
						})
					;
				/////// Changed back again - want to know if the section is not intersected, e.g. when reloading the page at other position than the initial
				// } else if (!scroller._firstIntersection) { // Don´t fire scroll-out on first run when they were never visible
				} else {
					// Run scroll-out handlers
					scroller._scrollOutHandlers.filter(handler => handler.target.origNode() === entry.target)
						.forEach((handler) => {
							handler.handler(entry);
						})
					;
				}
			});
			// scroller._firstIntersection = false;
		}, {
			root: scroller.options().intersection.root,
			rootMargin : scroller.options().intersection.rootMargin,
			threshold: scroller.options().intersection.threshold
		});
	}

	// TODO: Check what happens if same target is observed multiple times
	let targets = Array.isArray(target) ? target : new Array(target);
	targets.forEach((target) => {
		scroller._observer.observe(target.origNode());
	});
}
