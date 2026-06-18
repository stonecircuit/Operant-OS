import { app } from "@/lib/firebase";

export default function TestPage() {
  return (
    <main>
      <h1>Firebase Connected</h1>
      <p>{app.name}</p>
    </main>
  );
}