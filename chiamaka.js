// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // --- Smooth Scrolling for anchor links ---
    // (This part is unchanged)
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
    for (let link of smoothScrollLinks) {
        link.addEventListener('click', function(e) {
            let targetId = this.getAttribute('href');
            if (targetId.length > 1 && document.querySelector(targetId)) {
                e.preventDefault();
                document.querySelector(targetId).scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    }

    // --- Modal Logic ---
    const modal = document.getElementById('modal');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeBtn = document.querySelector('.close-button');
    const modalOverlay = document.querySelector('.modal-overlay');
    const leadForm = document.getElementById('lead-magnet-form');
    const toastNotification = document.getElementById('toast-notification');

    // (Functions to open/close modal are unchanged)
    const openModal = () => modal.classList.add('modal-visible');
    const closeModal = () => {
        modal.classList.remove('modal-visible');
        leadForm.reset();
    };

    if (openModalBtn) openModalBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
    
    // --- THE IMPORTANT CHANGE IS HERE ---
    if (leadForm) {
        leadForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const scriptURL = 'https://script.google.com/macros/s/AKfycbwyUuej1_EEgw_dXLg7FvQU71MunAVvKXTV59OvvbgxWzW5lFK8GymmtqnJx7ZZxvYq/exec'; // Make sure this is the latest deployed URL
            const formData = new FormData(leadForm);

            // =========================================================
            //  ADD THIS DEBUGGING CODE
            //  This will show us exactly what's in the formData object
            // =========================================================
            console.log("--- Checking FormData Contents ---");
            for (var pair of formData.entries()) {
                console.log(pair[0] + ': ' + pair[1]);
            }
            console.log("---------------------------------");
            // =========================================================

            fetch(scriptURL, { method: 'POST', body: formData })
                .then(response => response.json()) // Use .json() because our script returns JSON
                .then(data => {
                    console.log('Response from Google Sheets:', data);
                    if (data.result === 'success') {
                        closeModal();
                        toastNotification.classList.add('show');
                        setTimeout(() => {
                            toastNotification.classList.remove('show');
                        }, 4000);
                        // The download logic can be added back here if needed
                    } else {
                        // If the script returns an error, show it
                        alert('Error: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Error sending data:', error);
                    alert('A network error occurred. Please try again.');
                });
        });
    }
});