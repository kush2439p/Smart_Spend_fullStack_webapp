import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <title>SmartSpend</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              height: 100%;
              background: #0f0f1a;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            #root {
              display: flex;
              justify-content: center;
              align-items: stretch;
              min-height: 100vh;
              background: #0f0f1a;
            }
            /* On larger screens: show phone frame */
            @media (min-width: 500px) {
              #root {
                background: radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1a 100%);
                align-items: center;
              }
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
