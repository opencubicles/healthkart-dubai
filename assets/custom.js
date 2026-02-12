"use strict";


/*! Global scope initializations -------------------------------------------------- */
let html_tag = document.documentElement;
let root_styles = html_tag;
let top_id = document.querySelector('.shopify-section-header');
let nav_top_id = document.querySelector('#nav-top');
let header_outer = document.querySelector('#header-outer');
let header_inner = document.querySelector('#header-inner');
let header_id = header_outer ? header_outer.querySelector('#header') : null;
let search_id = document.querySelector('#search');
let nav_outer = document.querySelector('#nav-outer');
let nav_bar_id = document.querySelector('#nav-bar');
let nav_id = document.querySelector('#nav');
let nav_main = nav_bar_id ?? nav_id;
let content_id = document.getElementById('content');

const viewportWidth = window.innerWidth;
const mediaMax1000 = window.matchMedia('(max-width: 1000px)');
const mediaMin1000 = window.matchMedia('(min-width: 1001px)');

const asyncOnce = {
	once: true
};
const asyncPass = {
	passive: true,
	once: true
};

html_tag.classList.add('js');




/*! Environment & feature detection -------------------------------------------------- */

// Returns a filepath from window.filepaths by key, or falls back to the local path.
const fp = (localPath, key) => (window.filepaths && window.filepaths[key]) || localPath;


// Checks if the user is on a mobile or touch-capable device.
const isMobile = window.matchMedia("(pointer: coarse)").matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

html_tag.classList.add(isMobile ? 'mobile' : 'no-mobile');


// Checks if the current page is NOT a fully initialized Shopify store.
const isShopify = () => window.Shopify === undefined || Object.keys(window.Shopify).length < 3;


// Checks if Shopify Theme Editor (designMode) is active on this page
const isShopifyDesignMode = () => { return typeof window.Shopify !== 'undefined' && !!window.Shopify.designMode; };


// Checks if :has() pseudo-selector is supported
const isHasSelectorSupported = () => {
	try {
		document.querySelector(':has(*)');
		return true;
	} catch (e) {
		return false;
	}
};


// Sets global text direction based on <html dir> attribute (RTL or LTR).
const global_dir = html_tag.getAttribute('dir') === 'rtl' ? ['rtl', false] : ['ltr', true];


// Returns the current HTML theme if it's in the allowed list.
const getHtmlTheme = (themes = ['xclusive', 'xtra']) => {
	const theme = html_tag.dataset.theme ? html_tag.dataset.theme.toLowerCase() : null;
	return theme && themes.includes(theme) ? theme : null;
};




/*! Helper Functions -------------------------------------------------- */

// Moves all .popup-a elements from #content to be direct children of #root (and keeps doing so for dynamically added popups) to avoid z-index/stacking issues.
const initPopupRootRelocator = (function () {
	if (window.__popupRelocatorInitialized) return;
	window.__popupRelocatorInitialized = true;

	const MOVED_ATTR = 'data-popup-moved';

	function movePopupToRoot(popup, root_id) {
		if (!popup || popup.nodeType !== 1) return;
		if (popup.getAttribute(MOVED_ATTR) === '1') return;

		root_id.appendChild(popup);
		popup.setAttribute(MOVED_ATTR, '1');
	}

	function relocateNow() {
		const root_id = document.getElementById('root') || document.body;

		if (!root_id || !content_id) return false;

		const popups = content_id.querySelectorAll('.popup-a');
		for (let i = 0; i < popups.length; i++) {
			movePopupToRoot(popups[i], root_id);
		}

		if (!window.__popupRelocatorContentObserver && 'MutationObserver' in window) {
			const obs = new MutationObserver(mutations => {
				for (let m = 0; m < mutations.length; m++) {
					const added = mutations[m].addedNodes;
					for (let j = 0; j < added.length; j++) {
						const node = added[j];
						if (!node || node.nodeType !== 1) continue;

						if (node.classList && node.classList.contains('popup-a')) {
							movePopupToRoot(node, root_id);
							continue;
						}

						if (node.querySelectorAll) {
							const nested = node.querySelectorAll('.popup-a');
							for (let k = 0; k < nested.length; k++) {
								movePopupToRoot(nested[k], root_id);
							}
						}
					}
				}
			});

			obs.observe(content_id, {
				childList: true,
				subtree: true
			});
			window.__popupRelocatorContentObserver = obs;
		}

		return true;
	}

	if (relocateNow()) return;

	if ('MutationObserver' in window) {
		const bootObs = new MutationObserver(() => {
			if (relocateNow()) bootObs.disconnect();
		});
		bootObs.observe(document.documentElement, {
			childList: true,
			subtree: true
		});
	} else {
		document.addEventListener('DOMContentLoaded', relocateNow, {
			once: true
		});
	}
})();


// Returns all sibling elements of a given element, excluding the element itself.
const getSiblings = el => el?.parentNode ? [...el.parentNode.children].filter(s => s !== el) : [];


// Appends an <a> element with given content, class, href, and optional accessibility attributes to a target element.
const append_url = (el, content, className, href, access) => {
	if (!el) return;

	const link = createElementWithClass('a', className);
	link.href = href || '#';

	if (access) {
		link.tabIndex = -1;
		link.setAttribute('aria-hidden', 'true');
		link.setAttribute('focusable', 'false');
	}

	link.innerHTML = content;
	el.appendChild(link);
};


// Dynamically adds a CSS <link> to the document if not already present, optionally after existing <link> elements.
function new_css(id, href, media) {
	if (document.getElementById(id)) return;
	const link = document.createElement('link');
	media = media || 'screen';

	link.setAttribute('id', id);
	link.setAttribute('rel', 'stylesheet');
	link.setAttribute('href', href);
	link.setAttribute('media', media);

	const css = document.querySelectorAll('link[id]');
	if (css.length) {
		css[css.length - 1].after(link);
	} else {
		document.head.appendChild(link);
	}
}


// Loads an external JS file and runs a callback when it's loaded.
function loadRes(u, c, i) {
	const loaded = html_tag.classList.contains(i);

	if (loaded) {
		if (typeof c === 'function') c();
		return true;
	}
	const s = document.createElement('script');
	s.src = u;
	s.async = true;
	if (typeof c === 'function') {
		s.onload = c;
	}
	s.onerror = () => console.warn(`Script failed: ${u}`);
	document.body.appendChild(s);

	html_tag.classList.add(i);
}


// Returns a throttled version of a function that executes at most once per specified delay.
function throttle(callback, delay) {
	let timeoutId;
	return function () {
		if (!timeoutId) {
			timeoutId = setTimeout(() => {
				callback();
				timeoutId = null;
			}, delay);
		}
	};
}


// Clones the given element, adds class to the clone, inserts it after the original, and adds class to the original element.
function clone_with_class(el, cl1, cl2) {
	if (!el) return;
	const cln = el.cloneNode(true);
	cln.classList.add(cl1);
	el.after(cln);
	el.classList.add(cl2);
}


// Initializes a Swiper slider on the given element, wrapping children as slides, setting up navigation, pagination, accessibility roles, and handling optional image overlays.
function create_slider(el, settings, minSlides) {
	const imgOverlays = [];
	let bg = false;
	const children = Array.from(el.children);
	const childrenLength = children.length;

	for (let i = 0; i < childrenLength; i++) {
		const child = children[i];
		if (child.classList.contains('img-overlay')) {
			bg = true;
			imgOverlays.push(child);
			child.remove();
		}
	}

	if (childrenLength > 1) {
		if (el.tagName.toLowerCase() === 'ul') {
			const ul = el;

			requestAnimationFrame(() => {
				ul.setAttribute('role', 'none');
				for (let i = 0; i < childrenLength; i++) {
					const li = children[i];
					li.setAttribute('role', 'none');
					li.classList.add('li');
				}
			});
		}

		minSlides = minSlides || 1;

		if (childrenLength > parseFloat(minSlides)) {
			let paginationClass = (settings && settings.pagination && settings.pagination.el) || ".swiper-pagination";
			paginationClass = paginationClass.replace(/\./g, " ").trim();

			const dots = document.createElement('span');
			dots.className = paginationClass;

			const prev = document.createElement('span');
			prev.classList.add('swiper-button-prev', 'swiper-button-nav');

			const next = document.createElement('span');
			next.classList.add('swiper-button-next', 'swiper-button-nav');

			el.classList.add('s4wi');

			requestAnimationFrame(() => {
				prev.setAttribute('role', 'navigation');
				next.setAttribute('role', 'navigation');
			});

			const slidesFragment = document.createDocumentFragment();
			for (let i = 0; i < childrenLength; i++) {
				const child = children[i];
				const wrapper = document.createElement('div');
				wrapper.classList.add('swiper-slide');
				wrapper.appendChild(child);
				slidesFragment.appendChild(wrapper);
			}

			const swiperOuter = document.createElement('div');
			swiperOuter.className = 'swiper-outer';

			const swiperWrapper = document.createElement('div');
			swiperWrapper.className = 'swiper-wrapper';
			swiperWrapper.appendChild(slidesFragment);

			swiperOuter.appendChild(swiperWrapper);

			const swiperFragment = document.createDocumentFragment();
			swiperFragment.appendChild(swiperOuter);

			// Pagination
			const pagination = document.createElement('div');
			pagination.className = 'swiper-custom-pagination';
			swiperFragment.appendChild(pagination);

			if (settings && settings.pagination) {
				settings.pagination.el = settings.pagination.el || pagination;
				pagination.append(prev, dots, createElementWithClass('span', 'swiper-custom-fraction'), next);
			} else {
				const navFragment = document.createDocumentFragment();
				navFragment.append(prev, next);
				swiperFragment.appendChild(navFragment);
			}

			el.appendChild(swiperFragment);


			// Navigation
			settings.navigation = settings.navigation || {};
			settings.navigation.prevEl = prev;
			settings.navigation.nextEl = next;

			const swiperInstance = new Swiper(swiperOuter, settings);

			requestAnimationFrame(() => {
				const paginationBullets = el.querySelectorAll('.swiper-pagination-bullet');
				for (let i = 0; i < paginationBullets.length; i++) {
					paginationBullets[i].setAttribute('role', 'navigation');
				}
			});

			return swiperInstance;
		}
	}
	if (bg) {
		requestAnimationFrame(() => {
			for (let i = 0; i < imgOverlays.length; i++) {
				const imgOverlay = imgOverlays[i];
				el.appendChild(imgOverlay);
			}
		});
	}

	return null;
}


// Assignes random number for better control of slider elements.
function randomize(el) {
	el.setAttribute('data-random', Math.floor(Math.random() * 10000) + 1);
}


// Sets the z-index of each element so the first element is on top and the last is at the bottom
function assignIndex(elements) {
	elements.forEach((el, index) => {
		el.style.zIndex = elements.length - index;
	});
}


