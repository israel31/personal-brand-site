document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registration-form');
    const submitButton = document.getElementById('submit-button');
    
    // Make sure this is the LATEST Web App URL from your deployment
     const scriptURL = 'https://script.google.com/macros/s/AKfycbwsfmK5_zgrfdD1fAsXrEsCg9aVtnQ-2V52vdLHgFfSQ-2yWUZud6Aat6qmHfnsU8wlGQ/exec';
         const paystackSlug = '14f-oox9sl';

    form.addEventListener('submit', e => {
        e.preventDefault();
        
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        const formData = new FormData(form);
        
        // We will now change the fetch logic to properly debug
        fetch(scriptURL, { method: 'POST', body: formData})
            .then(response => {
                // First, let's see exactly what the server sent back.
                // We clone the response so we can read it twice (once as text, once as json)
                return response.clone().text().then(text => {
                    console.log("Raw response from server:", text); // This will show us the raw text
                    
                    // Now, we try to parse it as JSON
                    return JSON.parse(text);
                });
            })
            .then(data => {
                console.log("Parsed JSON response:", data);
                if (data.result === 'success') {
                    // Redirect logic remains the same
                    const name = formData.get('name');
                    const email = formData.get('email');
                    const phone = formData.get('phone');
                    const paystackUrl = `https://paystack.com/pay/${paystackSlug}?email=${encodeURIComponent(email)}&first_name=${encodeURIComponent(name.split(' ')[0])}&last_name=${encodeURIComponent(name.split(' ').slice(1).join(' '))}&phone=${encodeURIComponent(phone)}`;
                    window.location.href = paystackUrl;
                } else {
                    // If the script returned a JSON error, show it
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