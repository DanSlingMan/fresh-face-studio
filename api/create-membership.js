export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tier } = req.body;

  const tiers = {
    member: {
      name: 'Fresh Face Member',
      price: 8900, // $89.00 in cents
      description: 'Monthly Classic Facial + member perks',
    },
    vip: {
      name: 'Fresh Face VIP',
      price: 13900, // $139.00
      description: 'Monthly Custom Facial + VIP perks',
    },
    luxe: {
      name: 'Fresh Face Luxe',
      price: 19900, // $199.00
      description: 'Monthly Custom Facial + additional service + Luxe perks',
    },
  };

  const selected = tiers[tier];
  if (!selected) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            recurring: { interval: 'month' },
            product_data: {
              name: selected.name,
              description: selected.description,
            },
            unit_amount: selected.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin || 'https://yourfreshface.com'}/membership?success=true`,
      cancel_url: `${req.headers.origin || 'https://yourfreshface.com'}/membership?cancelled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