// Creates an element of the given tag and applies one or multiple CSS classes.
function createElementWithClass(tag, classList) {
	const el = document.createElement(tag);
	if (!Array.isArray(classList)) classList = [classList];
	el.classList.add(...classList);
	return el;
}


// Schedules the callback to run when the browser is idle (using requestIdleCallback when available, falling back to a short setTimeout).
function runWhenIdle(fn) {
	if ('requestIdleCallback' in window) {
		requestIdleCallback(fn, {
			timeout: 2000
		});
	} else {
		setTimeout(fn, 300);
	}
}


// ensures Swiper sliders update their auto height on load, resize, and when entering viewport, skipping theme editor mode.  
function updateSliders(el) {
	if (!el.classList.contains('s4wi')) return;

	const sl_el = el.querySelector('.swiper-outer');
	if (!sl_el) return;

	function io(entries) {
		for (const entry of entries) {
			if (entry.isIntersecting && sl_el.swiper) {
				sl_el.swiper.updateAutoHeight();
			}
		}
	}

	new IntersectionObserver(io).observe(el);

	setTimeout(() => {
		if (sl_el.swiper) {
			sl_el.swiper.updateAutoHeight();
		}
	}, 300);
}




/*! Layout utilities -------------------------------------------------- */

// Calculates and sets '--sticky_offset' for sticky headers, updating on scroll, resize, or user interaction, with throttling.
let stickyOffsetCalculated = false;
let stickyOffsetScheduled = false;
let stickyListenersAdded = false;

const SO_req = ['.m6pr', '[id^="section-"]', '.f8ps', '.f8sr', '.m6cl', '.m6ac'];
const requiredElementsExist = SO_req.some(sel => document.querySelector(sel));

function stickyOffset() {
	if (stickyOffsetScheduled) return;
	stickyOffsetScheduled = true;

	requestAnimationFrame(() => {
		stickyOffsetScheduled = false;

		if (stickyOffsetCalculated || !nav_main || !header_outer || !header_inner) return;
		if (!requiredElementsExist) return;

		const setStickyOffset = () => {
			const h = header_outer.getBoundingClientRect().height;
			html_tag.style.setProperty('--sticky_offset', `${h}px`);
		};

		const setNavMainOffset = () => {
			const h = nav_main.getBoundingClientRect().height;
			html_tag.style.setProperty('--sticky_offset', `${h}px`);
		};

		const updateSticky = () => {
			if (mediaMax1000.matches) {
				setStickyOffset();
			} else if (mediaMin1000.matches) {
				setNavMainOffset();
			}
		};

		if (header_inner.classList.contains('sticky-nav')) {
			html_tag.classList.add('has-sticky-nav');
			updateSticky();

			if (!stickyListenersAdded) {
				mediaMax1000.addEventListener('change', updateSticky);
				mediaMin1000.addEventListener('change', updateSticky);
				stickyListenersAdded = true;
			}
		} else {
			setStickyOffset();
		}

		stickyOffsetCalculated = true;
	});
}

if (!isMobile) {
	window.addEventListener('mousemove', stickyOffset, asyncOnce);
}
document.addEventListener('scroll', stickyOffset, asyncPass);
window.addEventListener('resize', throttle(() => {
	stickyOffsetCalculated = false;
	stickyOffset();
}, 500));


// Calculates and sets the browser scrollbar width as a CSS variable
let scrollbarWidth = null;

function getScrollbarWidth() {
	if (scrollbarWidth !== null) return scrollbarWidth;

	/*const div = document.createElement('div');
	Object.assign(div.style, {
		width: '100px',
		height: '100px',
		overflow: 'scroll',
		position: 'absolute',
		top: '-9999px'
	});
	document.body.appendChild(div);

	scrollbarWidth = div.offsetWidth - div.clientWidth;
	document.body.removeChild(div);*/
	const docWidth = html_tag.clientWidth;

	scrollbarWidth = viewportWidth - docWidth;

	if (scrollbarWidth < 0) {
		scrollbarWidth = 0;
	}

	html_tag.style.setProperty('--scrollbar_width', scrollbarWidth + 'px');
	return scrollbarWidth;
}

if (mediaMin1000.matches) {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			runWhenIdle(getScrollbarWidth);
		});
	} else {
		runWhenIdle(getScrollbarWidth);
	}
}
if (isShopifyDesignMode()) {
	window.addEventListener('resize', () => {
		runWhenIdle(() => getScrollbarWidth(true));
	});
}


// Checks the #header-inner element and adds classes to <html> based on its state, e.g., for mobile search visibility or specific header type styling.
if (header_inner) {
	if (header_inner.classList.contains('mobile-visible-search')) {
		html_tag.classList.add('has-mobile-visible-search');
	}

	if (header_inner.classList.contains('t1nn')) {
		html_tag.classList.add('t1nn');
	}
}


// On window resize (throttled), adjusts custom dropdown height and updates CSS variable for static header height.
window.addEventListener('resize', throttle(() => {
	customDropHeight();

	if (!header_outer || !header_inner) return;

	requestAnimationFrame(() => {
		const headerHeight = header_outer.getBoundingClientRect().height + 'px';
		html_tag.style.setProperty('--header_height_static', headerHeight);
	});
}, 500));


// Updates CSS custom properties with the current heights of the header and top navigation if certain header elements exist.
function customDropHeight() {
	if (!nav_main) return;

	const HH_req = ['.m6fr.wide-transparent', '.m6fr.size-xl', '.m6fr article.size-xl'];
	const hasHH = HH_req.some(selector => document.querySelector(selector));
	if (!hasHH) return;

	requestAnimationFrame(function () {
		if (header_outer && header_inner) {
			const headerHeight = header_outer.getBoundingClientRect().height + 'px';
			html_tag.style.setProperty('--header_height_static', headerHeight);
		}
		if (nav_top_id) {
			const nav_top_idHeight = nav_top_id.getBoundingClientRect().height + 'px';
			html_tag.style.setProperty('--nav_top_h', nav_top_idHeight);
		}
	});
}


// Ensures customDropHeight runs after the logo image is loaded, or immediately if the image is missing or already loaded, so header heights are calculated correctly.
let logo_id = document.querySelector('#logo');
let logo_img = null;
if (logo_id) {
	logo_img = logo_id.querySelector('img') || null;
}

if (logo_img) {
	if (logo_img.complete) {
		customDropHeight();
	} else {
		logo_img.addEventListener('load', customDropHeight);
	}
} else {
	customDropHeight();
}


// Enables breadcrumb "back" functionality if referrer is same site, otherwise removes the element
const breadcrumb_back = document.querySelectorAll('.breadcrumb-back');
if (breadcrumb_back) {
	for (const el of breadcrumb_back) {
		if (document.referrer.includes(window.location.host)) {
			el.addEventListener('click', e => {
				e.preventDefault();
				history.back();
			});
		} else {
			el.remove();
		}
	}
}


// Adds alignment classes to content if elements with .align-middle or .align-center are alone within their parent/grandparent
const alignMiddleElements = document.getElementsByClassName('align-middle');
const alignCenterElements = document.getElementsByClassName('align-center');

function checkAndAddClass(elements, className) {
	for (const el of elements) {
		const parent = el.parentNode;
		const grandparent = parent ? parent.parentNode : null;

		const isCenterElement = (
			(el.previousElementSibling === null && el.nextElementSibling === null && parent.id === 'content') ||
			(el.previousElementSibling === null && el.nextElementSibling === null && parent.previousElementSibling === null && parent.nextElementSibling === null && grandparent.id === 'content')
		);

		if (isCenterElement) {
			content_id.classList.add(className);
		}
	}
}

checkAndAddClass(alignMiddleElements, 'align-center');
checkAndAddClass(alignCenterElements, 'align-center-static');


// .l4ft .content.box - adds 'has-content-box' class to the closest <li> of each '.l4ft .content.box' element if :has() selector is not supported
if (!isHasSelectorSupported()) {
	const list_featured_content_box = document.querySelectorAll('.l4ft .content.box');
	for (const el of list_featured_content_box) {
		let closestLi = el.closest('li');
		if (closestLi) {
			closestLi.classList.add('has-content-box');
		}
	}
}


// Scrolls to a previously clicked "load more" item after page load, centering it and using manual scroll restoration
function scrollToTargetAdjusted(el) {
	if ('scrollRestoration' in history) {
		history.scrollRestoration = 'manual';
	}
	el.scrollIntoView({
		block: 'center'
	});
}

const loadMoreItemClicked = localStorage.getItem('loadMoreItemClicked');
if (loadMoreItemClicked) {
	const loadMoreSelectors = [
        `#collection > li > figure > a[href="${loadMoreItemClicked}"]`,
        `.m6cl .results > div a[href="${loadMoreItemClicked}"]`,
        `.m6cl .results > .l4ne a[href="${loadMoreItemClicked}"]`
    ];

	const loadMoreTarget = document.querySelector(loadMoreSelectors.join(', '));
	const loadMoreURL = window.location.href;

	if (loadMoreTarget && !loadMoreURL.includes(loadMoreItemClicked)) {
		scrollToTargetAdjusted(loadMoreTarget);
	}

	localStorage.removeItem('loadMoreItemClicked');
}




/*! Custom Events -------------------------------------------------- */
let quickShopEvt = new CustomEvent('quickShop');
let ajaxCartEvt = new CustomEvent('ajaxCart');
let searchClassesEvt = new CustomEvent('searchClasses');
let inputPaddingEvt = new CustomEvent('inputPadding');


