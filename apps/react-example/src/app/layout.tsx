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
      </head>
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
