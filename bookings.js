document.addEventListener('DOMContentLoaded', function() {

    // --- Configuration for Booking System ---
    // TO-DO: Paste the Web App URL for your BOOKING Google Script here.
    const BOOKING_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxdPqdzysgQl7P_jIfF58yuGn1EPU11Lg3sgN2CQ_TNIfJuY3Gjva0a-SjH07Z5JsrI/exec';

    // --- Element Selectors for Booking ---
    const bookingSection = document.getElementById('booking');
    const loadingDiv = document.getElementById('calendar-loading');
    const slotsContainer = document.getElementById('slots-container');
    const bookingFormContainer = document.getElementById('booking-form-container');
    const bookingForm = document.getElementById('booking-form');
    const confirmationDiv = document.getElementById('booking-confirmation');
    
    // If the booking section doesn't exist on the page, stop running this script.
    if (!bookingSection) return;

    // --- Main Booking Logic ---

    // Function to fetch and display available slots from the Google Script
    async function loadAvailableSlots() {
        try {
            loadingDiv.style.display = 'block';
            slotsContainer.innerHTML = '';
            bookingFormContainer.style.display = 'none'; // Hide form while reloading

            const response = await fetch(`${BOOKING_SCRIPT_URL}?action=getAvailableSlots`);
            const data = await response.json();

            if (data.status === 'success' && data.slots.length > 0) {
                displaySlots(data.slots);
            } else {
                slotsContainer.innerHTML = '<p>Sorry, no available slots found in the next two weeks. Please check back later.</p>';
            }
        } catch (error) {
            console.error("Error fetching slots:", error);
            slotsContainer.innerHTML = '<p>Sorry, there was an error loading the schedule. Please try refreshing the page.</p>';
        } finally {
            loadingDiv.style.display = 'none';
        }
    }

    // Function to take the raw slot data and render it as HTML
    function displaySlots(slots) {
        const groupedSlots = slots.reduce((acc, slot) => {
            const date = new Date(slot);
            const dateString = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (!acc[dateString]) acc[dateString] = [];
            acc[dateString].push(slot);
            return acc;
        }, {});

        let html = '';
        for (const dateString in groupedSlots) {
            html += `<h4 class="date-heading">${dateString}</h4><div class="slots-grid">`;
            groupedSlots[dateString].forEach(slot => {
                const timeString = new Date(slot).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
                html += `<button class="time-slot-btn" data-slot-iso="${slot}">${timeString}</button>`;
            });
            html += '</div>';
        }
        slotsContainer.innerHTML = html;
    }

    // Event Delegation: Listen for clicks on the parent container
    slotsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('time-slot-btn')) {
            const currentlySelected = slotsContainer.querySelector('.selected');
            if (currentlySelected) currentlySelected.classList.remove('selected');
            
            e.target.classList.add('selected');

            const selectedSlotISO = e.target.dataset.slotIso;
            const displayTime = new Date(selectedSlotISO).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
            
            document.getElementById('selected-slot-iso').value = selectedSlotISO;
            document.getElementById('selected-slot-text').textContent = displayTime;
            bookingFormContainer.style.display = 'block';
            bookingForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // Handle the final submission of the booking form
    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitButton = bookingForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Booking...';

        const slot = document.getElementById('selected-slot-iso').value;
        const name = document.getElementById('booking-name').value;
        const email = document.getElementById('booking-email').value;

        try {
            // Construct the fetch URL with URL-encoded parameters
            const url = `${BOOKING_SCRIPT_URL}?action=bookSlot&slot=${encodeURIComponent(slot)}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'success') {
                // On success, hide the booking UI and show the confirmation message
                document.getElementById('calendar-ui').style.display = 'none';
                bookingFormContainer.style.display = 'none';
                confirmationDiv.style.display = 'block';
            } else {
                // If the script returns an error (e.g., slot taken), show it to the user
                alert(`Error: ${data.message}`);
                // If the error was a double-booking, reload the slots for the user
                if (data.message.includes("booked by someone else")) {
                    loadAvailableSlots();
                }
            }
        } catch (error) {
            // If a network error occurs, show a generic message
            console.error("Error booking slot:", error);
            alert("A network error occurred. Please try again.");
        } finally {
            // ALWAYS re-enable the button, whether it succeeded or failed
            submitButton.disabled = false;
            submitButton.textContent = 'Confirm Booking';
        }
    });

    // Initial load of slots when the page is ready
    loadAvailableSlots();
});