// Sets header transparency and HTML classes based on first content section type, width, and announcement bar presence.
const transparentHeaderEvt = new CustomEvent('transparentHeaderAsync');
window.addEventListener('transparentHeaderAsync', function () {

	if (!content_id || !header_inner) return;

	const ffa = content_id.children[0];
	let ffc;
	let ffd = false;
	let ffe = false;


	if (ffa) {
		ffc = ffa.children[0];
		if (ffa.classList.contains('shopify-section') && header_inner.hasAttribute('data-transparent')) {
			ffd = true;
		}

		if (ffc && (ffc.classList.contains('m6bx') || ffc.classList.contains('m6fr')) && ffc.classList.contains('wide')) {
			ffe = true;
			ffc.classList.add('im-tr');
		}
		if (ffd) {
			const announcementBar = document.querySelector('.shopify-section-header ~ [class*="shopify-section-announcement-bar"]');
			if (announcementBar) ffd = false;
		}
		if (ffd && ffe && ffc && ffc.classList.contains('wide-transparent')) {
			top_id.classList.add('transparent');
			html_tag.classList.add('has-first-m6fr-wide');
			if (ffc.classList.contains('m6bx')) html_tag.classList.add('has-first-m6bx-wide');

			const hasFlexible = ffc.classList.contains('flexible-section');
			html_tag.classList.toggle('has-first-flexbile-wide', hasFlexible);

			ffc.classList.add('is-first-m6fr-wide');

			const slides = ffa.querySelectorAll('.swiper-slide-active article');
			const firstSlide = slides.length > 0 ? slides[0] : ffa.querySelector('article');

			const fallbackEl = ffa.querySelector('.m6fr');
			const palette = (firstSlide && firstSlide.getAttribute('data-color-palette')) || (fallbackEl && fallbackEl.getAttribute('data-active-content-desktop'));

			if (palette) {
				setTimeout(function () {
					const base = palette.replace('_gradient', '');

					html_tag.style.setProperty('--transparent_header_fg', `var(--${base}_fg)`);
					html_tag.style.setProperty('--transparent_header_bg', `var(--${palette}_bg)`);
					html_tag.style.setProperty('--transparent_header_btn_bg', `var(--${base}_btn_bg)`);
					html_tag.style.setProperty('--transparent_header_btn_fg', `var(--${base}_btn_fg)`);

					const bd = (palette.includes('white') || palette.includes('light')) ? 'var(--header_border_color_light)' : 'var(--header_border_color_dark)';

					html_tag.style.setProperty('--transparent_header_bd', bd);
				}, 0);
			}
		} else {
			header_inner.classList.remove('transparent');
			html_tag.classList.remove('has-first-m6fr-wide', 'has-first-m6bx-wide');
		}
	}
});
window.dispatchEvent(transparentHeaderEvt);


// Handles top header initialization: logo setup, nav alignment, responsive adjustments, search bar and compact modes, and accessible mode toggling
const topEvt = new CustomEvent('top');
window.addEventListener('top', function (event) {
	// Handles logo: adds classes for text spans and shows alt text if image fails to load
	function checkIfImageExists(url, callback) {
		const img = new Image();
		img.onload = () => callback(true);
		img.onerror = () => callback(false);
		img.src = url;
	}

	if (logo_id) {
		const logo_text = logo_id.querySelectorAll('span');

		if (logo_id.parentElement && logo_id.parentElement.classList.contains('text-center-logo') && header_inner && !header_inner.classList.contains('hide-btn')) {
			if (search_id) search_id.classList.add('compact');
		}

		if (logo_text.length && header_inner) {
			header_inner.classList.add('logo-text');
		}

		const imgWithAlt = logo_id.querySelector('img[alt]');

		if (imgWithAlt) {
			const pt = imgWithAlt.parentNode;

			checkIfImageExists(imgWithAlt.src, exists => {
				if (!exists) {
					requestAnimationFrame(() => {
						const span = document.createElement('span');
						span.innerHTML = imgWithAlt.alt;
						pt.appendChild(span);
						pt.classList.add('broken-img');
					});
				}
			});
		}
	}

	// Calculates and sets the CSS variable for logo offset in a centered header layout, throttled via requestAnimationFrame. 
	let calcLogoOffsetScheduled = false;

	function calcLogoOffset() {
		if (calcLogoOffsetScheduled) return;
		calcLogoOffsetScheduled = true;
		requestAnimationFrame(() => {
			if (header_id && logo_id && header_inner.classList.contains('text-center-logo')) {
				const header_width = header_id.getBoundingClientRect().width;
				const offsetPercent = (logo_id.offsetLeft / header_width) * 100 + '%';
				html_tag.style.setProperty('--logo_offset', offsetPercent);
			}
			calcLogoOffsetScheduled = false;
		});
	}

	// Assign classes to top_id based on classes assigned to nav elements
	if (nav_id && nav_id.classList.contains('no-wide')) {
		top_id.classList.add('has-no-wide');
	}

	if (nav_bar_id && nav_bar_id.classList.contains('no-wide')) {
		top_id.classList.add('has-no-wide');
	}


	// Adds or removes the 'inv' class based on element's horizontal position relative to the viewport and a given ratio
	function checkInv(el, ratio) {
		requestAnimationFrame(() => {
			const el_rect = el.getBoundingClientRect();
			const el_off = global_dir[1] === false ?
				viewportWidth - el_rect.left - el.offsetWidth :
				el_rect.left;

			if (el_off > viewportWidth * ratio) {
				el.classList.add('inv');
			} else {
				el.classList.remove('inv');
			}
		});
	}


	// Checks if a nav item fits in the navigation width and hides it if there's not enough space
	function countNavDist(el, em, nav) {
		const off_id = 0;
		const dc = el.dataset.copy;
		const show = nav.querySelector(`.show-all li[data-copy="${dc}"]`);

		let shouldHide = false;

		if (el.classList.contains('temp-hidden')) {
			el.classList.remove('temp-hidden');
			if (show) {
				show.classList.remove('temp-hidden');
			}
		}

		const elRect = el.getBoundingClientRect();
		const navRect = nav.getBoundingClientRect();
		const wdth = elRect.width;
		const nwth = navRect.width;

		const off = (global_dir[1] === false) ?
			nwth - el.offsetLeft - wdth - off_id :
			el.offsetLeft - off_id;

		const hcnt = el.parentElement.querySelectorAll('.temp-hidden:not(.show-all)').length;
		const tolr = hcnt > 0 ? 1.2 : 0;
		const buf = 10;

		const calc = off + wdth + wdth + em * tolr + buf;

		if (nwth < calc) {
			shouldHide = true;
		}

		if (shouldHide) {
			el.classList.add('temp-hidden');
			if (show) {
				show.classList.add('temp-hidden');
			}
		} else {
			el.classList.remove('temp-hidden');
			if (show) {
				show.classList.remove('temp-hidden');
			}
		}
	}


	// Adjusts nav text alignment and hides overflowing items depending on available width and viewport size
	function countNavDistF(el, em, en, nav) {
		let mdc = null;
		let resizeAttached = false;

		function calcNav() {
			if (!mediaMin1000.matches) return;
			let mdf;

			if (mdc === null) {
				const mdm = Math.abs(parseFloat(getComputedStyle(el).getPropertyValue('margin-right')));
				mdc = ((nav.classList.contains('text-justify') || nav.classList.contains('have-text-justify')) && !isNaN(mdm)) ?
					mdm :
					0;
			}
			const replaceMap = {
				'have-text-center': 'text-center',
				'have-text-justify': 'text-justify',
				'have-text-end': 'text-end',
				'text-center': 'have-text-center',
				'text-justify': 'have-text-justify',
				'text-end': 'have-text-end'
			};

			const replaceTextClass = (original, replacement) => {
				if (nav.classList.contains(original)) {
					nav.classList.remove(original);
					nav.classList.add(replacement);
				}
			};

			if (!(el.clientWidth > nav.clientWidth + mdc)) {
				replaceTextClass('have-text-center', 'text-center');
				replaceTextClass('have-text-justify', 'text-justify');
				replaceTextClass('have-text-end', 'text-end');
			} else {
				replaceTextClass('text-center', 'have-text-center');
				replaceTextClass('text-justify', 'have-text-justify');
				replaceTextClass('text-end', 'have-text-end');

				if (em.length) {
					en = em[0].getBoundingClientRect().width;
				}

				const children = Array.from(el.children);

				const handleResize = () => {
					requestAnimationFrame(() => {
						children.forEach(eo => {
							countNavDist(eo, en, nav);
						});
					});
				};

				handleResize();

				if (!resizeAttached) {
					window.addEventListener('resize', throttle(handleResize, 100));
					resizeAttached = true;
				}
			}
		}

		calcNav();
		mediaMin1000.addEventListener('change', calcNav);
	}


	// Initializes navigation menus: sets data attributes, handles "show all" submenus, logo loading, responsive adjustments, and inversion checks for submenus.
	const navs = document.querySelectorAll('#nav, #nav-bar');
	if (navs.length) {
		if (nav_outer) top_id.classList.add('has-nav-outer');

		navs.forEach(nav_main => {
			if (nav_main.closest('#header-inner')) html_tag.classList.add('has-inside-nav');

			const nmu = nav_main.querySelector('[data-type]');
			const nms = 0;

			if (!nmu) return;

			Array.from(nmu.children).forEach(function (el, index) {
				el.setAttribute('data-copy', nmu.children.length - index);
			});

			const nml = nmu.querySelector('li.show-all');
			if (nml) {
				const all_submenu = createElementWithClass('ul', 'show-all-submenu');
				nml.appendChild(all_submenu);

				for (const el of nml.closest('ul').children) {
					if (!el.classList.contains('show-all')) {
						all_submenu.appendChild(el.cloneNode(true));
					}
				}

				function markReady() {
					top_id?.classList.add('ready');
					header_id?.classList.add('ready');
					header_outer?.classList.add('ready');
				}

				function updateNav() {
					calcLogoOffset();
					countNavDistF(nmu, nml, nms, nav_main);
					markReady();
				}

				function initLogoLoad() {
					if (logo_img) {
						if (logo_img.complete) {
							updateNav();
						} else {
							logo_img.addEventListener('load', updateNav, {
								once: true
							});
						}
					} else {
						updateNav();
					}
				}

				if (nav_outer) {
					calcLogoOffset();
					setTimeout(initLogoLoad, 250);
				} else {
					setTimeout(() => {
						countNavDistF(nmu, nml, nms, nav_main);
						header_outer.classList.add('ready');
					}, 250);
				}

				window.addEventListener('resize', throttle(() => {
					calcLogoOffset();
					header_outer.classList.remove('ready');
					countNavDistF(nmu, nml, nms, nav_main);
					header_outer.classList.add('ready');
				}, 250));
			}

			function executeCheckInv(nmv) {
				Array.from(nmv).forEach(el => checkInv(el, 0.5));
			}
			const nmv = nav_main.getElementsByClassName('sub-static');
			if (nmv.length) {
				let checkInvExecuted = false;

				function runCheckInv() {
					if (!checkInvExecuted) {
						executeCheckInv(nmv);
						checkInvExecuted = true;
					}
				}

				window.addEventListener('mousemove', runCheckInv);
				window.addEventListener('resize', throttle(() => {
					checkInvExecuted = false;
					runCheckInv();
				}, 500));
			}

			for (const el of nav_main.querySelectorAll('a[href="#"]:not(.toggle)')) {
				const parent = el.parentElement;
				if (parent) parent.classList.add('empty-url');
			}
		});
	}


	// Adjusts top header and search bar classes based on search/header state and viewport width for responsive layout.
	if (search_id && header_inner) {
		// if (!isHasSelectorSupported()) {
		if (search_id.classList.contains('no-bg') && !search_id.classList.contains('bd-b')) {
			top_id.classList.add('no-bd-m');
		}
		if (search_id.classList.contains('no-bg')) {
			top_id.classList.add('no-bd');
		}
		if (search_id.classList.contains('no-pd-t')) {
			top_id.classList.add('no-pd-t');
		}
		// }
		if (!search_id.classList.contains('compact') && header_inner.classList.contains('hide-btn') && header_inner.classList.contains('text-center-logo')) {
			search_id.classList.add('not-compact');
			if (search_id.classList.contains('not-compact')) {
				function updateSearch() {
					if (mediaMax1000.matches) {
						search_id.classList.add('compact');
					} else if (mediaMin1000.matches) {
						search_id.classList.remove('compact');
					}
				}

				updateSearch();

				mediaMax1000.addEventListener('change', updateSearch);
				mediaMin1000.addEventListener('change', updateSearch);
			}
		}
	}


	// Syncs <html> classes with search_id state: adds/removes classes for compact modes and centered sticky layout.
	if (search_id) {
		if (search_id.classList.contains('compact-handle')) {
			html_tag.classList.add('t1sh-mobile', 'search-compact-handle');
		} else {
			html_tag.classList.remove('t1sh-mobile', 'search-compact-handle');
		}

		if (search_id.classList.contains('compact-handle-mobile')) {
			html_tag.classList.add('t1sh-mobile', 'search-compact-handle', 'search-compact-handle-mobile');
		} else {
			html_tag.classList.remove('search-compact-handle-mobile');
		}

		if (search_id.classList.contains('compact')) {
			if (search_id.classList.contains('compact-handle')) {
				html_tag.classList.add('t1sh');
			} else {
				html_tag.classList.remove('t1sh');
			}
			html_tag.classList.add('t1sr');
		} else {
			html_tag.classList.remove('t1sr', 't1sh');
		}

		html_tag.classList.toggle('search-compact-is-centered', search_id.classList.contains('text-center-sticky'));
	}


	// Toggles accessible mode on/off, updates CSS, and stores preference in a cookie
	const accessible_css = fp('styles/theme-accessible.css', 'theme_accessible_css');
	const a_accessible = document.getElementsByClassName('link-accessible');

	function accessibleLink(el) {
		const isActive = html_tag.classList.contains('t1ac');

		if (isActive) {
			html_tag.classList.remove('t1ac');
			Cookies.set('accessible', 'no');
		} else {
			new_css('accessible-mode-css', accessible_css);
			html_tag.classList.add('t1ac');
			Cookies.set('accessible', 'yes');
		}

		if (nav_id || nav_bar_id) {
			const tempHidden = nav_main.getElementsByClassName('temp-hidden');
			setTimeout(() => {
				for (const el of tempHidden) {
					el.classList.remove('temp-hidden');
				}
				window.dispatchEvent(new Event('resize'));
			}, 100);
		}
	}

	if (a_accessible.length) {
		for (const el of a_accessible) {
			const parent = el.parentElement;
			if (parent && !parent.classList.contains('has-link-accessible')) {
				parent.classList.add('has-link-accessible');
			}
		}

		html_tag.addEventListener('click', event => {
			const link = event.target.closest('a.link-accessible');
			if (link) {
				accessibleLink(link);
				event.preventDefault();
			}
		});
		html_tag.addEventListener('keyup', event => {
			if (event.key === ' ' || event.key === 'Enter') {
				const link = event.target.closest('a.link-accessible');
				if (link) {
					accessibleLink(link);
					event.preventDefault();
				}
			}
		});
	}

	if (Cookies.get('accessible') === 'yes') {
		new_css('accessible-mode-css', accessible_css);
		html_tag.classList.add('t1ac');
	} else {
		html_tag.classList.remove('t1ac');
		Cookies.remove('accessible');
	}
});
window.dispatchEvent(topEvt);


