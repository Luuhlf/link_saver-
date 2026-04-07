import { AuthProvider } from "@/components/firebase-provider";
import { MainApp } from "@/components/main-app";

export default function Home() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
