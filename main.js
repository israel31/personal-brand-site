// Mobile Menu Toggle
const mobileToggle = document.querySelector('.mobile-nav-toggle');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-links a');


mobileToggle.addEventListener('click', () => {
  mobileToggle.classList.toggle('active');
  navMenu.classList.toggle('active');
  // Prevent scrolling when menu is open
  document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : 'auto';
});

// Close menu when a link is clicked (Mobile)
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    mobileToggle.classList.remove('active');
    navMenu.classList.remove('active');
    document.body.style.overflow = 'auto';
  });
});

// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href.startsWith("#")) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
  });
});

// Reveal on Scroll Animation (Intersection Observer)
const observerOptions = { threshold: 0.1 };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

document.querySelectorAll('.feature-card, .product-card, .hero-image').forEach(el => {
  el.classList.add('reveal-item');
  observer.observe(el);
});


// Contact Form Submission Handling
const contactForm = document.getElementById('contact-form');
const successMessage = document.getElementById('form-success');

if (contactForm) {
  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault(); // Stop the page from reloading
    
    const btn = this.querySelector('button');
    btn.innerText = "Sending...";
    btn.disabled = true;

    // Get the data from the form
    const data = new FormData(e.target);

    // Send the data to Formspree
    const response = await fetch(e.target.action, {
      method: 'POST',
      body: data,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      // It worked! Show the success message
      contactForm.style.display = 'none';
      successMessage.style.display = 'block';
    } else {
      // Something went wrong
      btn.innerText = "Error! Try again";
      btn.disabled = false;
    }
  });
}

// Add the contact section to the Reveal on Scroll list
document.querySelectorAll('.contact-info, .contact-form-card').forEach(el => {
  el.classList.add('reveal-item');
  observer.observe(el);
});
