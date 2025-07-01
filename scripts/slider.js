/**
 * Professional Image Slider Class
 * Manages an individual image carousel instance with auto-slide, timer, and controls.
 */
class ImageSlider {
    constructor(wrapperElement, options = {}) {
        // Validate wrapperElement
        if (!(wrapperElement instanceof HTMLElement)) {
            console.error('ImageSlider: Invalid wrapper element provided. Must be an HTMLElement.', wrapperElement);
            return null; // Return null if initialization fails
        }
        this.sliderWrapper = wrapperElement;

        // DOM Elements (scoped to this slider's wrapper)
        this.sliderTrack = this.sliderWrapper.querySelector('.slider-track');
        this.images = this.sliderTrack ? this.sliderTrack.querySelectorAll('.slider-image') : [];
        this.prevBtn = this.sliderWrapper.querySelector('.prev-btn');
        this.nextBtn = this.sliderWrapper.querySelector('.next-btn');
        this.paginationContainer = this.sliderWrapper.querySelector('.slider-pagination');
        this.progressBar = this.sliderWrapper.querySelector('.slider-progress-bar');

        // Check if essential elements exist
        if (this.images.length === 0 || !this.sliderTrack || !this.prevBtn || !this.nextBtn || !this.paginationContainer || !this.progressBar) {
            console.warn('ImageSlider: Missing essential elements within the slider wrapper. Skipping initialization for this slider.', this.sliderWrapper);
            return null;
        }

        // Configuration Options
        this.config = {
            slideDuration: options.slideDuration || 4000, // Time in milliseconds for each slide
            transitionDuration: options.transitionDuration || 600, // CSS transition duration in ms (should match CSS)
            loop: options.loop !== false, // Whether to loop the slider
            pauseOnHover: options.pauseOnHover !== false,
            pauseOnFocus: options.pauseOnFocus !== false,
            // Validate initialSlide
            initialSlide: Math.max(0, Math.min(options.initialSlide || 0, this.images.length - 1))
        };

        // Internal State
        this.currentIndex = this.config.initialSlide;
        this.totalImages = this.images.length;
        this.slideInterval = null;
        this.animationFrameId = null; // For progress bar animation
        this.startTime = null; // For tracking progress bar time

        // Initialize the slider
        this.init();
    }

    /**
     * Initializes the slider:
     * - Generates pagination dots.
     * - Sets up event listeners.
     * - Sets initial slide position and starts auto-slide.
     */
    init() {
        this.generatePaginationDots();
        this.addEventListeners();
        this.updateSlider(false); // Update initial position without transition
        this.startAutoSlide();
    }

    /**
     * Creates and appends pagination dots for each image.
     */
    generatePaginationDots() {
        this.paginationContainer.innerHTML = ''; // Clear existing dots
        for (let i = 0; i < this.totalImages; i++) {
            const dot = document.createElement('button');
            dot.classList.add('pagination-dot');
            dot.dataset.index = i;
            dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
            dot.setAttribute('role', 'tab'); // For accessibility
            dot.addEventListener('click', () => this.goToSlide(i, true));
            this.paginationContainer.appendChild(dot);
        }
        this.dots = this.paginationContainer.querySelectorAll('.pagination-dot');
    }

    /**
     * Adds all necessary event listeners for controls and user interaction.
     */
    addEventListeners() {
        this.prevBtn.addEventListener('click', () => this.goToSlide(this.currentIndex - 1, true));
        this.nextBtn.addEventListener('click', () => this.goToSlide(this.currentIndex + 1, true));

        if (this.config.pauseOnHover) {
            this.sliderWrapper.addEventListener('mouseenter', () => this.pauseAutoSlide());
            this.sliderWrapper.addEventListener('mouseleave', () => this.startAutoSlide());
        }
        if (this.config.pauseOnFocus) {
            this.sliderWrapper.addEventListener('focusin', (event) => {
                if (this.sliderWrapper.contains(event.target)) {
                    this.pauseAutoSlide();
                }
            });
            this.sliderWrapper.addEventListener('focusout', (event) => {
                if (!this.sliderWrapper.contains(event.relatedTarget)) {
                    this.startAutoSlide();
                }
            });
        }
    }

