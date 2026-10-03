import "./globals.css";

export const metadata = {
  title: "Financial Report Analysis Assistant",
  description: "Financial Document Intelligence Engine for SEC 10-K filings",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          {children}
        </div>
      </body>
    </html>
  );
}