// #background - moves the background element to #root and marks it as done when the custom 'background' event is triggered
const backgroundEvt = new CustomEvent('background');
window.addEventListener('background', function (event) {
	const bg_done = document.querySelector('#background.done');
	if (bg_done) {
		bg_done.remove();
	}
	const bg_id = document.getElementById('background');
	if (bg_id && !bg_id.classList.contains('static') && (bg_id.parentNode.id === 'content' || bg_id.parentNode.classList.contains('shopify-section'))) {
		const root = document.getElementById('root') || document.body;
		if (root_id) {
			root_id.appendChild(bg_id);
			bg_id.classList.add('done');
		}
	}
});
window.dispatchEvent(backgroundEvt);


// .m6pn - initializes tab modules within #content and .m6pn containers using semanticTabs()
const moduleTabsEvt = new CustomEvent('moduleTabs');
window.addEventListener('moduleTabs', function (event) {
	if (typeof semanticTabs !== 'function') return;

	const tabs_holder = document.querySelectorAll('#content, .m6pn');
	if (!tabs_holder) return;

	for (const container of tabs_holder) {
		const module_tabs = container.getElementsByClassName('m6tb');

		for (const tab of module_tabs) {
			//if (!tab.classList.contains('tabs-initialized')) {
			semanticTabs(tab);
			//	tab.classList.add('tabs-initialized');
			//}
		}
	}
});
runWhenIdle(() => window.dispatchEvent(moduleTabsEvt));


// Sets CSS custom property --pdi on input elements based on the width of their prefix span for proper padding
const inputPaddingsEvt = new CustomEvent('inputPaddings');
window.addEventListener('inputPaddings', function (event) {
	const inputs = document.querySelectorAll('[class*="input-"][class*="fix"]');
	if (!inputs.length) return;

	const io = new IntersectionObserver((entries, observer) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;

			const el = entry.target;
			const prefix = el.querySelector('span:first-child');
			if (!prefix) {
				observer.unobserve(el);
				continue;
			}

			const sibling = prefix.nextElementSibling;
			if (!sibling) {
				observer.unobserve(el);
				continue;
			}

			sibling.style.setProperty('--pdi', prefix.offsetWidth + 'px');
			observer.unobserve(el);
		}
	}, {
		root: null,
		threshold: 0
	});

	for (const el of inputs) {
		io.observe(el);
	}
});
window.dispatchEvent(inputPaddingsEvt);


// .m6fr - initializes featured sliders with Swiper: handles randomization, pagination, autoplay, responsive updates, and slide-specific classes
let moduleFeaturedResize = false;

const moduleFeaturedSliderEvt = new CustomEvent('moduleFeaturedSlider');
window.addEventListener('moduleFeaturedSlider', function (event) {
	const module_featured = document.querySelectorAll('.m6fr:not(.s4wi)');
	if (!module_featured.length) return;

	for (const el of module_featured) {
		const total_sl = el.children.length;
		let pagination_type = el.classList.contains('slider-fraction') ? 'fraction' : 'bullets';
		let autoplay_int = el.dataset.autoplay ? {
			delay: parseFloat(el.dataset.autoplay),
			pauseOnMouseEnter: true
		} : false;

		if (!isHasSelectorSupported()) {
			for (const em of el.querySelectorAll('figure')) {
				if (em.querySelectorAll('picture').length > 1) em.classList.add('has-pics');
			}
		}

		randomize(el);
		const randomId = el.dataset.random;

		const featuredSlider = create_slider(el, {
			direction: 'horizontal',
			loop: true,
			autoHeight: true,
			resizeObserver: true,
			autoplay: autoplay_int,
			threshold: 50,
			pagination: {
				el: `.swiper-pagination-${randomId}`,
				clickable: true,
				type: pagination_type,
				renderBullet: (i, className) => `<span class="${className}">${i + 1}<span class="prg"></span></span>`,
				renderFraction: (curr, total) => `<span class="${curr}"></span> <span class="slash">/</span> <span class="${total}"></span>`
			},
			on: {
				afterInit: swiper => {
					updateSwiper(swiper);
					swiper.updateAutoHeight();
					updateSliders(el);
				},
				slideChangeTransitionStart: swiper => updateSwiper(swiper),
				resize: swiper => {					
					if (isShopifyDesignMode()) {
						for (let i = 0; i < swiper.slides.length; i++) swiper.slideNext(0);
					}
					setTimeout(() => {
						if (swiper && typeof swiper.updateAutoHeight === 'function') {
							swiper.updateAutoHeight();
						}
					}, 500);
				}
			}
		});

		function updateSwiper(swiper) {
			for (const aside of el.querySelectorAll('.swiper-slide > article.aside')) {
				aside.parentNode.classList.add('has-aside');
			}

			const activeArticle = swiper.el.querySelector('.swiper-slide-active > article');
			el.dataset.activeContent = (activeArticle && activeArticle.className) || '';

			updateClasses(swiper);
		}

		function updateClasses(swiper) {
			el.classList.toggle('changed', swiper.realIndex > 0);
			el.classList.toggle('last-slide-active', swiper.realIndex + 1 === total_sl);
		}

		if (featuredSlider && el.dataset.autoplay && !el.classList.contains('no-controls')) {
			if (el.dataset.playPauseBound !== '1') {
				el.dataset.playPauseBound = '1';

				append_url(el, 'Play/Pause', 'play-pause');
				const playPauseBtn = el.querySelector('.play-pause');

				function toggleAutoplay(forceStart = false) {
					const paused = el.classList.toggle('paused', !forceStart && !el.classList.contains('paused'));
					paused ? featuredSlider.autoplay.stop() : featuredSlider.autoplay.start();
				}

				if (playPauseBtn) {
					playPauseBtn.addEventListener('click', e => {
						e.preventDefault();
						toggleAutoplay();
					});
				}

				el.addEventListener('mouseleave', () => {
					if (!el.classList.contains('paused')) featuredSlider.autoplay.start();
				});
			}
		}

		//if (el.classList.contains('s4wi') && typeof updateSlidersEvt !== 'undefined') { setTimeout(() => window.dispatchEvent(updateSlidersEvt), 300); }

		setTimeout(() => {
			if (featuredSlider && typeof featuredSlider.updateAutoHeight === 'function') {
				featuredSlider.updateAutoHeight();
			}
		}, 500);
	}
	if (!moduleFeaturedResize) {
		moduleFeaturedResize = true;
		window.addEventListener('resize', throttle(() => document.documentElement.classList.add('resized'), 200), true);
	}
});
window.dispatchEvent(moduleFeaturedSliderEvt);


// DROPPED: .shopify-section-announcement-bar - initializes the announcement bar slider if multiple items exist, handling autoplay and removing unnecessary close buttons
/*const top_bar = document.querySelector('.shopify-section-announcement-bar:not(.s4wi)');
const announcementSliderEvt = new CustomEvent('announcementSlider', {
	detail: {
		top_bar
	}
});

window.addEventListener('announcementSlider', function (event) {
	let top_bar = event.detail.top_bar;
	if (!top_bar) return;

	const top_bar_children = Array.from(top_bar.children).filter(
		el => !el.classList.contains('close') && !el.classList.contains('overlay-close')
	);

	if (top_bar_children.length <= 1 || top_bar.classList.contains('m6kn') || top_bar.closest('.m6kn')) return;

	for (const el of top_bar.querySelectorAll('.close, .overlay-close')) {
		el.remove();
	}

	const dataAutoplay = parseFloat(top_bar.getAttribute('data-autoplay'));
	const autoplay_top_int = !isNaN(dataAutoplay) ? {
		delay: dataAutoplay,
		pauseOnMouseEnter: true,
		disableOnInteraction: false
	} : false;

	if (top_bar.querySelector('.no-nav')) top_bar.classList.add('no-nav');

	create_slider(top_bar, {
		direction: 'horizontal',
		loop: true,
		autoHeight: true,
		spaceBetween: viewportWidth * 0.5,
		autoplay: autoplay_top_int,
		pagination: false
	});
});
window.dispatchEvent(announcementSliderEvt);*/


