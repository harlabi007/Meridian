import { Suspense } from "react";
import { CreatePoolForm } from "@/components/CreatePoolForm";

export default function CreatePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
      <div className="mb-8 max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Launch a token</h1>
        <p className="text-muted text-sm leading-relaxed">
          Set the curve&apos;s starting and migration market caps and DBC Launch
          Studio builds the bonding curve config for you. The pool goes live
          the moment your transaction confirms.
        </p>
      </div>
      <Suspense fallback={null}>
        <CreatePoolForm />
      </Suspense>
    </div>
  );
}
