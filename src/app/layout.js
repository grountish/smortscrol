import './globals.css';

export const metadata = {
  title: 'Smortscroll',
  description: 'Endless, but mindful. A calm feed of facts, paintings, and history.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/favicon.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Smortscroll',
  },
};

export const viewport = {
  themeColor: '#2a2016',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof window==='undefined'){return;}if(!window.ethereum){window.ethereum={selectedAddress:undefined};}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
