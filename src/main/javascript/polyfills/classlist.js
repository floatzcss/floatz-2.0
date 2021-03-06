/**
 * Element.prototype.classList for IE8/9, Safari.
 * Authors & Copyright: Kerem Güneş <k-gun@mail.com>. MIT license
 */
;(function() {
	// Helpers.
	var trim = function(s) {
			return s.replace(/^\s+|\s+$/g, '');
		},
		regExp = function(name) {
			return new RegExp('(^|\\s+)'+ name +'(\\s+|$)');
		},
		forEach = function(list, fn, scope) {
			for (var i = 0; i < list.length; i++) {
				fn.call(scope, list[i]);
			}
		};

	/**
	 * Class list object with basic methods.
	 * @constructor
	 */
	function ClassList(element) {
		this.element = element;
	}

	ClassList.prototype = {
		/**
		 * @param {...string} names
		 */
		add: function(...names) {
			forEach(names, function(name) {
				if (!this.contains(name)) {
					this.element.className = trim(this.element.className +' '+ name);
				}
			}, this);
		},
		/**
		 * @param {...string} names
		 */
		remove: function(...names) {
			forEach(names, function(name) {
				this.element.className = trim(this.element.className.replace(regExp(name), ' '));
			}, this);
		},
		/**
		 * @param {string} name
		 */
		toggle: function(name) {
			return this.contains(name) ? (this.remove(name), false) : (this.add(name), true);
		},
		/**
		 * @param {string} name
		 */
		contains: function(name) {
			return regExp(name).test(this.element.className);
		},
		/**
		 * @param {number} index
		 */
		item: function(index) {
			return this.element.className.split(/\s+/)[index] || null;
		},
		/**
		 * @param {string} oldName
		 * @param {string} newName
		 */
		replace: function(oldName, newName) {
			this.remove(oldName), this.add(newName);
		}
	};

	// IE8/9, Safari
	// Remove this if statements to override native classList.
	if (!('classList' in Element.prototype)) {
		console.debug("floatz | polyfill for classList injected");
		// Use this if statement to override native classList that does not have for example replace() method.
		// See browser compatibility: https://developer.mozilla.org/en-US/docs/Web/API/Element/classList#Browser_compatibility.
		// if (!('classList' in Element.prototype) ||
		//     !('classList' in Element.prototype && Element.prototype.classList.replace)) {
		Object.defineProperty(Element.prototype, 'classList', {
			get: function() {
				return new ClassList(this);
			}
		});
	}

	// For others replace() support.
	if (window.DOMTokenList && !DOMTokenList.prototype.replace) {
		DOMTokenList.prototype.replace = /** @type function(this:DOMTokenList, string, string) */ (ClassList.prototype.replace);
	}
})();