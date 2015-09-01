/*!
 * ClockPicker v{package.version} (http://weareoutman.github.io/clockpicker/)
 * Copyright 2014 Wang Shenwei.
 * Licensed under MIT (https://github.com/weareoutman/clockpicker/blob/gh-pages/LICENSE)
 */

;(function(){
	var $ = window.jQuery,
		$win = $(window),
		$doc = $(document),
		$html = $(document.documentElement),
		$body;

	// Can I use inline svg ?
	var svgNS = 'http://www.w3.org/2000/svg',
		svgSupported = 'SVGAngle' in window && (function(){
			var supported,
				el = document.createElement('div');
			el.innerHTML = '<svg/>';
			supported = (el.firstChild && el.firstChild.namespaceURI) == svgNS;
			el.innerHTML = '';
			return supported;
		})();

	// Can I use transition ?
	var transitionSupported = (function(){
		var style = document.createElement('div').style;
		return 'transition' in style ||
			'WebkitTransition' in style ||
			'MozTransition' in style ||
			'msTransition' in style ||
			'OTransition' in style;
	})();

	// FIXME(alindgren) Corresponds to the css height and width for .clockpicker-tick
	// as I can't seem to figure out how to get the actual width through code
	var TICK_SIZE = 26;

	/**
	 * Get the width of the browser’s scrollbar.
	 * Taken from: https://github.com/VodkaBears/Remodal/blob/master/src/jquery.remodal.js
	 */
	function getScrollbarWidth() {
		if ($html.height() <= $win.height()) {
			return 0;
		}

		var $outer = $('<div style="visibility:hidden;width:100px" />').appendTo('body');

		// Get the width without scrollbars.
		var widthWithoutScroll = $outer[0].offsetWidth;

		// Force adding scrollbars.
		$outer.css('overflow', 'scroll');

		// Add the inner div.
		var $inner = $('<div style="width:100%" />').appendTo($outer);

		// Get the width with scrollbars.
		var widthWithScroll = $inner[0].offsetWidth;

		// Remove the divs.
		$outer.remove();

		// Return the difference between the widths.
		return widthWithoutScroll - widthWithScroll;
	}

	// Listen touch events in touch screen device, instead of mouse events in desktop.
	var touchSupported = 'ontouchstart' in window,
		mousedownEvent = 'mousedown' + ( touchSupported ? ' touchstart' : ''),
		mousemoveEvent = 'mousemove.clockpicker' + ( touchSupported ? ' touchmove.clockpicker' : ''),
		mouseupEvent = 'mouseup.clockpicker' + ( touchSupported ? ' touchend.clockpicker' : '');

	// Vibrate the device if supported
	var vibrate = navigator.vibrate ? 'vibrate' : navigator.webkitVibrate ? 'webkitVibrate' : null;

	function createSvgElement(name) {
		return document.createElementNS(svgNS, name);
	}

	function leadingZero(num) {
		return '' + num;
	}

	// Get a unique id
	var idCounter = 0;
	function uniqueId(prefix) {
		var id = ++idCounter + '';
		return prefix ? prefix + id : id;
	}

	// Clock size
	var dialRadius = 100,
		outerRadius = 80,
		// innerRadius = 80 on 12 hour clock
		innerRadius = 54,
		tickRadius = 13,
		diameter = dialRadius * 2,
		duration = transitionSupported ? 350 : 1;

	// Popover template
	var tpl = [
		'<div class="popover clockpicker-popover">',
			'<div class="arrow"></div>',
			'<div class="clockpicker-popover-wrapper">',
				'<div class="clockpicker-popover-inner">',
					'<div class="popover-title">',
						'<span class="clockpicker-span-blank"></span>',
						'<span class="clockpicker-span-hours cursor-pointer text-primary"></span>',
						'<span class="clockpicker-span-separator"> : </span>',
						'<span class="clockpicker-span-minutes cursor-pointer"></span>',
						'<span class="clockpicker-span-am-pm cursor-pointer"></span>',
					'</div>',
					'<div class="popover-content">',
						'<div class="clockpicker-plate">',
							'<div class="clockpicker-canvas"></div>',
							'<div class="clockpicker-dial clockpicker-hours"></div>',
							'<div class="clockpicker-dial clockpicker-minutes clockpicker-dial-out"></div>',
							'<div class="clockpicker-dial-overlay"></div>',
						'</div>',
						'<div class="clockpicker-am-pm-block"></div>',
					'</div>',
					'<div class="popover-footer">',
					'</div>',
				'</div>',
			'</div>',
		'</div>'
	].join('');

	// ClockPicker
	function ClockPicker(element, options) {
		var popover = $(tpl),
			popoverInner = popover.find('.clockpicker-popover-inner'),
			plate = popover.find('.clockpicker-plate'),
			hoursView = popover.find('.clockpicker-hours'),
			minutesView = popover.find('.clockpicker-minutes'),
			amPmBlock = popover.find('.clockpicker-am-pm-block'),
			popoverContent = popover.find('.popover-content'),
			popoverFooter = popover.find('.popover-footer'),
			spanBlank = popover.find('.clockpicker-span-blank'),
			isInput = element.prop('tagName') === 'INPUT',
			input = options.noInput ? null : isInput ? element : element.find('input'),
			isHTML5 = input && input.prop('type') === 'time',
			addon = element.find('.input-group-addon'),
			self = this,
			timer;

		this.id = uniqueId('cp');
		this.element = element;
		this.options = options;
		this.options.hourStep = this.parseStep(this.options.hourStep, 12);
		this.options.minuteStep = this.parseStep(this.options.minuteStep, 60);
		this.isAppended = false;
		this.isShown = false;
		this.currentView = 'hours';
		this.isInput = isInput;
		this.isHTML5 = isHTML5;
		this.input = input;
		this.addon = addon;
		this.popover = popover;
		this.popoverInner = popoverInner;
		this.popoverContent = popoverContent;
		this.popoverTitle = popover.find('.popover-title');
		this.plate = plate;
		this.hoursView = hoursView;
		this.minutesView = minutesView;
		this.amPmBlock = amPmBlock;
		this.spanHours = popover.find('.clockpicker-span-hours');
		this.spanMinutes = popover.find('.clockpicker-span-minutes');
		this.spanAmPm = popover.find('.clockpicker-span-am-pm');
		this.amOrPm = "";
		this.currentPlacementClass = options.placement;

		popover.toggleClass('clockpicker-popover-inline', options.inline);
		amPmBlock.toggleClass('clockpicker-am-pm-block-hidden', !options.twelveHour);
		spanBlank.html(options.blankTitle);

		// Setup for for 12 hour clock if option is selected
		if (options.twelveHour) {

			$('<button type="button" class="' + (options.klass.amButton || 'btn btn-sm btn-default clockpicker-button am-button') + '">' + options.amText + '</button>')
				.on("click", function() {
					var changed = self.amOrPm !== options.amText;
					if (changed) {
						raiseCallback(options.beforeChange, self.getTime(true));
					}
					self.amOrPm = options.amText;
					self.spanAmPm.empty().append(' ' + self.amOrPm);
					if (changed) {
						raiseCallback(options.afterChange, self.getTime(true));
					}
					self.amOrPmSelected = true;
					if (self.isDisplayingAmPmView) {
						self.toggleView('minutes', duration / 2, true);
						self.autoCloseIfEnabled();
					}
				}).appendTo(this.amPmBlock);


			$('<button type="button" class="' + (options.klass.pmButton || 'btn btn-sm btn-default clockpicker-button pm-button') + '">' + options.pmText + '</button>')
				.on("click", function() {
					var changed = self.amOrPm !== options.pmText;
					if (changed) {
						raiseCallback(options.beforeChange, self.getTime(true));
					}
					self.amOrPm = options.pmText;
					self.spanAmPm.empty().append(' ' + self.amOrPm);
					if (changed) {
						raiseCallback(options.afterChange, self.getTime(true));
					}
					self.amOrPmSelected = true;
					if (self.isDisplayingAmPmView) {
						self.toggleView('minutes', duration / 2, true);
						self.autoCloseIfEnabled();
					}
				}).appendTo(this.amPmBlock);
		}

		if (options.showNow) {
			$('<button type="button" class="' + (options.klass.nowButton || 'btn btn-sm btn-default btn-block clockpicker-button') + '">' + options.nowText + '</button>')
				.click($.proxy(this.now, this))
				.appendTo(popoverFooter);
		}
		if (options.showClear) {
			$('<button type="button" class="' + (options.klass.clearButton || 'btn btn-sm btn-default btn-block clockpicker-button') + '">' + options.clearText + '</button>')
				.click($.proxy(this.clear, this))
				.appendTo(popoverFooter);
		}
		if (options.showDone) {
			// If autoClose is not setted, append a button
			$('<button type="button" class="' + (options.klass.doneButton || 'btn btn-sm btn-default btn-block clockpicker-button') + '">' + options.doneText + '</button>')
				.click($.proxy(this.done, this))
				.appendTo(popoverFooter);
		}

		// Placement and arrow align - make sure they make sense.
		if (/^(top|bottom)/.test(options.placement) && (options.align === 'top' || options.align === 'bottom')) options.align = 'left';
		if ((options.placement === 'left' || options.placement === 'right') && (options.align === 'left' || options.align === 'right')) options.align = 'top';

		if (!options.inline) {
			popover.addClass(options.placement);
			popover.addClass('clockpicker-align-' + options.align);
		}

		this.spanHours.click($.proxy(this.toggleView, this, 'hours'));
		this.spanMinutes.click($.proxy(this.toggleView, this, 'minutes'));
		if (options.twelveHour) {
			this.spanAmPm.click($.proxy(this.toggleView, this, 'ampm'));
		}

		// Show or toggle
		if (!options.inline) {
			if (!options.addonOnly && !options.noInput) {
				input.on('focus.clockpicker click.clockpicker', $.proxy(this.show, this));
			}
			addon.on('click.clockpicker', $.proxy(this.toggle, this));
		}

		// Build ticks
		var tickTpl = $('<div class="clockpicker-tick"></div>'),
			i, tick, radian, radius;

		var displayHour = function(hour) {
			if (hour === 0) {
				return options.twelveHour ? 12 : '00';
			}
			if (Math.floor(hour) !== hour) {
				return '&middot;';
			}
			return hour;
		}

		// Hours view
		if (options.twelveHour) {
			// Add 0 in the middle of the clock
			tick = tickTpl.clone();
			tick.css('font-size', '120%');
			tick.css({
				left: dialRadius - (TICK_SIZE / 2),
				top: dialRadius
			});
			tick.html(0);
			hoursView.append(tick);
			tick.on(mousedownEvent, mousedown);

			for (i = 0; i < 12; i += options.hourStep) {
				tick = tickTpl.clone();
				radian = i / 6 * Math.PI;
				radius = outerRadius;
				tick.css('font-size', '120%');
				tick.css({
					left: dialRadius + Math.sin(radian) * radius - tickRadius,
					top: dialRadius - Math.cos(radian) * radius - tickRadius
				});
				tick.html(displayHour(i));
				hoursView.append(tick);
				tick.on(mousedownEvent, mousedown);
			}
		} else {
			for (i = 0; i < 24; i += options.hourStep) {
				tick = tickTpl.clone();
				radian = i / 6 * Math.PI;
				var inner = i > 0 && i < 13;
				radius = inner ? innerRadius : outerRadius;
				tick.css({
					left: dialRadius + Math.sin(radian) * radius - tickRadius,
					top: dialRadius - Math.cos(radian) * radius - tickRadius
				});
				if (inner) {
					tick.css('font-size', '120%');
				}
				tick.html(displayHour(i));
				hoursView.append(tick);
				tick.on(mousedownEvent, mousedown);
			}
		}

		// Minutes view
		var incrementValue = Math.max(options.minuteStep, 5);
		for (i = 0; i < 60; i += incrementValue) {
			tick = tickTpl.clone();
			radian = i / 30 * Math.PI;
			tick.css({
				left: dialRadius + Math.sin(radian) * outerRadius - tickRadius,
				top: dialRadius - Math.cos(radian) * outerRadius - tickRadius
			});
			tick.css('font-size', '120%');
			tick.html(leadingZero(i));
			minutesView.append(tick);
			tick.on(mousedownEvent, mousedown);
		}

		// Clicking on minutes view space
		plate.on(mousedownEvent, function(e){
			if ($(e.target).closest('.clockpicker-tick').length === 0) {
				mousedown(e, true);
			}
		});

		// Mousedown or touchstart
		function mousedown(e, space) {
			var offset = plate.offset(),
				isTouch = /^touch/.test(e.type),
				x0 = offset.left + dialRadius,
				y0 = offset.top + dialRadius,
				dx = (isTouch ? e.originalEvent.touches[0] : e).pageX - x0,
				dy = (isTouch ? e.originalEvent.touches[0] : e).pageY - y0,
				z = Math.sqrt(dx * dx + dy * dy),
				moved = false;

			// When clicking on minutes view space, check the mouse position
			if (space && (z < outerRadius - tickRadius || z > outerRadius + tickRadius)) {
				return;
			}
			e.preventDefault();

			// Set cursor style of body after 200ms
			var movingTimer = setTimeout(function(){
				$body.addClass('clockpicker-moving');
			}, 200);

			// Place the canvas to top
			if (svgSupported) {
				plate.append(self.canvas);
			}

			// Clock
			self.setHand(dx, dy, true, true);

			// Mousemove on document
			$doc.off(mousemoveEvent).on(mousemoveEvent, function(e){
				e.preventDefault();
				var isTouch = /^touch/.test(e.type),
					x = (isTouch ? e.originalEvent.touches[0] : e).pageX - x0,
					y = (isTouch ? e.originalEvent.touches[0] : e).pageY - y0;
				if (! moved && x === dx && y === dy) {
					// Clicking in chrome on windows will trigger a mousemove event
					return;
				}
				moved = true;
				self.setHand(x, y, true, true);
			});

			// Mouseup on document
			$doc.off(mouseupEvent).on(mouseupEvent, function(e){
				$doc.off(mouseupEvent);
				e.preventDefault();
				var isTouch = /^touch/.test(e.type),
					x = (isTouch ? e.originalEvent.changedTouches[0] : e).pageX - x0,
					y = (isTouch ? e.originalEvent.changedTouches[0] : e).pageY - y0;
				self.setHand(x, y, false, true);
				if (self.currentView === 'hours') {
					if (self.options.toggleMode !== 'never') {
						self.toggleView('minutes', duration / 2);
					}
				} else {
					if (options.twelveHour && !self.amOrPmSelected && options.autoClose) {
						self.toggleView('ampm', duration / 2);
					} else {
						self.autoCloseIfEnabled();
					}
				}
				plate.prepend(canvas);

				// Reset cursor style of body
				clearTimeout(movingTimer);
				$body.removeClass('clockpicker-moving');

				// Unbind mousemove event
				$doc.off(mousemoveEvent);
			});
		}

		if (svgSupported) {
			// Draw clock hands and others
			var canvas = popover.find('.clockpicker-canvas'),
				svg = createSvgElement('svg');
			svg.setAttribute('class', 'clockpicker-svg');
			svg.setAttribute('width', diameter);
			svg.setAttribute('height', diameter);
			var g = createSvgElement('g');
			g.setAttribute('transform', 'translate(' + dialRadius + ',' + dialRadius + ')');
			var bearing = createSvgElement('circle');
			bearing.setAttribute('class', 'clockpicker-canvas-bearing');
			bearing.setAttribute('cx', 0);
			bearing.setAttribute('cy', 0);
			bearing.setAttribute('r', 2);
			var hand = createSvgElement('line');
			hand.setAttribute('x1', 0);
			hand.setAttribute('y1', 0);
			var bg = createSvgElement('circle');
			bg.setAttribute('class', 'clockpicker-canvas-bg');
			bg.setAttribute('r', tickRadius);
			var fg = createSvgElement('circle');
			fg.setAttribute('class', 'clockpicker-canvas-fg');
			fg.setAttribute('r', 3.5);
			g.appendChild(hand);
			g.appendChild(bg);
			g.appendChild(fg);
			g.appendChild(bearing);
			svg.appendChild(g);
			canvas.append(svg);

			this.hand = hand;
			this.bg = bg;
			this.fg = fg;
			this.bearing = bearing;
			this.g = g;
			this.canvas = canvas;
		}

		if (options.inline) {
			$body = this.element.append(this.popover);
			this.isAppended = true;
			this.resetToInitialView();
		}

		raiseCallback(this.options.init);
	}

	function raiseCallback(callbackFunction, argument) {
		if (callbackFunction && typeof callbackFunction === "function") {
			callbackFunction(argument);
		}
	}

	/**
	 * Find most suitable vertical placement, doing our best to ensure it is inside of the viewport.
	 *
	 * First try to place the element according with preferredPlacement, then try the opposite
	 * placement and as a last resort, popover will be placed on the very top of the viewport.
	 *
	 * @param {jQuery} element
	 * @param {jQuery} popover
	 * @param preferredPlacement Preferred placement, if there is enough room for it.
	 * @returns {string} One of: 'top', 'bottom' or 'viewport-top'.
	 */
	function resolveAdaptiveVerticalPlacement(element, popover, preferredPlacement) {
		var popoverHeight = popover.outerHeight(),
			elementHeight = element.outerHeight(),
			elementTopOffset = element.offset().top,
			elementBottomOffset = element.offset().top + elementHeight,
			minVisibleY = elementTopOffset - element[0].getBoundingClientRect().top,
			maxVisibleY = minVisibleY + document.documentElement.clientHeight,
			isEnoughRoomAbove = (elementTopOffset - popoverHeight) >= minVisibleY,
			isEnoughRoomBelow = (elementBottomOffset + popoverHeight) <= maxVisibleY;

		if (preferredPlacement === 'top') {
			if (isEnoughRoomAbove) {
				return 'top';
			} else if (isEnoughRoomBelow) {
				return 'bottom';
			}
		} else {
			if (isEnoughRoomBelow) {
				return 'bottom';
			} else if (isEnoughRoomAbove) {
				return 'top';
			}
		}

		return 'viewport-top';
	}

	ClockPicker.prototype.parseStep = function(givenStepSize, wholeSize) {
		return wholeSize % givenStepSize === 0 ? givenStepSize : 1;
	}

	// Default options
	ClockPicker.DEFAULTS = {
		'default': '',		// default time, 'now' or '13:14' e.g.
		fromNow: 0,			// set default time to * milliseconds from now (using with default = 'now')
		placement: 'bottom',// clock popover placement
		align: 'left',		// popover arrow align
		doneText: 'Done',	// done button text
		clearText: 'Clear',	// clear button text
		nowText: 'Now',		// now button text
		autoClose: false,	// auto close when minute (or if twelveHour, both minute and am/pm) is selected
		showClear: false,	// show clear button
		showNow: false,		// show now button
		showDone: true,		// show done button
		twelveHour: false,	// change to 12 hour AM/PM clock from 24 hour
		amText: 'AM',		// text for AM
		pmText: 'PM',		// text for PM
		vibrate: true,		// vibrate the device when dragging clock hand
		hourStep: 1,		// allow to multi increment the hour
		minuteStep: 1,		// allow to multi increment the minute
		addonOnly: false,	// only open on clicking on the input-addon
		setInput: true,		// set the input value when done
		noInput: false,		// ignore any input element (don't parse or set value)
		showBlank: false,	// show a blank clock for blank input
		blankTitle: '',		// text to show in the title when hours/minutes are both blank
		preventScroll:false,// prevent scrolling while popup is open
		preventClose: false,// prevent close when clicking/focusing outside popup
		toggleMode: 'auto', // set to 'never' to block automatic toggle from hours -- incomplete impl
		inline: false,		// show the clockpicker inline (show/hide does nothing)
		container: null,	// container to insert the clockpicker within (inserts into clockpicker element if inline, inserts into document.body if null)
		offset: null,		// container offset (object with top/left properties) to use to show the popover (if null, uses element.offset())
		klass: {			// custom classes for elements
			amButton: null,
			pmButton: null,
			clearButton: null,
			nowButton: null,
			doneButton: null
		}
	};

	// Show or hide popover
	ClockPicker.prototype.toggle = function(){
		this[this.isShown ? 'hide' : 'show']();
	};

	// Set new placement class for popover and remove the old one, if any.
	ClockPicker.prototype.updatePlacementClass = function(newClass) {
		if (this.currentPlacementClass) {
			this.popover.removeClass(this.currentPlacementClass);
		}
		if (newClass) {
			this.popover.addClass(newClass);
		}

		this.currentPlacementClass = newClass;
	};

	// Set popover position and update placement class, if needed
	ClockPicker.prototype.locate = function(){
		if (this.options.inline) {
			return;
		}

		var element = this.element,
			popover = this.popover,
			offset = this.options.offset || element.offset(),
			width = element.outerWidth(),
			height = element.outerHeight(),
			placement = this.options.placement,
			align = this.options.align,
			styles = {},
			self = this;

		if (placement === 'top-adaptive' || placement === 'bottom-adaptive') {
			var preferredPlacement = placement.substr(0, placement.indexOf('-'));
			// Adaptive placement should be resolved into one of the "static" placement
			// options, that is best suitable for the current window scroll position.
			placement = resolveAdaptiveVerticalPlacement(element, popover, preferredPlacement);

			this.updatePlacementClass(placement !== 'viewport-top' ? placement : '');
		}

		this.popover.addClass('clockpicker-popover-open');

		// Place the popover
		switch (placement) {
			case 'bottom':
				styles.top = offset.top + height;
				break;
			case 'right':
				styles.left = offset.left + width;
				break;
			case 'top':
				styles.top = offset.top - popover.outerHeight();
				break;
			case 'left':
				styles.left = offset.left - popover.outerWidth();
				break;
			case 'viewport-top':
				styles.top = offset.top - element[0].getBoundingClientRect().top;
				break;
		}

		// Align the popover arrow
		switch (align) {
			case 'left':
				styles.left = offset.left;
				break;
			case 'right':
				styles.left = offset.left + width - popover.outerWidth();
				break;
			case 'top':
				styles.top = offset.top;
				break;
			case 'bottom':
				styles.top = offset.top + height - popover.outerHeight();
				break;
		}

		popover.css(styles);
	};

	ClockPicker.prototype.resetToInitialView = function(remainOnCurrentView){
		// Get the time from the input field
		this.parseInputValue();

		this.spanHours.html(this.options.showBlank && this.hoursBlank ? '__' : leadingZero(this.hours));
		this.spanMinutes.html(this.options.showBlank && this.minutesBlank ? '__' : leadingZero(this.minutes));

		if (this.options.twelveHour) {
			this.spanAmPm.empty().append(' ' + this.amOrPm);
		}

		// Toggle to hours view
		this.toggleView(remainOnCurrentView ? (this.isDisplayingAmPmView ? 'ampm' : this.currentView) : 'hours');

		this.amOrPmSelected = false;
	};

	// The input can be changed by the user
	// So before we can use this.hours/this.minutes we must update it
	ClockPicker.prototype.parseInputValue = function(){
		var value = this.timeValue || (!this.options.noInput && this.input.prop('value')) || this.options['default'] || '';
		this.timeValue = null;

		if (value === 'now') {
			value = new Date(+ new Date() + this.options.fromNow);
		}
		if (value instanceof Date) {
			value = value.getHours() + ':' + value.getMinutes();
		}

		value = value.split(':');

		// Remove all non digits and whitespace
		this.hours = (value[0] + '').replace(/[\s]/g, '');
		this.minutes = (value[1] + '').replace(/[\D\s]/g, '');
		this.hoursBlank = !this.hours;
		this.minutesBlank = !this.minutes;
		this.hours = + this.hours;
		this.minutes = + this.minutes;

		if (this.minutes) {
			this.minutes = Math.round(this.minutes / this.options.minuteStep) * this.options.minuteStep;
		}
		if (this.hours) {
			this.hours = Math.round(this.hours / this.options.hourStep) * this.options.hourStep;

			var period = (value[1] + '').replace(/[\d\s]/g, '').toLowerCase();
			var periodIsAm = period === 'am' || period === this.options.amText.toLowerCase();
			var periodIsPm = period === 'pm' || period === this.options.pmText.toLowerCase();
			this.amOrPm = periodIsPm ? this.options.pmText : periodIsAm ? this.options.amText : '';

			if (this.options.twelveHour) {
				//ensure amOrPm has value
				if(!this.amOrPm) {
					this.amOrPm = this.hours >= 12 ? this.options.pmText : this.options.amText;
				}
				if (this.hours > 12) {
					this.hours -= 12;
				} else if (this.hours === 0) {
					this.hours = 12;
				}
			} else {
				if (this.hours < 12 && periodIsPm) {
					this.hours += 12;
				} else if (this.hours >= 12 && periodIsAm) {
					this.hours -= 12;
				}
			}
		} else {
			this.amOrPm = this.options.pmText;
		}
	};

	// Show popover
	ClockPicker.prototype.show = function(e){
		// Not show again
		if (this.isShown || this.options.inline) {
			return;
		}

		raiseCallback(this.options.beforeShow);

		var self = this;

		// Initialize
		if (! this.isAppended) {
			// Append popover to body
			$body = $(this.options.container || document.body).append(this.popover);

			// Reset position when resize
			$win.on('resize.clockpicker' + this.id, function(){
				if (self.isShown) {
					self.locate();
				}
			});

			this.isAppended = true;
		}

		this.resetToInitialView();

		// Set position
		this.locate();

		this.isShown = true;

		//disable body scrolling
		if (this.options.preventScroll) {
			$html.css('overflow', 'hidden').css('padding-right', '+=' + getScrollbarWidth());
		}

		if (!this.options.preventClose) {
			// Hide when clicking or tabbing on any element except the clock, input and addon
			$doc.on('click.clockpicker.' + this.id + ' focusin.clockpicker.' + this.id, function(e){
				var target = $(e.target);
				if (target.closest(self.popoverInner).length === 0 &&
						target.closest(self.addon).length === 0 &&
						target.closest(self.input).length === 0) {
					self.hide();
				}
			});

			// Hide when ESC is pressed
			$doc.on('keyup.clockpicker.' + this.id, function(e){
				if (e.keyCode === 27) {
					self.hide();
				}
			});
		}

		raiseCallback(this.options.afterShow);
	};

	// Hide popover
	ClockPicker.prototype.hide = function(){
		if (this.options.inline) {
			return;
		}

		raiseCallback(this.options.beforeHide);

		this.isShown = false;

		//enable body scrolling
		if (this.options.preventScroll) {
			$html.css('overflow', '').css('padding-right', '-=' + getScrollbarWidth());
		}

		// Unbinding events on document
		$doc.off('click.clockpicker.' + this.id + ' focusin.clockpicker.' + this.id);
		$doc.off('keyup.clockpicker.' + this.id);

		this.popover.removeClass('clockpicker-popover-open');

		raiseCallback(this.options.afterHide);
	};

	// Toggle to hours or minutes view
	ClockPicker.prototype.toggleView = function(view, delay, dontResetClock){
		var raiseAfterHourSelect = false;
		if (view === 'minutes' && $(this.hoursView).css("visibility") === "visible") {
			raiseCallback(this.options.beforeHourSelect);
			raiseAfterHourSelect = true;
		}
		var isHours = view === 'hours',
			isMinutes = view === 'minutes',
			isAmPm = !isHours && !isMinutes,
			nextView = isHours ? this.hoursView : this.minutesView,
			hideView = isHours ? this.minutesView : this.hoursView;

		view = isAmPm ? 'minutes' : view;
		this.currentView = view;
		this.isDisplayingAmPmView = isAmPm;

		this.spanHours.toggleClass('text-primary', isHours);
		this.spanMinutes.toggleClass('text-primary', isMinutes);
		this.spanAmPm.toggleClass('text-primary', isAmPm);
		this.popoverContent.toggleClass('clockpicker-am-pm-active', isAmPm);

		// Let's make transitions
		hideView.addClass('clockpicker-dial-out');
		nextView.css('visibility', 'visible').removeClass('clockpicker-dial-out');

		// Reset clock hand
		if (!dontResetClock) {
			this.resetClock(delay);
		}

		// After transitions ended
		clearTimeout(this.toggleViewTimer);
		this.toggleViewTimer = setTimeout(function(){
			hideView.css('visibility', 'hidden');
		}, duration);

		if (raiseAfterHourSelect) {
			raiseCallback(this.options.afterHourSelect);
		}
	};

	// Reset clock hand
	ClockPicker.prototype.resetClock = function(delay){
		if (this.isDisplayingAmPmView) {
			return;
		}
		var view = this.currentView,
			isHours = view === 'hours',
			value = isHours ? this.hours + (this.minutes / 60) : this.minutes,
			isZero = isHours && value === 0,
			unit = Math.PI / (isHours ? 6 : 30),
			radian = value * unit;

		var radius;
		if (isHours && isZero) {
			radius = TICK_SIZE / 2;
			radian = Math.PI * 3;
		} else if (isHours && value > 0 && value < 13) {
			radius = innerRadius;
		} else {
			radius = outerRadius;
		}

		var x = Math.sin(radian) * radius;
		var y = - Math.cos(radian) * radius;

		var self = this;

		if (svgSupported && delay) {
			self.canvas.addClass('clockpicker-canvas-out');
			setTimeout(function(){
				self.canvas.removeClass('clockpicker-canvas-out');
				self.setHand(x, y, false, false);
			}, delay);
		} else {
			this.setHand(x, y, false, false);
		}
	};

	// Set clock hand to (x, y)
	ClockPicker.prototype.setHand = function(x, y, dragging, setValue){
		if (this.isDisplayingAmPmView) {
			return;
		}
		var radian = Math.atan2(x, - y),
			isHours = this.currentView === 'hours',
			z = Math.sqrt(x * x + y * y),
			options = this.options,
			inner = isHours && z < (outerRadius + innerRadius) / 2,
			radius = inner ? innerRadius : outerRadius,
			unit,
			value;


		// Support a zero value in the middle of the clock
		var isZero = z < TICK_SIZE;

		// Calculate the unit
		if (isHours) {
			unit = options.hourStep / 6 * Math.PI;
		} else {
			unit = options.minuteStep / 30 * Math.PI;
		}

		if (options.twelveHour) {
			radius = outerRadius;
		}

		// Radian should in range [0, 2PI]
		if (radian < 0) {
			radian = Math.PI * 2 + radian;
		}

		// Get the round value
		if (isZero) value = 0;
		else value = Math.round(radian / unit);

		if (isZero) radius = TICK_SIZE / 2;

		// Get the round radian
		if (isZero) radian = Math.PI * 3;
		else radian = value * unit;

		// Correct the hours or minutes
		if (isHours) {
			value *= options.hourStep;

			if (! options.twelveHour && (!inner)==(value>0)) {
				value += 12;
			}
			if (options.twelveHour && value === 0 && !isZero) {
				value = 12;
			}
			if (value === 24) {
				value = 0;
			}
		} else {
			value *= options.minuteStep;
			if (value === 60) {
				value = 0;
			}
		}

		// Once hours or minutes changed, vibrate the device
		if (this[this.currentView] !== value) {
			if (vibrate && this.options.vibrate) {
				// Do not vibrate too frequently
				if (! this.vibrateTimer) {
					navigator[vibrate](10);
					this.vibrateTimer = setTimeout($.proxy(function(){
						this.vibrateTimer = null;
					}, this), 100);
				}
			}
		}

		var lastValue = this[this.currentView];
		if (setValue && lastValue !== value) {
			raiseCallback(options.beforeChange, this.getTime(true));
			this[this.currentView] = value;
			this[this.currentView + 'Blank'] = false;
		}
		var isBlank = options.showBlank && this[this.currentView + 'Blank'];
		this[isHours ? 'spanHours' : 'spanMinutes'].html(isBlank ? '__' : leadingZero(value));

		var useBlankTitleClass = isBlank && !!options.blankTitle && this[(isHours ? 'minutesBlank' : 'hoursBlank')];
		this.popoverTitle.toggleClass('blank', useBlankTitleClass);

		// If svg is not supported, just add an active class to the tick
		if (!svgSupported && !isBlank) {
			this[isHours ? 'hoursView' : 'minutesView'].find('.clockpicker-tick').each(function(){
				var tick = $(this);
				tick.toggleClass('active', value === + tick.html());
			});
			return;
		}

		// Place clock hand at the top when dragging
		if (dragging || (! isHours && value % 5)) {
			this.g.insertBefore(this.hand, this.bearing);
			this.g.insertBefore(this.bg, this.fg);
			this.bg.setAttribute('class', 'clockpicker-canvas-bg clockpicker-canvas-bg-trans');
		} else {
			// Or place it at the bottom
			this.g.insertBefore(this.hand, this.bg);
			this.g.insertBefore(this.fg, this.bg);
			this.bg.setAttribute('class', 'clockpicker-canvas-bg');
		}

		// Set clock hand and others' position
		var cx = Math.sin(radian) * radius,
			cy = - Math.cos(radian) * radius;
		this.hand.setAttribute('x2', cx);
		this.hand.setAttribute('y2', cy);
		this.bg.setAttribute('cx', cx);
		this.bg.setAttribute('cy', cy);
		this.fg.setAttribute('cx', cx);
		this.fg.setAttribute('cy', cy);

		this.canvas.toggle(!isBlank);

		if (setValue && lastValue !== value) {
			raiseCallback(options.afterChange, this.getTime(true));
		}
	};

	// Allow user to get time time as Date object
	ClockPicker.prototype.getTime = function(current, callback) {
		if(typeof current === "function") {
			callback = current;
			current = false;
		}

		if(!current) {
			this.parseInputValue();
		}

		var hours = this.hours;
		if (this.options.twelveHour) {
			if (hours < 12 && this.amOrPm === this.options.pmText) {
				hours += 12;
			} else if (hours >= 12 && this.amOrPm === this.options.amText) {
				hours -= 12;
			}
		}

		var selectedTime = new Date();
		selectedTime.setMinutes(this.minutes)
		selectedTime.setHours(hours);
		selectedTime.setSeconds(0);

		if(this.options.showBlank && this.hoursBlank) {
			return null;
		}

		return callback && callback.apply(this.element, selectedTime) || selectedTime;
	};

	ClockPicker.prototype.setTime = function(time, updateClock) {
		this.timeValue = time;
		if (updateClock) {
			this.resetToInitialView(true);
		}
	};

	// Hours and minutes are selected
	ClockPicker.prototype.done = function() {
		raiseCallback(this.options.beforeDone);
		this.hide();

		if(this.options.setInput && !this.options.noInput) {
			var last = this.input.prop('value'),
				outHours = this.hours,
				value = ':' + leadingZero(this.minutes);

			if (this.isHTML5 && this.options.twelveHour) {
				if (this.hours < 12 && this.amOrPm === this.options.pmText) {
					outHours += 12;
				}
				if (this.hours >= 12 && this.amOrPm === this.options.amText) {
					outHours -= 12;
				}
			}

			value = leadingZero(outHours) + value;

			if (!this.isHTML5 && this.options.twelveHour) {
				value = value + ' ' + this.amOrPm;
			}

			this.input.prop('value', value);
			if (value !== last) {
				this.input.triggerHandler('change');
				if (! this.isInput) {
					this.element.trigger('change');
				}
			}
		}

		raiseCallback(this.options.afterDone);
	};

	ClockPicker.prototype.clear = function() {
		raiseCallback(this.options.beforeClear);
		this.hide();

		if(this.options.setInput && !this.options.noInput) {
			var last = this.input.prop('value'),
				value = null;

			this.input.prop('value', value);
			if (value !== last) {
				this.input.triggerHandler('change');
				if (! this.isInput) {
					this.element.trigger('change');
				}
			}
		}

		raiseCallback(this.options.afterClear);
	};

	ClockPicker.prototype.now = function() {
		raiseCallback(this.options.beforeChange, this.getTime(true));
		var date = new Date();
		this.hours = date.getHours();
		this.minutes = date.getMinutes();
		if (this.options.twelveHour) {
			this.amOrPm === this.options.amText;
			if(this.hours === 0) {
				this.hours = 12;
			} else if(this.hours > 12) {
				this.amOrPm = this.options.pmText;
				this.hours -= 12;
			}
		}
		raiseCallback(this.options.afterChange, this.getTime(true));
		this.done();
	};

	ClockPicker.prototype.autoCloseIfEnabled = function() {
		var anyBlank = this.minutesBlank || this.hoursBlank;
		if (this.options.autoClose && !anyBlank) {
			var self = this;
			this.minutesView.addClass('clockpicker-dial-out');
			setTimeout(function(){
				self.done();
			}, duration / 2);
		}
	};

	// Remove clockpicker from input
	ClockPicker.prototype.remove = function() {
		this.element.removeData('clockpicker');
		if (this.input) {
			this.input.off('focus.clockpicker click.clockpicker');
		}
		if (this.addon) {
			this.addon.off('click.clockpicker');
		}
		if (this.isShown) {
			this.hide();
		}
		if (this.isAppended) {
			$win.off('resize.clockpicker' + this.id);
			this.popover.remove();
		}
	};

	// Extends $.fn.clockpicker
	$.fn.clockpicker = function(option){
		var args = Array.prototype.slice.call(arguments, 1);

		function handleClockPickerRequest() {
			var $this = $(this),
				data = $this.data('clockpicker');
			if (! data) {
				var options = $.extend({}, ClockPicker.DEFAULTS, $this.data(), typeof option == 'object' && option);
				$this.data('clockpicker', new ClockPicker($this, options));
			} else {
				// Manual operations. show, hide, remove, getTime, e.g.
				if (typeof data[option] === 'function') {
					return data[option].apply(data, args);
				}
			}
		}

		// If we explicitly do a call on a single element then we can return the value (if needed)
		// This allows us, for example, to return the value of getTime
		if (this.length == 1) {
			var returnValue = handleClockPickerRequest.apply(this[0]);

			// If we do not have any return value then return the object itself so you can chain
			return returnValue !== undefined ? returnValue : this;
		}

		// If we do have a list then we do not care about return values
		return this.each(handleClockPickerRequest);
	};
}());
