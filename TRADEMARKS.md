# Name and logo

The code in this repository is free software under the [AGPL-3.0](./LICENSE). The **Cheque Tracker** name, the logo (the cheque-with-a-tick mark in `src/components/shared/AppLogo.tsx` and the icons in `public/icons/`) and the chequetracker.com domain are not covered by that licence. They identify the official project and the hosted service.

## You're welcome to

- Refer to the project by name, for example "a fork of Cheque Tracker" or "works with Cheque Tracker".
- Run a copy, changed or not, for yourself or within your own organisation.
- Write about it, teach it and link to it.

## Please don't

- Offer a hosted service, app or product to other people under the Cheque Tracker name or logo, or in a way that suggests it's the official service.
- Use the name or logo in a domain name, app store listing, company or product name.

## Running a copy for others

Give it its own identity. It only takes configuration:

- `VITE_APP_NAME` and `VITE_APP_TAGLINE` set the name in the app, the page title and the web manifest.
- Replace the files in `public/icons/` with your own icons, keeping their names and sizes, and set `VITE_APP_LOGO` to your logo image.
- Set `VITE_SOURCE_URL` to your repository, as the AGPL requires (see [docs/self-hosting.md](./docs/self-hosting.md#if-you-change-the-code)).

For anything not covered here, open an issue or contact the maintainer, [@vikashpatel04](https://github.com/vikashpatel04).
