import { FC } from 'react';
import './globals.css';
import Script from 'next/script';

interface RootLayoutProps {
  children: React.ReactNode;
}

const RootLayout: FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <title>OpenPay React Example</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet"></link>
        <Script src="https://js.stripe.com/v3/" />
        <Script 
          src="https://checkoutshopper-live-in.cdn.adyen.com/checkoutshopper/sdk/6.6.0/adyen.js"
          integrity="sha384-Oa2agnE48SFtDpzmEK8mbhbmEA1X4WH6afLBbypUhFU8oDhJWAIGvLQTBrqgls4A"
          crossOrigin="anonymous" 
        />
        <link
          rel="stylesheet"
          href="https://checkoutshopper-live-in.cdn.adyen.com/checkoutshopper/sdk/6.6.0/adyen.css"
          integrity="sha384-UAD/QSv1wQyfA60svLYxJ0OJAPl9TpkksO+HEOUX8YJcD+MYzNmn+q4XL7YBeHcr"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
