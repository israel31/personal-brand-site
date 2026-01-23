exports.handler = async (event) => {
  try {
    const { email } = JSON.parse(event.body);

    const response = await fetch(
      "https://api.paystack.co/transaction?perPage=100",
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const data = await response.json();

    const paid = data.data.some(tx =>
      tx.status === "success" &&
      tx.customer &&
      tx.customer.email.toLowerCase() === email.toLowerCase()
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ paid })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ paid: false })
    };
  }
};
