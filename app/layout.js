import './globals.css';

export const metadata = {
  title: "Bright Kids AI – Tool Testing Lab",
  description: "Playful tools for parents & children to test and give feedback",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
