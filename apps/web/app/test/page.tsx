import { app } from "@/lib/firebase";

export default function TestPage() {
  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">
        Firebase Connected
      </h1>

      <p className="mt-4">
        App Name: {app.name}
      </p>
    </main>
  );
}