    /**
     * Updates the slider's visual position and active pagination dot.
     * @param {boolean} withTransition - Whether to apply CSS transition.
     */
    updateSlider(withTransition = true) {
        this.sliderTrack.style.transition = withTransition ? `transform ${this.config.transitionDuration / 1000}s cubic-bezier(0.25, 0.1, 0.25, 1)` : 'none';
        const offset = -this.currentIndex * 100;
        this.sliderTrack.style.transform = `translateX(${offset}%)`;

        // Update accessibility attributes for images
        this.images.forEach((img, i) => {
            img.setAttribute('aria-hidden', i !== this.currentIndex);
            img.setAttribute('tabindex', i === this.currentIndex ? '0' : '-1');
        });

        // Update active dot class and accessibility attributes
        this.dots.forEach((dot, i) => {
            if (i === this.currentIndex) {
                dot.classList.add('active');
                dot.setAttribute('aria-selected', 'true');
                dot.setAttribute('tabindex', '0');
            } else {
                dot.classList.remove('active');
                dot.setAttribute('aria-selected', 'false');
                dot.setAttribute('tabindex', '-1');
            }
        });

        // Update button states if not looping
        if (!this.config.loop) {
            this.prevBtn.disabled = (this.currentIndex === 0);
            this.nextBtn.disabled = (this.currentIndex === this.totalImages - 1);
        }
    }

    /**
     * Navigates to a specific slide index.
     * Handles looping if `this.config.loop` is true.
     * @param {number} newIndex - The index of the slide to go to.
     * @param {boolean} resetAutoSlide - Whether to reset the auto-slide timer.
     */
    goToSlide(newIndex, resetAutoSlide = false) {
        if (newIndex === this.currentIndex && !resetAutoSlide) {
            return; // No change, and no need to reset timer if not explicitly requested
        }

        let targetIndex = newIndex;

        if (this.config.loop) {
            if (newIndex >= this.totalImages) {
                targetIndex = 0;
            } else if (newIndex < 0) {
                targetIndex = this.totalImages - 1;
            }
        } else {
            // Clamp index if not looping
            targetIndex = Math.max(0, Math.min(newIndex, this.totalImages - 1));
        }

        // Only update if index actually changed or resetAutoSlide is true (for timer restart)
        if (this.currentIndex !== targetIndex || resetAutoSlide) {
            this.currentIndex = targetIndex;
            this.updateSlider();

            if (resetAutoSlide) {
                this.pauseAutoSlide();
                this.startAutoSlide();
            }
        }
    }

    /**
     * Moves to the next slide.
     */
    nextSlide() {
        this.goToSlide(this.currentIndex + 1);
    }

    /**
     * Starts the automatic slide transition and progress bar animation.
     */
    startAutoSlide() {
        this.pauseAutoSlide(); // Clear any existing interval/animation first

        this.startTime = performance.now(); // Record start time for progress bar
        this.animateProgressBar();

        this.slideInterval = setInterval(() => {
            this.nextSlide();
            this.startTime = performance.now(); // Reset start time for next slide
            this.animateProgressBar(); // Restart progress bar animation
        }, this.config.slideDuration);
    }

