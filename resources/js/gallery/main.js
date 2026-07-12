// Gallery progressive enhancements
document.documentElement.dataset.vvGallery = '1';

document.querySelectorAll('.vv-gallery-image').forEach((image) => {
    const reveal = () => image.classList.add('is-loaded');
    if (image.complete) reveal();
    else image.addEventListener('load', reveal, { once: true });
});
