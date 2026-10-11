# Manual checks: theme-dawn-demo.myshopify.com

Things an outside audit cannot see. Tick them off with a test inbox, a real phone and, where needed, a small test order.

## From this audit

- [ ] **#6 In a throttled phone lab run, the home page's largest element, the hero banner image, appeared only at 3.3 s**: Run pagespeed.web.dev for the home URL on Mobile 3 times and read the Core Web Vitals (field) block, which this audit could not fetch.
- [ ] **#12 The store goes by four names: "DAWN" (header logo), "theme-dawn-demo" (footer and page titles), "Mlouye" (About) and "Rure" (a home page press quote)**: Confirm the real brand name and headquarters with the merchant.
- [ ] **#23 No cookie banner appeared for the visitor location used in the test**: Open the site through a UK or EU connection in a private window, note the banner, click Decline, then list requests to google/facebook domains in the Network tab.
- [ ] **#24 Welcome and abandoned-checkout emails could not be observed from outside and need a test with a real inbox**: Use a test address: subscribe in the footer, note the welcome email. Add a product to cart, start checkout up to the email step, leave, and record every email received after 24 and 72 hours (sender, subject, offer, timing).

## Always worth checking

- [ ] Place one real order on a phone with a new email address: checkout steps, shipping options and costs, payment methods, order confirmation email.
- [ ] Sign up to the newsletter with a test inbox: is the welcome email received, and does any promised code work?
- [ ] Add to cart with a test email, leave at checkout, and note which reminder emails arrive in 24 and 72 hours.
- [ ] Apply every public discount code you can find together in one cart: does the total match what you intend?
- [ ] Open the store from another country (VPN) where you sell: cookie banner, currency, shipping and prices.
- [ ] Open the store admin: apps installed vs apps detected in this report; remove anything unused.