// .l4ts - initializes testimonial sliders with responsive settings, autoplay, and pagination based on list classes and data attributes.
const listTestimonialsSliderEvt = new CustomEvent('listTestimonialsSlider');
window.addEventListener('listTestimonialsSlider', function (event) {
	const list_testimonials = document.querySelectorAll('.l4ts:not(.s4wi)');
	if (!list_testimonials.length) return;

	for (const el of list_testimonials) {
		let ln = [1, 2, 3];
		if (el.classList.contains('wide') || el.classList.contains('width-100')) ln = [1, 1, 1];
		if (el.classList.contains('width-50')) ln = [1, 2, 2];

		const pagination_type = el.classList.contains('slider-fraction') ? 'fraction' : 'bullets';

		let autoplay_int = false;
		if (el.getAttribute('data-autoplay')) {
			autoplay_int = {
				delay: parseFloat(el.getAttribute('data-autoplay')),
				pauseOnMouseEnter: true,
				disableOnInteraction: false
			};
		}

		randomize(el);
		const randomId = el.getAttribute('data-random');

		const total_sl = el.children.length;

		const options = {
			direction: 'horizontal',
			loop: true,
			autoHeight: true,
			spaceBetween: 16,
			slidesPerView: ln,
			slidesPerGroup: ln,
			autoplay: autoplay_int,
			loopAddBlankSlides: false,
			pagination: {
				el: `.swiper-pagination-${randomId}`,
				clickable: true,
				type: pagination_type,
				renderFraction: (currentClass, totalClass) => `<span class="${currentClass}"></span> <span class="slash">/</span> <span class="${totalClass}"></span>`
			},
			on: {
				slideChangeTransitionStart: function (swiper) {
					swiper.el.parentNode.classList.toggle('changed', swiper.realIndex > 0);
					swiper.el.parentNode.classList.toggle('last-slide-active', swiper.realIndex + 1 === total_sl);
					//if (swiper.realIndex > 0) { swiper.el.parentNode.classList.add('changed'); } else { swiper.el.parentNode.classList.remove('changed'); }
					//if (swiper.realIndex + 1 === total_sl) { swiper.el.parentNode.classList.add('last-slide-active'); } else { swiper.el.parentNode.classList.remove('last-slide-active'); }
				}
			},
			breakpoints: {
				0: {
					slidesPerView: ln[0],
					slidesPerGroup: ln[0]
				},
				760: {
					slidesPerView: ln[1],
					slidesPerGroup: ln[1]
				},
				1000: {
					slidesPerView: ln[2],
					slidesPerGroup: ln[2]
				}
			}
		};
		if (el.classList.contains('slider') && el.children.length > ln[2]) {
			create_slider(el, options);
		}
		if (el.classList.contains('slider-mobile') && el.children.length > ln[0]) {
			//if (isShopify()) { clone_with_class(el, 'mobile-only', 'mobile-hide'); }
			const nextSibling = el.nextElementSibling;
			if (nextSibling && nextSibling.matches('.l4ts.mobile-only')) {
				if (nextSibling.hasAttribute('id')) {
					nextSibling.removeAttribute('id');
				}
				create_slider(el.nextElementSibling, options);
			}
		}
	};
});
window.dispatchEvent(listTestimonialsSliderEvt);


// .l4st - initializes static list sliders, handling autoplay, pagination, mobile cloning, and slide state classes
const listStaticSliderEvt = new CustomEvent('listStaticSlider');
window.addEventListener('listStaticSlider', function (event) {
	const listStatic = document.querySelectorAll('.l4st:not(.static, .s4wi)');
	if (!listStatic.length) return;

	for (const el of listStatic) {
		const total_sl = el.children.length;
		const pagination_type = el.classList.contains('slider-fraction') ? 'fraction' : 'bullets';

		const autoAttr = el.getAttribute('data-autoplay');
		const autoplay_int = autoAttr ? {
			delay: parseFloat(autoAttr),
			pauseOnMouseEnter: true,
			disableOnInteraction: false
		} : false;

		randomize(el);
		const randomId = el.getAttribute('data-random');

		clone_with_class(el, 'mobile-only', 'mobile-hide');

		const nextEl = el.nextElementSibling;
		if (nextEl && nextEl.classList.contains('mobile-only')) {
			nextEl.removeAttribute('id');

			create_slider(nextEl, {
				direction: 'horizontal',
				loop: true,
				autoHeight: true,
				spaceBetween: 16,
				autoplay: autoplay_int,
				pagination: {
					el: `.swiper-pagination-${randomId}`,
					clickable: true,
					type: pagination_type,
					renderFraction: (currentClass, totalClass) => `<span class="${currentClass}"></span> <span class="slash">/</span> <span class="${totalClass}"></span>`
				},
				on: {
					slideChangeTransitionStart: swiper => {
						const parent = swiper.el.parentNode;
						parent.classList.toggle('changed', swiper.realIndex > 0);
						parent.classList.toggle('last-slide-active', swiper.realIndex + 1 === total_sl);
					}
				}
			});
		}
	}
});
window.dispatchEvent(listStaticSliderEvt);


// .l4us - initializes USP list sliders, handling autoplay, responsive slidesPerView, mobile cloning, and slider setup
function bindInlineSlideNext(sliderEl) {
	if (!sliderEl) return;
	if (sliderEl.dataset.inlineNextBound === '1') return;
	sliderEl.dataset.inlineNextBound = '1';

	sliderEl.addEventListener('click', function (e) {
		const link = e.target.closest('.swiper-button-next');
		if (!link) return;

		if (!link.closest('.swiper-slide')) return;

		e.preventDefault();

		const swiperOuter = sliderEl.querySelector('.swiper-outer');
		if (!swiperOuter || !swiperOuter.swiper) return;

		swiperOuter.swiper.slideNext();
	});
}

const listUspSliderEvt = new CustomEvent('listUspSlider');
window.addEventListener('listUspSlider', function (event) {
	const listUsp = document.querySelectorAll('.l4us:not(.l4us-initialized)');
	if (!listUsp.length) return;
	
	for (const el of listUsp) {
  		if (el.closest('.m6kn')) continue;

		el.classList.add('l4us-initialized');

		if (el.classList.contains('static')) continue;

		let autoplayInt = false;
		if (el.hasAttribute('data-autoplay')) {
			autoplayInt = {
				delay: parseFloat(el.getAttribute('data-autoplay')),
				pauseOnMouseEnter: true,
				disableOnInteraction: false
			};
		}

		const spaceBetween = el.classList.contains('no-arrows') ? 16 : 44;
		let slidesPerView = 1;

		if (el.closest('#nav-top') && el.classList.contains('slider')) {
			el.classList.add('slider-in-header');
			if (!el.classList.contains('slider-single')) slidesPerView = 'auto';
		}

		if (el.querySelectorAll('li').length === 1) {
			el.classList.remove('slider', 'slider-single');
		}

		const options = {
			direction: 'horizontal',
			loop: true,
			pagination: false,
			autoplay: autoplayInt,
			slidesPerView: slidesPerView,
			autoHeight: true,
			spaceBetween: spaceBetween,
			breakpoints: {
				0: {
					slidesPerView: 1
				},
				760: {
					slidesPerView: slidesPerView
				},
				1000: {
					spaceBetween: spaceBetween
				},
				1100: {
					spaceBetween: 20
				}
			}
		};

		if (el.classList.contains('mobile-static')) continue;
		if (el.classList.contains('slider')) {
			create_slider(el, options);
			bindInlineSlideNext(el);
		} else if (el.children.length > 1) {
			clone_with_class(el, 'l4us-mobile', 'mobile-hide');
			const nextEl = el.nextElementSibling;
			if (nextEl && nextEl.classList.contains('l4us-mobile')) {
				nextEl.classList.remove('slider', 'slider-in-header');
				if (nextEl.hasAttribute('id')) nextEl.removeAttribute('id');
				create_slider(nextEl, options);
				bindInlineSlideNext(nextEl);
			}
		}
	}
});
window.dispatchEvent(listUspSliderEvt);


// [data-val][data-of] - initializes rating elements: generates star or bar visuals and appends review count
function createRatingsHtmlElement(rating, total) {
	const ratingElem = createElementWithClass("span", "rating");
	const split = rating.toString().split(".");
	const intRating = +split[0];
	let intDecimalRating = +split[1] || 0;

	function createStarHtmlElement(fillPercentage) {
		const star = createElementWithClass("span", "star");
		const fill = createElementWithClass("span", "fill");
		fill.style.width = fillPercentage + "%";
		star.appendChild(fill);
		return star;
	}

	for (let i = 1; i <= total; i++) {
		if (i <= intRating) {
			ratingElem.appendChild(createStarHtmlElement(100));
		} else if (intDecimalRating > 0) {
			const baseTenValue = (intDecimalRating + "0").substr(0, 2);
			ratingElem.appendChild(createStarHtmlElement(baseTenValue));
			intDecimalRating = 0;
		} else {
			ratingElem.appendChild(createStarHtmlElement(0));
		}
	}
	return ratingElem;
}

const ratingsEvt = new CustomEvent('ratings');
window.addEventListener('ratings', function (event) {
	const ratingElements = document.querySelectorAll('[data-val][data-of]:not(.rating-initialized)');
	if (!ratingElements.length) return;

	for (const el of ratingElements) {
		el.classList.add('rating-initialized');
		const fragment = document.createDocumentFragment();
		const reviewsElem = createElementWithClass('span', 'rating-label');
		const reviews = el.innerHTML;
		const rating = el.dataset.val;
		const total = el.dataset.of;

		const isNotS1ld = !(el.classList.contains('s1ld') || el.classList.contains('s1br'));

		if (isNotS1ld) {
			fragment.appendChild(createRatingsHtmlElement(rating, total));
			reviewsElem.innerHTML = reviews;
		} else {
			reviewsElem.innerHTML = `<span class="bar" style="width: ${rating / total * 100}%;"></span>`;
		}

		fragment.appendChild(reviewsElem);
		el.textContent = '';
		el.appendChild(fragment);
	}
});
window.dispatchEvent(ratingsEvt);


