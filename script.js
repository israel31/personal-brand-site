document.addEventListener('DOMContentLoaded', function() {
    // Select all anchor links with a 'href' starting with '#' but not just '#'
    const scrollLinks = document.querySelectorAll('a[href^="#"]:not([href="#"])');

    for (const link of scrollLinks) {
        link.addEventListener('click', function(e) {
            // Prevent the default anchor link behavior
            e.preventDefault();

            // Get the target element's ID from the href attribute
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Smoothly scroll to the target element
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    }
});