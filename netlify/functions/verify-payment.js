const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  try {
    if (!event.body) return { statusCode: 400, body: JSON.stringify({ paid: false }) };

    const { email } = JSON.parse(event.body);
    if (!email) return { statusCode: 400, body: JSON.stringify({ paid: false }) };

    const res = await fetch("https://api.paystack.co/transaction?perPage=100", {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await res.json();

    if (!data || !Array.isArray(data.data)) throw new Error("Invalid Paystack response");

    const paid = data.data.some(
      (tx) =>
        tx.status === "success" &&
        tx.customer?.email?.toLowerCase() === email.toLowerCase()
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ paid }),
    };
  } catch (err) {
    console.error("VERIFY ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ paid: false }),
    };
  }
};
