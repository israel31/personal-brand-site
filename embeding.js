(function () {
    window.GatekeeperForm = {
        SUPABASE_FUNC_URL: "https://nugxkqclzusgibyqemou.supabase.co/functions/v1/create-entry",

        init: async function (containerId, config) {
            const container = document.getElementById(containerId);
            if (!container) {
                console.error("Gatekeeper Error: Container element not found.");
                return;
            }

            container.innerHTML = '<div style="text-align:center; padding:20px; font-family:sans-serif; color:#64748b;">Loading dynamic form context...</div>';

            try {
                const response = await fetch(`${this.SUPABASE_FUNC_URL}?form_id=${encodeURIComponent(config.formId)}`, {
                    method: 'GET',
                    headers: { 'x-embed-key': config.embedKey }
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to load form schema.');

                this.renderForm(container, data.form, Array.isArray(data.fields) ? data.fields : [], config);
            } catch (err) {
                container.innerHTML = `<div style="padding:16px; border:1px solid #fca5a5; background:#fef2f2; color:#991b1b; border-radius:12px; font-size:13px; font-family:sans-serif;">
                    <strong>Configuration Error:</strong> ${err.message}
                </div>`;
            }
        },

        renderForm: function (container, form, fields, config) {
            container.innerHTML = '';

            const formEl = document.createElement('form');
            formEl.style.cssText = 'font-family:sans-serif; display:flex; flex-direction:column; gap:16px; max-width:480px; margin:0 auto;';

            const titleMarkup = `
                <div style="margin-bottom:8px;">
                    <h2 style="margin:0; font-size:20px; font-weight:700; color:#0f172a;">${form.title || 'Registration'}</h2>
                    ${form.description ? `<p style="margin:4px 0 0 0; font-size:13px; color:#64748b;">${form.description}</p>` : ''}
                </div>
            `;

            const baseFieldsMarkup = `
                <div>
                    <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Full Name</label>
                    <input type="text" name="name" required style="width:100%; box-sizing:border-box; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px;" />
                </div>
                <div>
                    <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Email Address</label>
                    <input type="email" name="email" required style="width:100%; box-sizing:border-box; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px;" />
                </div>
            `;

            const customFieldsMarkup = fields.map((field) => `
                <div>
                    <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">${field.field_label || field.label || 'Field'}${field.is_required || field.required ? ' <span style="color:#ef4444">*</span>' : ''}</label>
                    <input type="${field.field_type || field.type || 'text'}" name="field_${field.id || field.field_key || field.label}" ${field.is_required || field.required ? 'required' : ''} style="width:100%; box-sizing:border-box; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px;" />
                </div>
            `).join('');

            const priceText = (Number(form.price) || 0) > 0 ? ` — ₦${(Number(form.price) / 100).toLocaleString()}` : '';

            formEl.innerHTML = `
                ${titleMarkup}
                ${baseFieldsMarkup}
                ${customFieldsMarkup}
                <button type="submit" style="background:#0f172a; color:#ffffff; font-weight:600; padding:12px; border:none; border-radius:8px; font-size:14px; cursor:pointer; margin-top:8px; transition:background 0.2s;">Complete Registration${priceText}</button>
                <div style="display:none; padding:12px; border-radius:8px; font-size:13px; text-align:center;"></div>
            `;

            const submitButton = formEl.querySelector('button');
            const messageBox = formEl.querySelector('div:last-child');

            formEl.addEventListener('submit', async (e) => {
                e.preventDefault();
                submitButton.disabled = true;
                submitButton.innerText = 'Processing registration...';
                messageBox.style.display = 'none';

                const formData = new FormData(formEl);
                const payload = {
                    form_id: form.id,
                    name: formData.get('name'),
                    email: formData.get('email'),
                    answers: {}
                };

                fields.forEach((field) => {
                    const fieldName = `field_${field.id || field.field_key || field.label}`;
                    payload.answers[field.field_label || field.label || field.field_key] = formData.get(fieldName);
                });

                try {
                    const res = await fetch(this.SUPABASE_FUNC_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-embed-key': config.embedKey },
                        body: JSON.stringify(payload)
                    });

                    const result = await res.json();
                    if (!res.ok) throw new Error(result.error || 'Submission rejected.');

                    if (result.requires_payment && result.authorization_url) {
                        window.location.href = result.authorization_url;
                    } else if (result.thank_you_mode === 'customer' && result.custom_thank_you_url) {
                        const redirectUrl = new URL(result.custom_thank_you_url);
                        redirectUrl.searchParams.set('reference', result.reference);
                        window.location.href = redirectUrl.toString();
                    } else {
                        window.location.href = `https://gatekeeper.gt.tc/thank-you.html?reference=${result.reference}`;
                    }
                } catch (submissionErr) {
                    messageBox.style.cssText = 'display:block; padding:12px; border-radius:8px; font-size:13px; text-align:center; background:#fef2f2; color:#991b1b; border:1px solid #fca5a5;';
                    messageBox.innerText = submissionErr.message;
                    submitButton.disabled = false;
                    submitButton.innerText = `Complete Registration${priceText}`;
                }
            });

            container.appendChild(formEl);
        }
    };
})();