    /**
     * Pauses the automatic slide transition and progress bar animation.
     */
    pauseAutoSlide() {
        if (this.slideInterval) {
            clearInterval(this.slideInterval);
            this.slideInterval = null;
        }
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.progressBar) {
            // Store current progress state before pausing
            const elapsed = performance.now() - (this.startTime || performance.now());
            const currentProgress = Math.min(elapsed / this.config.slideDuration, 1);
            this.progressBar.style.width = `${currentProgress * 100}%`;
            this.progressBar.style.transition = 'none'; // Freeze the bar without transition
        }
    }

    /**
     * Animates the progress bar using requestAnimationFrame for smoothness.
     * @param {DOMHighResTimeStamp} currentTime - The current time provided by requestAnimationFrame.
     */
    animateProgressBar(currentTime) {
        if (!this.progressBar) return;

        if (!this.startTime) {
            this.startTime = currentTime; // Initialize start time if not set (first call)
        }

        const elapsed = currentTime - this.startTime;
        const progress = Math.min(elapsed / this.config.slideDuration, 1); // Clamp between 0 and 1
        const width = progress * 100;

        // Apply width and ensure no transition during rapid updates
        this.progressBar.style.transition = 'none'; // Temporarily remove transition for instant update
        this.progressBar.style.width = `${width}%`;

        if (progress < 1) {
            this.animationFrameId = requestAnimationFrame((timestamp) => this.animateProgressBar(timestamp));
        } else {
            // Animation finished for this cycle, reset for the next one (actual slide change handled by setInterval)
            this.progressBar.style.width = '0%';
            this.progressBar.style.transition = 'none'; // Ensure next animation starts from 0%
        }
    }

    /**
     * Cleans up event listeners and intervals when slider is no longer needed.
     * (Useful if you're dynamically adding/removing sliders)
     */
    destroy() {
        this.pauseAutoSlide();
        if (this.prevBtn) this.prevBtn.removeEventListener('click', () => this.goToSlide(this.currentIndex - 1, true));
        if (this.nextBtn) this.nextBtn.removeEventListener('click', () => this.goToSlide(this.currentIndex + 1, true));
        if (this.config.pauseOnHover) {
            this.sliderWrapper.removeEventListener('mouseenter', () => this.pauseAutoSlide());
            this.sliderWrapper.removeEventListener('mouseleave', () => this.startAutoSlide());
        }
        if (this.config.pauseOnFocus) {
            this.sliderWrapper.removeEventListener('focusin', () => this.pauseAutoSlide());
            this.sliderWrapper.removeEventListener('focusout', () => this.startAutoSlide());
        }
        if (this.dots) {
            this.dots.forEach(dot => dot.removeEventListener('click', () => this.goToSlide(parseInt(dot.dataset.index), true)));
        }
        // Potentially remove the sliderWrapper from DOM if desired
        // this.sliderWrapper.remove();
        console.log('Slider destroyed:', this.sliderWrapper.id || this.sliderWrapper);
    }
}


// --- Initialization for Multiple Sliders ---
document.addEventListener('DOMContentLoaded', () => {
    // Select all slider wrappers on the page
    const allSliderWrappers = document.querySelectorAll('.slider-wrapper');
    const sliders = []; // To store references to all initialized slider instances

    allSliderWrappers.forEach((wrapperElement, index) => {
        // You can customize options for each slider here if needed
        const sliderOptions = {
            slideDuration: 5000, // Default 5 seconds for all
            transitionDuration: 800, // Default 0.8 seconds for all
            loop: true,
            pauseOnHover: true,
            pauseOnFocus: true,
            initialSlide: 0 // Start all from first slide
        };

        // Example of custom options for a specific slider by ID
        if (wrapperElement.id === 'urbanSlider') {
            sliderOptions.slideDuration = 4000; // Urban slider changes every 4 seconds
            sliderOptions.loop = false; // Urban slider does not loop
        }
        if (wrapperElement.id === 'abstractSlider') {
             sliderOptions.slideDuration = 3000; // Abstract slider is faster
             sliderOptions.initialSlide = 1; // Start on the second image for abstract
        }

        const sliderInstance = new ImageSlider(wrapperElement, sliderOptions);
        if (sliderInstance) { // Only add if initialization was successful
            sliders.push(sliderInstance);
        }
    });

    console.log(`Initialized ${sliders.length} slider(s).`);
    // Now you have an array 'sliders' holding all your slider instances if you need to control them globally.
});
