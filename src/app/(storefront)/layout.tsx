import { Header } from "@/components/shared/header";

export default function StorefrontLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
    </>
  );
}