// .media-flexible - initializes flexible media elements for mobile: clones content into a mobile slider, randomizes order, and sets up Swiper with pagination
const mediaFlexibleEvt = new CustomEvent('mediaFlexbile');
window.addEventListener('mediaFlexbile', function (event) {
	const mediaFlexible = document.querySelectorAll('.media-flexible:not(.media-flexible-initialized)');
	if (!mediaFlexible.length) return;

	for (const el of mediaFlexible) {
		const parent = el.parentElement;
		if (el.classList.contains('media-flexible-initialized')) continue;
		if (parent.classList.contains('flexible-stack')) continue;
		if (!(el.classList.contains('slider-mobile') || parent.classList.contains('mobile-static'))) continue;

		if (!parent.getElementsByClassName('media-flexible-mobile').length) {
			const tag = document.createElement('div');
			tag.classList.add('media-flexible-mobile');
			el.after(tag);
			el.classList.add('mobile-hide');

			const clonedMobile = parent.querySelector('.media-flexible-mobile');
			const childrenToClone = parent.querySelectorAll('.media-flexible:not(.mobile-hide-media-flexible) > *:not(.mobile-hide-media-flexible)');

			for (const child of childrenToClone) {
				clonedMobile.appendChild(child.cloneNode(true));
			}

			clonedMobile.classList.remove('media-flexible', 'mobile-hide');
			if (clonedMobile.hasAttribute('id')) clonedMobile.removeAttribute('id');

			for (const child of Array.from(clonedMobile.children)) {
				if (child.classList.contains('mobile-hide')) child.remove();
			}

			randomize(clonedMobile);

			const randomId = clonedMobile.getAttribute('data-random');
			if (!clonedMobile.classList.contains('s4wi')) {
				create_slider(clonedMobile, {
					direction: 'horizontal',
					loop: true,
					autoHeight: true,
					pagination: {
						el: '.swiper-pagination-' + randomId,
						clickable: true,
						type: 'bullets',
						renderBullet: (index, className) =>
							`<span class="${className}">${index + 1}<span class='prg'></span></span>`
					},
					on: {
						slideChangeTransitionStart: swiper => {
							const activeContent = swiper.el.querySelector('.swiper-slide[data-swiper-slide-index="' + swiper.realIndex + '"] > *');
							if (activeContent) {
								const closestSlider = el.closest('.m6fr');
								if (closestSlider) {
									closestSlider.setAttribute('data-active-content', activeContent.getAttribute('data-color-palette'));
								}
							}
						}
					}
				});
			}
		}

		el.classList.add('media-flexible-initialized');
	}
});
window.dispatchEvent(mediaFlexibleEvt);


// Initializes a column layout on the service page by wrapping the main content and certain sibling sections into a structured div.article wrapper for consistent styling and width.
const createColsEvt = new CustomEvent('createCols');
window.addEventListener('createCols', function (event) {
	const servicePageElement = document.querySelector('[id$="page-service-info-blocks"]');
	if (!servicePageElement) return;

	const parent = servicePageElement.parentElement;

	if (parent.classList.contains('cols')) {
		const article = parent.querySelector('article.w64.t55');
		if (article) article.replaceWith(...article.childNodes);
		parent.replaceWith(...parent.childNodes);
	}

	const wrapper = document.createElement('div');
	wrapper.classList.add('cols', 'section-width-boxed');
	const wrapperInner = document.createElement('article');
	wrapperInner.classList.add('w64', 't55');
	wrapper.appendChild(wrapperInner);

	const possibleSiblings = [
		'shopify-section-page-service-menu',
		'shopify-section-faq',
		'shopify-section-contact-form',
		'shopify-section-google-maps'
	];

	let anySiblingFound = false;

	const findSibling = () => {
		const prevSibling = servicePageElement.previousElementSibling;
		if (!prevSibling) return;

		let correctSiblingFound = false;
		for (const cls of possibleSiblings) {
			if (prevSibling.classList.contains(cls)) {
				correctSiblingFound = true;
				anySiblingFound = true;
				prevSibling.classList.add('w64', 't55');
				wrapperInner.appendChild(prevSibling);
			}
		}

		if (correctSiblingFound) {
			findSibling();
		} else if (anySiblingFound) {
			for (let i = 1; i < wrapperInner.childNodes.length; i++) {
				wrapperInner.insertBefore(wrapperInner.childNodes[i], wrapperInner.firstChild);
			}
			servicePageElement.parentNode.insertBefore(wrapper, servicePageElement);
			wrapper.appendChild(servicePageElement);
		}
	};

	findSibling();
});
window.dispatchEvent(createColsEvt);


// .l4al - listens for a 'showAlert' event and displays a styled alert message in a fixed overlay list, with type-based colors, optional headers, and duplicate prevention based on origin.
const showAlertEvt = new CustomEvent('showAlert');
window.addEventListener('showAlert', function (event) {
	if (!event || !event.detail || !event.detail.message) {
		return;
	}
	const {
		message: messageText,
		type: messageType,
		header,
		origin
	} = event.detail || {};
	let messageHeader = header || false;
	const messageOrigin = origin ? `message-${origin}` : false;

	const typeMap = {
		success: {
			color: 'lime',
			defaultHeader: window.translations ? window.translations.general_alerts_success_text || 'Success' : 'Success'
		},
		info: {
			color: 'pine',
			defaultHeader: window.translations ? window.translations.general_alerts_info_text || 'Info' : 'Info'
		},
		error: {
			color: 'rose',
			defaultHeader: window.translations ? window.translations.general_alerts_error_text || 'Error' : 'Error'
		}
	};
	const {
		color: messageColor,
		defaultHeader
	} = typeMap[messageType] || {
		color: 'lime',
		defaultHeader: ''
	};
	if (!messageHeader) messageHeader = defaultHeader;

	const message = `
		<li class="overlay-${messageColor} ${messageOrigin || ''}">
			<i aria-hidden="true" class="icon-${messageType}"></i>
			<p class="strong">${messageHeader}</p>
			<p>${messageText}</p>
			<a href="#" class="close">Close</a>
		</li>
	`;

	let listAlerts = document.querySelector('.l4al:not(.inline):not(.l4al-trustbadge)');
	if (!listAlerts) {
		listAlerts = document.createElement('ul');
		listAlerts.classList.add('l4al', 'fixed');
		const root_id = document.getElementById('root') || document.body;
		root_id.appendChild(listAlerts);
	}

	if (!messageOrigin || listAlerts.getElementsByClassName(messageOrigin).length === 0) {
		const temp = document.createElement('div');
		temp.innerHTML = message.trim();
		const li = temp.firstElementChild;
		if (li) listAlerts.appendChild(li);
	}

	if (typeof alertsEvt !== 'undefined') {
		window.dispatchEvent(alertsEvt);
	}
}, false);


// video.lazy - lazily loads videos with class "lazy" when they enter the viewport by setting sources and calling load().
const lazyVideoEvt = new CustomEvent('lazyVideo');
window.addEventListener('lazyVideo', function (event) {
	const lazyVideos = Array.from(document.querySelectorAll('video.lazy'));
	if (!lazyVideos.length || !('IntersectionObserver' in window)) return;

	const lazyVideoObserver = new IntersectionObserver((entries, observer) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;

			const video = entry.target;
			for (const source of video.children) {
				if (source.tagName.toLowerCase() === 'source') {
					source.src = source.dataset.src;
				}
			}

			video.load();
			video.classList.remove('lazy');
			lazyVideoObserver.unobserve(video);
		}
	});

	for (const lazyVideo of lazyVideos) {
		lazyVideoObserver.observe(lazyVideo);
	}
});
window.dispatchEvent(lazyVideoEvt);


// .check[data-limit] - initializes "check limit" functionality: hides elements beyond a data-limit and appends a "+N" indicator to show how many items are hidden.
const check_limit_event = new CustomEvent('check-limit-event');
window.addEventListener('check-limit-event', function () {
	const checkLimitElements = document.querySelectorAll('.check[data-limit]');
	if (!checkLimitElements.length) return;

	for (const el of checkLimitElements) {
		if (el.classList.contains('check-limit-initialized')) continue;
		el.classList.add('check-limit-initialized');

		let tagLimit = el.tagName.toLowerCase() === 'ul' || el.tagName.toLowerCase() === 'ol' ? 'li' : 'a';
		const limitEl = createElementWithClass(tagLimit, 'limit');
		const limitIndex = parseInt(el.dataset.limit, 10) - 1;
		const trigger = el.children[limitIndex];

		if (!trigger) continue;

		const nextAll = Array.from(trigger.parentNode.children).slice(limitIndex + 1);
		for (const em of nextAll) {
			if (!em.classList.contains('hidden')) em.classList.add('hidden-check');
		}

		const visibleItemsCount = el.querySelectorAll('li:not(.hidden, .tip-cont)').length;
		limitEl.innerText = `+${Math.abs(visibleItemsCount - el.dataset.limit)}`;

		if (tagLimit === 'li') {
			const a = document.createElement('a');
			a.href = './';
			while (limitEl.firstChild) {
				a.appendChild(limitEl.firstChild);
			}
			limitEl.appendChild(a);
		}

		el.append(limitEl);

		const lastDesc = el.querySelector('li.hidden');
		if (lastDesc) el.appendChild(lastDesc);
	}
});
window.dispatchEvent(check_limit_event);


// .l4cl - adds scrollable markers and fallback classes if :has() isn’t supported
const listCollectionEvt = new CustomEvent('listCollection');
window.addEventListener('listCollection', (event) => {
	const list_collection = document.querySelectorAll('.l4cl');
	if (!list_collection.length) return;

	requestAnimationFrame(() => {

		for (const el of list_collection) {
			if (el.clientHeight < el.scrollHeight) {
				el.classList.add('is-scrollable');
			}

			if (isHasSelectorSupported()) continue;

			el.querySelectorAll('.small a').forEach(a => a.classList.add('has-link'));

			const selectors = [
				{
					sel: 'div.box',
					cls: 'has-div-box'
				},
				{
					sel: '[class*="l4ml"]',
					cls: 'has-l4ml'
				},
				{
					sel: 'picture ~ picture',
					cls: 'has-picture-picture'
				}
			];

			for (const {
					sel,
					cls
				} of selectors) {
				el.querySelectorAll(sel).forEach(em => {
					const li = em.closest('li');
					if (li) li.classList.add(cls);
				});
			}
		}
	});
});
window.dispatchEvent(listCollectionEvt);


