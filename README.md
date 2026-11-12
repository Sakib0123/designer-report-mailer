# Designer Work Report + Email

Fill in the designer's details and tasks, then download the PDF or email it to the designer.
The PDF is made in the browser; the Node server attaches it and sends it through the Resend email API.

## Run locally
1. Install Node 18+.
2. `npm install`
3. `cp .env.example .env` and set `RESEND_API_KEY`.
4. `npm start`, then open http://localhost:3000

Test without sending: set `MAIL_DRY_RUN=1`.

## Deploy on Render
Web service, build command `npm install`, start command `npm start`.
Environment variables: `RESEND_API_KEY` (secret), `MAIL_FROM`, optional `ALLOWED_DOMAINS`.

## Important
Until you verify your own domain in Resend, emails can only be delivered to the address of your Resend account.
Set `ALLOWED_DOMAINS` and keep the app private, otherwise anyone with the link can send email through your account.
Each IP is limited to 10 emails per hour.
