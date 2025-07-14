document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const form = document.getElementById('registration-form');
    const submitButton = document.getElementById('submit-button');
    // ===== NEW ELEMENT SELECTORS ADDED HERE =====
    const facultySelect = document.getElementById('faculty');
    const otherFacultyContainer = document.getElementById('other-faculty-container');
    const otherFacultyInput = document.getElementById('other_faculty');
    
    // --- Configuration ---
    // Your existing script URL and slug
    const scriptURL = 'https://script.google.com/macros/s/AKfycbwsfmK5_zgrfdD1fAsXrEsCg9aVtnQ-2V52vdLHgFfSQ-2yWUZud6Aat6qmHfnsU8wlGQ/exec';
    const paystackSlug = '14f-oox9sl';

    // ==========================================================
    // --- NEW: Logic to show/hide the "Other Faculty" field ---
    // ==========================================================
    if (facultySelect) { // Check if the element exists to avoid errors
        facultySelect.addEventListener('change', () => {
            if (facultySelect.value === 'Other') {
                otherFacultyContainer.style.display = 'block';
                otherFacultyInput.required = true; // Make the text field required
            } else {
                otherFacultyContainer.style.display = 'none';
                otherFacultyInput.required = false; // Make it not required
                otherFacultyInput.value = ''; // Clear the field if user changes their mind
            }
        });
    }

    // --- Your Existing Form Submission Logic ---
    form.addEventListener('submit', e => {
        e.preventDefault();
        
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        const formData = new FormData(form);
        
        // Your debug logic is preserved here
        fetch(scriptURL, { method: 'POST', body: formData})
            .then(response => {
                return response.clone().text().then(text => {
                    console.log("Raw response from server:", text);
                    return JSON.parse(text);
                });
            })
            .then(data => {
                console.log("Parsed JSON response:", data);
                if (data.result === 'success') {
                    // Redirect logic is unchanged
                    const name = formData.get('name');
                    const email = formData.get('email');
                    const phone = formData.get('phone');
                    const paystackUrl = `https://paystack.com/pay/${paystackSlug}?email=${encodeURIComponent(email)}&first_name=${encodeURIComponent(name.split(' ')[0])}&last_name=${encodeURIComponent(name.split(' ').slice(1).join(' '))}&phone=${encodeURIComponent(phone)}`;
                    window.location.href = paystackUrl;
                } else {
                    throw new Error(data.message || 'The script returned an error.');
                }
            })
            .catch(error => {
                console.error('Error!', error.message);
                alert('An error occurred. Please check the console for details.');
                
                submitButton.disabled = false;
                submitButton.textContent = 'Proceed to Payment';
            });
    });
});