// .l4cl / .l4ft - nitializes collection sliders, sets spacing, autoplay, breakpoints, and dynamic height handling depending on layout and image content.
const listCollectionSliderEvt = new CustomEvent('listCollectionSlider');
window.addEventListener('listCollectionSlider', () => {
	const list_collection_slider = document.querySelectorAll('.l4cl.slider:not(.s4wi), .l4ft.slider:not(.s4wi)');
	if (!list_collection_slider.length) return;

	for (const el of list_collection_slider) {
		if (el.closest('.popup-a')) {
			el.classList.add('in-popup');
			continue;
		}

		const closestTabs = el.closest('.m6tb');
		const hasFigure = !!el.querySelector('figure:not(:last-child)');
		const classes = el.classList;
		const computed = getComputedStyle(el);
		const dist_a_value = computed.getPropertyValue('--dist_a').trim();
		const rowValue = computed.getPropertyValue('--row').trim();
		const row = rowValue ? parseFloat(rowValue) : NaN;

		let spacing = 16;
		if (dist_a_value && dist_a_value !== 'px') {
			const dist_a = parseFloat(dist_a_value);
			if (!isNaN(dist_a)) spacing = dist_a;
		}

		let loopMe = classes.contains('slider-loop');
		let autoHeight = !(classes.contains('static-height') && !classes.contains('align-stretch'));
		let allowTouch = classes.contains('static-height') || classes.contains('align-center') || classes.contains('align-stretch');
		let allowTouch_760 = !classes.contains('mobile-compact');
		let autoPlayMe = false;
		let autoPlaySpeed = 300;

		if (!hasFigure) el.classList.add('no-img');

		if (classes.contains('autoplay')) {
			autoPlayMe = {
				delay: 0
			};
			loopMe = true;
			autoPlaySpeed = el.children.length * 1000;
		}

		let items = [5, 5, 3];
		if (classes.contains('text-justify') || classes.contains('auto-width')) {
			items = ['auto', 'auto', 'auto'];
			autoHeight = false;
		} else {
			const rowItemsMap = {
				12: [12, 6, 4],
				11: [11, 6, 4],
				10: [10, 6, 4],
				9: [9, 6, 4],
				8: [8, 6, 4],
				7: [7, 6, 4],
				6: [6, 5, 3],
				5: [5, 5, 3],
				4: [4, 4, 3],
				3: [3, 3, 3],
				2: [2, 2, 2]
			};

			if (!Number.isNaN(row) && rowItemsMap[row]) {
				items = rowItemsMap[row];
			} else {
				const itemsMap = {
					'in-col': [4, 4, 3],
					'w8': [12, 6, 4],
					'w9': [11, 6, 4],
					'w10': [10, 6, 4],
					'w11': [9, 6, 4],
					'w12': [8, 6, 4],
					'w14': [7, 6, 4],
					'w16': [6, 5, 3],
					'w20': [5, 5, 3],
					'w25': [4, 4, 3],
					'w33': [3, 3, 3],
					'w50': [2, 2, 2]
				};

				for (const cls in itemsMap) {
					if (classes.contains(cls)) {
						items = itemsMap[cls];
						break;
					}
				}
			}
		}

		const handleInit = (swiper) => {
			if (!hasFigure) return;
			const fig = el.querySelector('.swiper-slide-active figure');
			if (fig && fig.offsetHeight > 0) {
				el.style.setProperty('--fih', fig.offsetHeight + 'px');
			} else {
				el.style.removeProperty('--fih');
			}
		};
		const throttledHandleInit = throttle(handleInit, 100);

		randomize(el);
		const randomId = el.getAttribute('data-random');

		create_slider(el, {
			direction: 'horizontal',
			loop: loopMe,
			autoHeight,
			slidesPerView: items[0],
			focusableElements: 'input',
			spaceBetween: spacing,
			touchStartPreventDefault: false,
			lazy: {
				loadPrevNext: true
			},
			pagination: {
				el: `.swiper-pagination-${randomId}`,
				clickable: true
			},
			autoplay: autoPlayMe,
			speed: autoPlaySpeed,
			breakpoints: {
				0: {
					simulateTouch: false,
					allowTouchMove: false
				},
				760: {
					slidesPerView: items[2],
					simulateTouch: allowTouch_760,
					allowTouchMove: allowTouch_760
				},
				1000: {
					slidesPerView: items[1],
					simulateTouch: allowTouch,
					allowTouchMove: allowTouch
				},
				1100: {
					slidesPerView: items[0],
					simulateTouch: allowTouch,
					allowTouchMove: allowTouch
				}
			},
			on: {
				afterInit(swiper) {
					if (closestTabs) setTimeout(handleInit, 100);
					if (typeof lazyVideoEvt !== 'undefined') window.dispatchEvent(lazyVideoEvt);
					
					updateSliders(el);
					handleInit();
				},
				resize: throttledHandleInit,
				transitionStart(swiper) {
					swiper.el.classList.add('transition');
				},
				transitionEnd(swiper) {
					swiper.el.classList.remove('transition');
					handleInit();
				}
			}
		});

		el.querySelectorAll('.has-text, .cols').forEach(em => {
			const p = em.parentElement;
			if (em.classList.contains('has-text')) p.classList.add('has-text');
			if (em.classList.contains('cols')) p.classList.add('has-cols');
		});

		if (hasFigure && closestTabs && closestTabs.children.length) {
			closestTabs.querySelectorAll('a').forEach(link =>
				link.addEventListener('click', () => setTimeout(handleInit, 100))
			);
		}

		if (hasFigure) {
			const subLi = el.closest('li.sub');
			if (subLi) subLi.addEventListener('mouseenter', () => setTimeout(handleInit, 100));
		}

		el.querySelectorAll('.swiper-wrapper[id], .swiper-button-nav[aria-controls]').forEach(node => {
			node.removeAttribute('id');
			node.removeAttribute('aria-controls');
		});
	}
});
window.dispatchEvent(listCollectionSliderEvt);


// .l4pr - initializes all product sliders (), handling clones, sticky notes, 3D posters, "more" links, thumbnails, custom pagination, navigation, progress bars, and responsive behavior.
const listProductSliderEvt = new CustomEvent('listProductSlider');

let l4prDelegatesAttached = false;

function l4prClick(element) {
	let index = parseInt(element.dataset.l4prIndex, 10);
	if (isNaN(index)) return;

	const m6prElement = element.closest('.m6pr');
	let findSwiper;

	if (m6prElement !== null) {
		findSwiper = m6prElement.querySelector('.l4pr.s4wi').children[0].swiper;
	} else {
		const firstL4pr = document.querySelector('.l4pr.s4wi');
		if (!firstL4pr || !firstL4pr.children.length) return;
		findSwiper = firstL4pr.children[0].swiper;
	}

	if (findSwiper !== undefined) findSwiper.slideTo(index);
}

function attachL4prDelegates() {
	if (l4prDelegatesAttached) return;
	l4prDelegatesAttached = true;

	document.addEventListener('click', function (event) {
		const tag = event.target.tagName.toLowerCase();

		if (tag === 'option') return;

		const l4prElement = event.target.closest('[data-l4pr-index]');
		if (l4prElement) {
			l4prClick(l4prElement);
		}

		if (tag === 'a' && event.target.classList.contains('swiper-pagination-bullet')) {
			const slide = event.target.closest('.swiper-slide');
			if (slide) {
				const siblings = Array.from(getSiblings(slide));
				siblings.forEach(sib => {
					if (sib.firstElementChild) {
						sib.firstElementChild.classList.remove('swiper-pagination-bullet-active');
					}
				});
				event.target.classList.add('swiper-pagination-bullet-active');
			}
			event.preventDefault();
		}
	});

	document.addEventListener('change', function (event) {
		if (event.target.tagName.toLowerCase() !== 'select') return;
		const selectedOption = event.target.options[event.target.selectedIndex];
		if (selectedOption) l4prClick(selectedOption);
	});
}

