import { Header } from "@/components/shared/header";

export default function StorefrontLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <>
      <Header />
      <div className="flex-1">{children}</div>
    </>
  );
}
