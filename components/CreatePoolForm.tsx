"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { BASE_DECIMALS, QUOTE_DECIMALS, buildCreatePoolTransaction } from "@/lib/dbc";
import { NATIVE_SOL_MINT, CLUSTER } from "@/lib/solana";
import { sendAndConfirm, TxError } from "@/lib/tx";
import { queueRegistration, registerPool, type PoolRegistration } from "@/lib/registration";
import { fileToResizedDataUrl, submitImageUpdate } from "@/lib/imageUpload";
import { previewCurve } from "@/lib/studio";
import { LIMITS } from "@/lib/studioChecks";
import { fmtCompact, fmtMultiple, fmtQuote } from "@/lib/format";
import type { CreatePoolInput } from "@/lib/types";

type Step = "form" | "building" | "signing" | "confirming" | "registering" | "done" | "error";

const initialForm = {
  name: "",
  symbol: "",
  imageUrl: "",
  description: "",
  initialMarketCapQuote: "5",
  migrationMarketCapQuote: "300",
  totalSupply: "1000000000",
  feeSchemeBps: "300",
};

export function CreatePoolForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction, signMessage } = useWallet();
  const { setVisible } = useWalletModal();

  // Pre-filled from Curve Studio's review step
  const [form, setForm] = useState(() => {
    const pick = (key: string, fallback: string) => {
      const v = searchParams.get(key);
      return v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) > 0 ? v : fallback;
    };
    return {
      ...initialForm,
      initialMarketCapQuote: pick("start", initialForm.initialMarketCapQuote),
      migrationMarketCapQuote: pick("migrate", initialForm.migrationMarketCapQuote),
      totalSupply: pick("supply", initialForm.totalSupply),
      feeSchemeBps: pick("fee", initialForm.feeSchemeBps),
    };
  });
  const fromStudio = searchParams.has("start");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFilePreview, setImageFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof typeof initialForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Same preview Curve Studio shows: what you see here is what gets deployed
  const preview = useMemo(
    () =>
      previewCurve({
        startMcap: Number(form.initialMarketCapQuote),
        migrationMcap: Number(form.migrationMarketCapQuote),
        totalSupply: Number(form.totalSupply),
        startingFeeBps: Number(form.feeSchemeBps),
      }),
    [form.initialMarketCapQuote, form.migrationMarketCapQuote, form.totalSupply, form.feeSchemeBps]
  );
  const blockers = preview.checks.filter((c) => c.level === "error");

  const nameOk = form.name.trim().length > 0 && form.name.trim().length <= 32;
  const symbolOk = /^[A-Za-z0-9]{1,10}$/.test(form.symbol.trim());
  const imageOk = form.imageUrl === "" || /^https:\/\/\S+$/i.test(form.imageUrl.trim());

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setImageFile(file);
      setImageFilePreview(dataUrl);
      update("imageUrl", ""); // uploaded file and pasted link are mutually exclusive
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't process that image.");
    }
  }

  function clearPickedFile() {
    setImageFile(null);
    setImageFilePreview(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    setWarning(null);

    if (!publicKey || !signTransaction) {
      setVisible(true);
      return;
    }
    if (!nameOk || !symbolOk || !imageOk) {
      setError("Fix the highlighted fields before launching.");
      return;
    }
    if (blockers.length > 0 || !preview.canLaunch) {
      setError(blockers[0]?.detail ?? "These curve settings can't be launched.");
      return;
    }

    const input: CreatePoolInput = {
      name: form.name.trim(),
      symbol: form.symbol.trim().toUpperCase(),
      imageUrl: form.imageUrl.trim() || undefined,
      description: form.description || undefined,
      initialMarketCapQuote: Number(form.initialMarketCapQuote),
      migrationMarketCapQuote: Number(form.migrationMarketCapQuote),
      totalSupply: Number(form.totalSupply),
      quoteMint: "SOL",
      feeSchemeBps: Number(form.feeSchemeBps),
      creator: publicKey.toBase58(),
    };

    try {
      setStep("building");
      const built = await buildCreatePoolTransaction(input, connection);

      setStep("signing");
      const signature = await sendAndConfirm({
        connection,
        transaction: built.createPoolTx,
        feePayer: publicKey,
        signTransaction,
        extraSigners: [built.configKeypair, built.baseMintKeypair],
      });
      void signature;

      setStep("registering");
      const registration: PoolRegistration = {
        address: built.poolAddress.toBase58(),
        configAddress: built.configKeypair.publicKey.toBase58(),
        baseMint: built.baseMintKeypair.publicKey.toBase58(),
        quoteMint: NATIVE_SOL_MINT,
        name: input.name,
        symbol: input.symbol,
        imageUrl: input.imageUrl ?? null,
        creator: input.creator,
        baseDecimals: BASE_DECIMALS,
        quoteDecimals: QUOTE_DECIMALS,
        totalSupply: input.totalSupply,
        migrationThresholdQuote: built.quoteThreshold,
      };
      const result = await registerPool(registration);
      if (result !== "ok") {
        // The token exists on-chain. Keep the details and keep retrying so it isn't lost.
        queueRegistration(registration);
        setWarning(
          "Your token was created on-chain, but Meridian couldn't save it to its database yet. It will keep retrying automatically. Check the database connection (open /api/health) and reload this site."
        );
        setStep("done");
        return;
      }
      // If the creator uploaded a file (rather than pasting a link), set it as the display
      // image now via the same signed off-chain path Creator Tools uses — keeps the on-chain
      // transaction small (no large data embedded in it) while still giving the pool a real
      // image on Meridian right away. A failure here doesn't affect the successful launch.
      if (imageFilePreview && signMessage) {
        try {
          await submitImageUpdate({ poolAddress: registration.address, creator: input.creator, imageUrl: imageFilePreview, signMessage });
        } catch (err) {
          console.warn("Launched successfully, but setting the uploaded image failed:", err);
        }
      }

      setStep("done");
      router.push(`/pool/${registration.address}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof TxError || err instanceof Error ? err.message : "Something went wrong.");
      setStep("error");
    }
  }

  const busy = step !== "form" && step !== "error" && step !== "done";
  const invalid = (bad: boolean) => (touched && bad ? "border-sell" : "");

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-8" noValidate>
      <div className="lg:col-span-3 max-w-xl">
        {fromStudio && (
          <div className="mb-5 px-3 py-2 border border-border rounded bg-panel text-xs text-muted flex items-center justify-between gap-3">
            <span>Curve settings loaded from Curve Studio.</span>
            <Link href="/studio" className="text-amber hover:underline shrink-0">Edit curve</Link>
          </div>
        )}

        <h2 className="text-sm font-medium mb-4">Token details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Token name" required error={touched && !nameOk ? "Enter a name up to 32 characters." : undefined}>
            <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Solar Flare" className={`input ${invalid(!nameOk)}`} maxLength={32} />
          </Field>
          <Field label="Symbol" required error={touched && !symbolOk ? "1–10 letters or numbers." : undefined}>
            <input value={form.symbol} onChange={(e) => update("symbol", e.target.value)} placeholder="FLARE" className={`input font-mono uppercase ${invalid(!symbolOk)}`} maxLength={10} />
          </Field>
        </div>
        <label className="block mb-4">
          <span className="block text-xs text-muted mb-1.5">Token image</span>
          {imageFilePreview ? (
            <div className="flex items-center gap-3 border border-border rounded p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageFilePreview} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
              <span className="text-xs text-muted flex-1">Image selected — uploaded after launch confirms.</span>
              <button type="button" onClick={clearPickedFile} className="text-xs text-faint hover:text-text shrink-0">Remove</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={form.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} placeholder="https://… (or upload a file instead)" className={`input flex-1 ${invalid(!imageOk)}`} />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-2 border border-border rounded text-xs text-muted hover:text-text hover:border-borderHi transition-colors shrink-0">
                Upload
              </button>
            </div>
          )}
          {touched && !imageOk ? (
            <span className="block text-xs text-sell mt-1">Use a link starting with https://, or upload a file instead.</span>
          ) : (
            <span className="block text-xs text-faint mt-1">Optional. Paste a link, or upload an image from your device.</span>
          )}
        </label>
        <Field label="Description" hint="Optional.">
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} className="input resize-none" />
        </Field>

        <div className="h-px bg-border my-6" />
        <h2 className="text-sm font-medium mb-4">Curve settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Starting market cap (SOL)" hint="Price when the curve opens.">
            <input value={form.initialMarketCapQuote} onChange={(e) => update("initialMarketCapQuote", e.target.value)} type="number" min="0" step="0.1" className="input font-mono" />
          </Field>
          <Field label="Migration market cap (SOL)" hint="Graduates to a DEX at this cap.">
            <input value={form.migrationMarketCapQuote} onChange={(e) => update("migrationMarketCapQuote", e.target.value)} type="number" min="0" step="1" className="input font-mono" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
          <Field label="Total supply">
            <input value={form.totalSupply} onChange={(e) => update("totalSupply", e.target.value)} type="number" min="1" className="input font-mono" />
          </Field>
          <Field label="Starting fee (bps)" hint={`${LIMITS.feeMin}–${LIMITS.feeMax}. Decays to 100 over the first hour.`}>
            <input value={form.feeSchemeBps} onChange={(e) => update("feeSchemeBps", e.target.value)} type="number" min={LIMITS.feeMin} max={LIMITS.feeMax} className="input font-mono" />
          </Field>
        </div>

        {blockers.map((b) => (
          <div key={b.title} className="mb-3 px-3 py-2 border border-sell/40 bg-sell/10 text-sell text-sm rounded">
            <strong className="font-medium">{b.title}.</strong> {b.detail}
          </div>
        ))}
        {error && <div role="alert" className="mb-3 px-3 py-2 border border-sell/40 bg-sell/10 text-sell text-sm rounded">{error}</div>}
        {warning && <div role="status" className="mb-3 px-3 py-2 border border-amber/40 bg-amber/10 text-text text-sm rounded">{warning}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 bg-amber text-white text-sm font-semibold rounded hover:bg-amberHi transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!publicKey && step === "form" && "Connect wallet to launch"}
          {publicKey && step === "form" && "Launch token"}
          {step === "building" && "Preparing transaction…"}
          {step === "signing" && "Approve in your wallet, then wait for confirmation…"}
          {step === "registering" && "Saving your token…"}
          {step === "done" && "Launched"}
          {step === "error" && "Try again"}
        </button>
        <p className="text-xs text-faint mt-3">
          This deploys a real DBC pool on {CLUSTER === "devnet" ? "Solana devnet (test funds only)" : "Solana mainnet"}. Your wallet will ask you to sign once.
        </p>
      </div>

      <aside className="lg:col-span-2">
        <div className="border border-border rounded bg-panel p-4 lg:sticky lg:top-24">
          <h2 className="text-sm font-medium mb-3">Launch summary</h2>
          {preview.model ? (
            <dl className="space-y-2.5 text-xs">
              <Row k="Start price" v={fmtQuote(preview.model.startPrice)} />
              <Row k="Migration price" v={fmtQuote(preview.model.migrationPrice)} />
              <Row k="Price range" v={fmtMultiple(preview.model.priceMultiple)} />
              <Row k="Raised to graduate" v={fmtQuote(preview.model.quoteToGraduate)} />
              <Row k="Tokens sold on curve" v={fmtCompact(preview.model.tokensOnCurve)} />
              <Row k="Figures" v={preview.model.source === "sdk" ? "Exact (launch config)" : "Verified estimate"} />
            </dl>
          ) : (
            <p className="text-xs text-muted">Fix the curve settings to see a summary.</p>
          )}
          <Link href="/studio" className="block mt-4 text-xs text-amber hover:underline">
            Tune the curve in Curve Studio →
          </Link>
        </div>
      </aside>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono text-text text-right">{v}</dd>
    </div>
  );
}

function Field({ label, hint, required, error, children }: { label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs text-muted mb-1.5">
        {label} {required && <span className="text-sell">*</span>}
      </span>
      {children}
      {error ? <span className="block text-xs text-sell mt-1">{error}</span> : hint ? <span className="block text-xs text-faint mt-1">{hint}</span> : null}
    </label>
  );
}