window.addEventListener('listProductSlider', event => {
	const list_product_slider = document.querySelectorAll('.l4pr');
	if (!list_product_slider.length) return;

	html_tag.classList.add('t1pr');

	attachL4prDelegates();

	for (let el of list_product_slider) {
		if (el.classList.contains('s4wi') || el.classList.contains('l4pr-initialized')) continue;
		el.classList.add('l4pr-initialized');

		let hasStickyNote = false;
		let stickyNote = [];

		// Clone static slides for desktop
		if (el.classList.contains('static')) {
			const clone_me = el.cloneNode(true);
			clone_me.classList.remove('static');
			clone_me.classList.add('desktop-hide');
			el.classList.add('desktop-only');
			el.after(clone_me);
			el = el.nextElementSibling;
		}

		const mainSliderElement = el;
		const children = [...mainSliderElement.children];
		const total_sl = children.length;
		let initial_slide = parseFloat(el.getAttribute('data-featured_media_position') || 1) - 1;

		// Sticky notes handling
		const stickyNotes = [...mainSliderElement.querySelectorAll('li.sticky')];
		if (stickyNotes.length) {
			hasStickyNote = true;
			stickyNote = stickyNotes;
			stickyNotes.forEach(child => child.remove());
		}

		// Poster handling for 3D models
		const firstModel = mainSliderElement.querySelectorAll('a > .model-3d:first-child model-viewer[poster]');
		firstModel.forEach(em => {
			const posterSrc = em.getAttribute('poster');
			if (!posterSrc) return;

			const staticPosterWrapper = createElementWithClass('picture', 'just-poster');
			const staticPoster = document.createElement('img');
			staticPoster.src = staticPoster.dataset.src = posterSrc;
			const alt = em.getAttribute('alt');
			if (alt) staticPoster.alt = alt;
			staticPosterWrapper.prepend(staticPoster);

			const closestLink = em.closest('a');
			if (closestLink) closestLink.prepend(staticPosterWrapper);
		});

		// Add "more" link if needed
		if (!el.classList.contains('thumbs-static') && !el.classList.contains('thumbs-slider') && children[4]) {
			children[4].classList.add('more');
			append_url(children[4], '+' + (children.length - 5), 'more');
		}

		// Clone slides for pagination
		const slides = [...mainSliderElement.cloneNode(true).children];

		// Move m6bx elements inside first child
		[...el.getElementsByClassName('m6bx')].forEach(em => {
			em.classList.add('m6bx-inside');
			el.firstElementChild.appendChild(em);
			em.remove();
		});

		randomize(el);
		const randomId = el.getAttribute('data-random');

		const setNavigationHeight = swiper => {
			const h = `${swiper.height}px`;
			if (swiper.navigation.prevEl) swiper.navigation.prevEl.style.height = h;
			if (swiper.navigation.nextEl) swiper.navigation.nextEl.style.height = h;
		};

		const mainSlider = create_slider(mainSliderElement, {
			direction: 'horizontal',
			loop: false,
			autoHeight: true,
			preloadImages: false,
			initialSlide: initial_slide,
			pagination: {
				el: `.swiper-pagination-${randomId}`,
				clickable: true,
				renderBullet: (index, className) => {
					const finalSpan = createElementWithClass('a', className);
					const slideClass = slides[index].className || '';

					['portrait', 'landscape', 'square', 'stripe'].forEach(o => {
						if (slideClass.includes(o)) finalSpan.classList.add(`orientation-${o}`);
					});
					if (slideClass.includes('auto')) {
						finalSpan.classList.add('auto');
						finalSpan.classList.remove('landscape', 'portrait');
					}

					const img = slides[index].querySelector('picture, img');
					if (img) {
						const a_thumb = img.closest('a[data-gallery-thumb]');
						if (a_thumb) {
							const thumbImg = document.createElement('img');
							thumbImg.src = a_thumb.getAttribute('data-gallery-thumb');
							thumbImg.loading = 'lazy';
							thumbImg.alt = 'Thumbnail';

							const thumbPic = document.createElement('picture');
							const picClassEl = a_thumb.querySelector('picture[class]');
							if (picClassEl) thumbPic.className = picClassEl.className;
							thumbPic.appendChild(thumbImg);
							finalSpan.appendChild(thumbPic);
						} else finalSpan.appendChild(img);
					}

					const divFlex = document.createElement('span');
					const moreLink = slides[index].querySelector('a.more');
					if (moreLink && (children.length - 1 - index) > 0) {
						const span = document.createElement('span');
						span.innerText = '+' + (children.length - 1 - index);
						divFlex.appendChild(span);
						finalSpan.classList.add('has-more');

						const fancyLinks = slides[index].querySelectorAll('a[data-fancybox]');
						fancyLinks.forEach(em => finalSpan.setAttribute('href', em.getAttribute('href')));
					}

					const icon = slides[index].querySelector("i[class^=icon-]");
					if (icon) divFlex.appendChild(icon);

					finalSpan.appendChild(divFlex);
					return finalSpan.outerHTML;
				}
			},
			navigation: {
				nextEl: `[data-random="${randomId}"] .swiper-button-next`,
				prevEl: `[data-random="${randomId}"] .swiper-button-prev`
			},
			on: {
				activeIndexChange() {
					const activeIndex = this.activeIndex;
					const slidesCount = this.slides ? this.slides.length : children.length;

					[...this.el.parentNode.getElementsByClassName('custom-progressbar-inner')].forEach(bar => {
						bar.style.width = `${100 * (activeIndex + 1) / slidesCount}%`;
					});
				},
				afterInit(swiper) {
					const progress_bar = createElementWithClass('div', 'custom-progressbar');
					const progress_bar_inner = createElementWithClass('div', 'custom-progressbar-inner');
					progress_bar_inner.style.width = `${100 / children.length}%`;
					progress_bar.appendChild(progress_bar_inner);
					swiper.el.appendChild(progress_bar);

					[...swiper.el.querySelectorAll('.s1lb, .label')].forEach(em => swiper.el.parentNode.appendChild(em));
					[...swiper.el.getElementsByClassName('m6bx-inside')].forEach(em => swiper.el.appendChild(em));

					if (el.classList.contains('no-thumbs-mobile') || el.classList.contains('slider-fraction')) {
						const custom_fraction = swiper.el.parentNode.querySelector('.swiper-custom-fraction');
						const current = createElementWithClass('span', 'swiper-pagination-current');
						current.textContent = '1';
						const slash = createElementWithClass('span', 'slash');
						slash.textContent = '/';
						const total = createElementWithClass('span', 'total-el');
						total.textContent = swiper.slides.length;
						custom_fraction.append(current, document.createTextNode(' '), slash, document.createTextNode(' '), total);
					}

					setTimeout(() => setNavigationHeight(swiper), 300);
				},
				slideChangeTransitionEnd(swiper) {
					setTimeout(() => setNavigationHeight(swiper), 300);
				},
				slideChangeTransitionStart(swiper) {
					setTimeout(() => {
						const slidesCount = swiper.slides ? swiper.slides.length : total_sl;

						if (el.classList.contains('no-thumbs-mobile') || el.classList.contains('slider-fraction')) {
							const custom_fraction = swiper.el.parentNode.querySelector('.swiper-pagination-current');
							custom_fraction.innerHTML = swiper.realIndex + 1;
							swiper.el.classList.toggle('changed', swiper.realIndex > 0);
						}
						swiper.el.classList.toggle('last-slide-active', swiper.realIndex + 1 === slidesCount);
					}, 300);
				},
				resize(swiper) {
					setNavigationHeight(swiper);
				}
			}
		});

		if (hasStickyNote) {
			stickyNote.forEach(imgOverlay => {
				const swiperOuter = el.querySelector('.swiper-outer');
				(swiperOuter || el).appendChild(imgOverlay);
			});
		}

		// Thumbs slider handling
		if (el.classList.contains('thumbs-slider')) {
			const bulletsSelector = `[data-random="${randomId}"] .swiper-pagination-bullets`;
			const customBullets = el.querySelector(bulletsSelector);
			clone_with_class(customBullets, 'cloned', 'hidden');

			const clonedBullets = el.querySelector(`${bulletsSelector}.cloned`);
			[...clonedBullets.children].forEach((child, i) => child.dataset.l4prIndex = i);

			create_slider(clonedBullets, {
				direction: 'horizontal',
				loop: false,
				autoHeight: false,
				slidesPerView: 'auto',
				navigation: {
					nextEl: `${bulletsSelector} .swiper-button-next`,
					prevEl: `${bulletsSelector} .swiper-button-prev`
				}
			});
		}
	}
});
window.dispatchEvent(listProductSliderEvt);


// DROPPED: [data-sal] - initializes scroll animations by asynchronously loading the JS and CSS,
/*const dataSalEvent = new CustomEvent('dataSal');
window.addEventListener('dataSal', () => {
	const data_sal = document.querySelectorAll('[data-sal]');
	if (!data_sal.length) return;

	const animations_js = fp('js/plugin-animations.js', 'plugin_animations_js');
	const animations_css = fp('styles/async-animations.css', 'async_animations_css');

	loadRes(animations_js, () => {
		new_css('animations-css', animations_css);

		if (typeof sal !== 'function') return;

		sal({
			threshold: 1,
			once: true
		});
	});
});
window.dispatchEvent(dataSalEvent);*/


// select - adds styling and change tracking to all <select> elements, marks their parent/closest paragraph with 'has-select'.
const selectTagEvt = new CustomEvent('selectTag');
window.addEventListener('selectTag', function (event) {
	const select_tag = document.getElementsByTagName('select');
	if (!select_tag.length) return;

	for (const el of select_tag) {
		const parentNode = el.parentNode;
		if (parentNode) parentNode.classList.add('has-select');

		const closestParagraph = el.closest('p');
		if (closestParagraph) closestParagraph.classList.add('has-select');

		el.addEventListener('change', () => {
			if (!el.classList.contains('changed')) el.classList.add('changed');
		});
	}
});
window.dispatchEvent(selectTagEvt);


// Calculates and assigns z-index to form-related elements on first user interaction and window resize, ensuring proper stacking order.
const formZindexEvt = new CustomEvent('formZindex');
window.addEventListener('formZindex', function (event) {
	window.dispatchEvent(selectTagEvt);

	let handleFormChildrenCalculated = false;
	let handleFormChildrenScheduled = false;

	function handleFormChildren() {
		if (handleFormChildrenScheduled) return;

		handleFormChildrenScheduled = true;

		requestAnimationFrame(() => {
			if (!handleFormChildrenCalculated) {
				const formChildren = document.querySelectorAll('form > *, fieldset > *, .no-zindex, .no-zindex > *, .has-select, .f8pr > *, .l4ca.compact.in-panel > *, .l4cl.box > li, .f8pr-bulk > *');
				if (formChildren.length) assignIndex(formChildren);
				handleFormChildrenCalculated = true;
			}
			handleFormChildrenScheduled = false;
		});
	}

	if (!isMobile) {
		window.addEventListener('mousemove', handleFormChildren, asyncOnce);
	}
	document.addEventListener('keyup', handleFormChildren, asyncOnce);
	document.addEventListener('touchstart', handleFormChildren, asyncPass);
	document.addEventListener('scroll', handleFormChildren, asyncPass);
	window.addEventListener('resize', throttle(handleFormChildren, 500));
});
runWhenIdle(() => window.dispatchEvent(formZindexEvt));




/*! Async Resources & Touch Interaction -------------------------------------------------- */

// Loads async CSS and JS resources on first user interaction, including hover-fix on hybrid devices that falsely report no hover
const outline_js = fp('js/plugin-outline.js', 'plugin_outline_js');
const css_async = fp('styles/async.css', 'async_css');
const css_menu = fp('styles/async-menu.css', 'async_menu_css');
const css_hovers = fp('styles/async-hovers.css', 'async_hovers_css');
const css_hovers_hack = fp('styles/async-hovers-hack.css', 'async_hovers_hack_css');
const validation_css = fp('styles/async-validation.css', 'async_validation_css');
const isFakeNoHover = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(hover: hover)').matches;

let asyncCSSLoaded = false;

function asyncCSS() {
	if (asyncCSSLoaded) return;

	new_css('async-css', css_async);
	new_css('hovers-css', css_hovers);

	if (isFakeNoHover) {
		new_css('hovers-hack-css', css_hovers_hack);
	}

	new_css('menu-css', css_menu);
	loadRes(outline_js, () => {}, 'outline-loaded');

	asyncCSSLoaded = true;

	const skip_id = document.getElementById('skip');
	if (skip_id && nav_bar_id) {
		const link = skip_id.querySelector('a[href="#nav"]');
		if (link) {
			link.setAttribute('href', '#nav-bar');
		}
	}
}

window.addEventListener('mousemove', asyncCSS, asyncOnce);
document.addEventListener('keyup', asyncCSS, asyncOnce);
document.addEventListener('touchstart', asyncCSS, asyncPass);
document.addEventListener('pointerdown', asyncCSS, asyncPass);
document.addEventListener('scroll', asyncCSS, asyncPass);


// Adds and removes a .touch-moving class on the <html> element to indicate when the user is actively touching or scrolling on a touchscreen device.
let touchMoving = false;
let lastScrollY = 0;
let scrollCheckTimeout;

window.addEventListener('touchstart', () => {
	clearTimeout(scrollCheckTimeout);
	touchMoving = true;
	html_tag.classList.add('touch-moving');
});

window.addEventListener('touchend', () => {
	const checkScrollEnd = () => {
		const currentY = window.scrollY;
		if (Math.abs(currentY - lastScrollY) < 2) {
			touchMoving = false;
			html_tag.classList.remove('touch-moving');
		} else {
			lastScrollY = currentY;
			scrollCheckTimeout = setTimeout(checkScrollEnd, 100);
		}
	};
	lastScrollY = window.scrollY;
	scrollCheckTimeout = setTimeout(checkScrollEnd, 100);
});


// Loads less crucial JavaScript
const custom_async_js = fp('js/custom-async.js', 'custom_async_js');
runWhenIdle(() => {
	loadRes(custom_async_js, () => {}, 'custom-async-loaded');
});
