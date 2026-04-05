import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Stripe error: STRIPE_SECRET_KEY env var is not set');
    return res.status(500).json({ error: 'Server is missing Stripe configuration' });
  }

  const { tier } = req.body || {};

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
    console.error('Stripe checkout session error:', {
      message: error?.message,
      type: error?.type,
      code: error?.code,
      statusCode: error?.statusCode,
      requestId: error?.requestId,
      stack: error?.stack,
    });
    return res.status(500).json({
      error: 'Failed to create checkout session',
      detail: error?.message,
    });
  }
}
